import { describe, expect, it, vi } from 'vitest';
import { createGame, defaultRules } from '../engine/level';
import type { AvatarConfig } from '../store/store';
import { RoomSession, TAG_IMMUNE_MS } from './room';
import { normalizeRoomCode, randomRoomCode, type Transport } from './transport';

/** メモリ上で複数の Transport をつなぐハブ（テスト用） */
class Hub {
  peers = new Map<string, MemTransport>();
  join(t: MemTransport): void {
    for (const other of this.peers.values()) {
      other.joinCb?.(t.selfId);
      t.joinCb?.(other.selfId);
    }
    this.peers.set(t.selfId, t);
  }
  leave(t: MemTransport): void {
    this.peers.delete(t.selfId);
    for (const other of this.peers.values()) other.leaveCb?.(t.selfId);
  }
  deliver(from: string, type: string, data: unknown, to?: string): void {
    for (const [id, t] of this.peers) {
      if (id === from) continue;
      if (to && to !== id) continue;
      // 実際の通信と同じく、JSON を経由してコピーを渡す
      t.msgCb?.(type, JSON.parse(JSON.stringify(data ?? null)), from);
    }
  }
}

let seq = 0;
class MemTransport implements Transport {
  readonly selfId = `peer${++seq}`;
  readonly kind = 'local' as const;
  msgCb: ((type: string, data: unknown, from: string) => void) | null = null;
  joinCb: ((id: string) => void) | null = null;
  leaveCb: ((id: string) => void) | null = null;
  constructor(private hub: Hub) {}
  send(type: string, data: unknown, to?: string): void {
    this.hub.deliver(this.selfId, type, data, to);
  }
  onMessage(cb: (type: string, data: unknown, from: string) => void): void {
    this.msgCb = cb;
  }
  onPeerJoin(cb: (id: string) => void): void {
    this.joinCb = cb;
  }
  onPeerLeave(cb: (id: string) => void): void {
    this.leaveCb = cb;
  }
  peers(): string[] {
    return [...this.hub.peers.keys()].filter((id) => id !== this.selfId);
  }
  close(): void {
    this.hub.leave(this);
  }
}

const avatar: AvatarConfig = { face: '😀', hat: 'cap', color: '#3b82f6', pants: '#22c55e', skin: '#f5cd30', unlocked: ['none', 'cap'] };
const game = createGame({ id: 'g1', title: 'テスト', width: 4, height: 1, tiles: 'P##G', rules: defaultRules('3d') });

async function setup() {
  const hub = new Hub();
  const connect = async () => {
    const t = new MemTransport(hub);
    hub.join(t);
    return t;
  };
  const host = RoomSession.create(game, { name: 'ホスト', avatar }, 'race', connect, 'ABCD');
  await Promise.resolve();
  const guest = RoomSession.join('ABCD', { name: 'ゲスト', avatar }, connect);
  await Promise.resolve();
  await Promise.resolve();
  return { hub, host, guest };
}

describe('room codes', () => {
  it('generates 4-character codes without confusing letters', () => {
    for (let i = 0; i < 50; i++) expect(randomRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
  it('normalizes typed codes', () => {
    expect(normalizeRoomCode(' ab-cd ')).toBe('ABCD');
    expect(normalizeRoomCode('o1zz')).toBe('01ZZ');
  });
});

describe('RoomSession', () => {
  it('guest receives the game and both see two members', async () => {
    const { host, guest } = await setup();
    expect(host.getSnapshot().players.map((p) => p.name).sort()).toEqual(['ゲスト', 'ホスト']);
    expect(guest.getSnapshot().players.map((p) => p.name).sort()).toEqual(['ゲスト', 'ホスト']);
    expect(guest.currentGame?.id).toBe('g1');
    expect(guest.currentPhase).toBe('lobby');
    expect(guest.getSnapshot().players.find((p) => p.isHost)?.name).toBe('ホスト');
  });

  it('host starts the round and everyone goes to playing; states are shared', async () => {
    const { host, guest } = await setup();
    host.setMode('tag');
    expect(guest.currentMode).toBe('tag');
    host.start();
    expect(guest.currentPhase).toBe('playing');
    expect(guest.getSnapshot().players.find((p) => p.isHost)?.it).toBe(true);
    expect(host.amIt).toBe(true);
    host.sendState({ x: 2, y: 1, z: 0.5, yaw: 0, f: 1, w: 0, g: true, r: false });
    const others = guest.others(1);
    expect(others).toHaveLength(1);
    expect(others[0].shown?.x).toBe(2);
    // 補間：次のフレームは目標に近づく
    host.sendState({ x: 3, y: 1, z: 0.5, yaw: 0, f: 1, w: 0, g: true, r: false });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 200);
    host.sendState({ x: 3, y: 1, z: 0.5, yaw: 0, f: 1, w: 0, g: true, r: false });
    vi.useRealTimers();
    const next = guest.others(1 / 60)[0];
    expect(next.shown!.x).toBeGreaterThan(2);
    expect(next.shown!.x).toBeLessThan(3);
  });

  it('tag passes to the touched player after the immunity period, and back', async () => {
    const { host, guest } = await setup();
    host.setMode('tag');
    vi.useFakeTimers();
    host.start();
    const guestId = guest.selfId;
    host.tag(guestId); // まだ無敵時間
    expect(guest.amIt).toBe(false);
    vi.advanceTimersByTime(TAG_IMMUNE_MS + 10);
    host.tag(guestId);
    expect(guest.amIt).toBe(true);
    expect(host.amIt).toBe(false);
    // ゲストがすぐ返そうとしても無敵時間
    guest.tag(host.selfId);
    expect(host.amIt).toBe(false);
    vi.advanceTimersByTime(TAG_IMMUNE_MS + 10);
    guest.tag(host.selfId);
    expect(host.amIt).toBe(true);
    vi.useRealTimers();
  });

  it('finish results are shared for the ranking and cleared on the next round', async () => {
    const { host, guest } = await setup();
    host.start();
    guest.finish({ outcome: 'win', score: 3, coins: 1, totalCoins: 1, timeMs: 5000, livesLeft: 3 });
    const seen = host.getSnapshot().players.find((p) => !p.isSelf)!;
    expect(seen.finished).toEqual({ outcome: 'win', timeMs: 5000, score: 3 });
    host.backToLobby();
    expect(guest.currentPhase).toBe('lobby');
    host.start();
    expect(host.getSnapshot().players.every((p) => p.finished === null)).toBe(true);
    expect(guest.getSnapshot().round).toBe(2);
  });

  it('a late guest joining mid-game gets the game and playing phase', async () => {
    const { hub, host } = await setup();
    host.start();
    const late = RoomSession.join('ABCD', { name: 'あとから', avatar }, async () => {
      const t = new MemTransport(hub);
      hub.join(t);
      return t;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(late.currentGame?.id).toBe('g1');
    expect(late.currentPhase).toBe('playing');
    expect(host.getSnapshot().players).toHaveLength(3);
  });

  it('leaving removes the player from the others', async () => {
    const { host, guest } = await setup();
    guest.leave();
    expect(host.getSnapshot().players).toHaveLength(1);
  });
});
