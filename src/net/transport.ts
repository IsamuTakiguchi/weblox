/**
 * マルチプレイ用の通信レイヤー。
 *
 *  - TrysteroTransport: WebRTC で端末同士を直接つなぐ（サーバー不要。接続のきっかけだけ
 *    公開の Nostr 中継を使う）。ちがう端末・ちがうネットワークで遊ぶときはこちら
 *  - LocalTransport: 同じブラウザのタブ同士を BroadcastChannel でつなぐ（動作確認・テスト用）
 *
 * どちらも「部屋コード」で同じ部屋に入った相手にメッセージを送る、という同じ形で使える。
 */

export type NetMessage = { type: string; data: unknown };

export interface Transport {
  readonly selfId: string;
  readonly kind: 'p2p' | 'local';
  send(type: string, data: unknown, to?: string): void;
  onMessage(cb: (type: string, data: unknown, from: string) => void): void;
  onPeerJoin(cb: (id: string) => void): void;
  onPeerLeave(cb: (id: string) => void): void;
  peers(): string[];
  close(): void;
}

export function randomId(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  const arr = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}

/** 部屋コード（まぎらわしい文字をのぞいた大文字 4 文字） */
export function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < 4; i++) arr[i] = Math.floor(Math.random() * 256);
  return [...arr].map((n) => chars[n % chars.length]).join('');
}

export function normalizeRoomCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .slice(0, 4);
}

/* ---------- 同じブラウザのタブ同士（テスト用） ---------- */

type LocalEnvelope =
  | { t: 'join'; id: string }
  | { t: 'here'; id: string; to: string }
  | { t: 'leave'; id: string }
  | { t: 'msg'; from: string; to?: string; type: string; data: unknown };

export class LocalTransport implements Transport {
  readonly selfId = randomId();
  readonly kind = 'local' as const;
  private ch: BroadcastChannel;
  private known = new Set<string>();
  private msgCb: ((type: string, data: unknown, from: string) => void) | null = null;
  private joinCb: ((id: string) => void) | null = null;
  private leaveCb: ((id: string) => void) | null = null;
  private onHide = () => this.close();

  constructor(code: string) {
    this.ch = new BroadcastChannel(`weblox-room-${code}`);
    this.ch.onmessage = (ev: MessageEvent<LocalEnvelope>) => this.handle(ev.data);
    this.ch.postMessage({ t: 'join', id: this.selfId } satisfies LocalEnvelope);
    window.addEventListener('pagehide', this.onHide);
  }

  private handle(m: LocalEnvelope): void {
    switch (m.t) {
      case 'join':
        if (!this.known.has(m.id)) {
          this.known.add(m.id);
          this.joinCb?.(m.id);
        }
        this.ch.postMessage({ t: 'here', id: this.selfId, to: m.id } satisfies LocalEnvelope);
        break;
      case 'here':
        if (m.to === this.selfId && !this.known.has(m.id)) {
          this.known.add(m.id);
          this.joinCb?.(m.id);
        }
        break;
      case 'leave':
        if (this.known.delete(m.id)) this.leaveCb?.(m.id);
        break;
      case 'msg':
        if (m.to && m.to !== this.selfId) return;
        this.msgCb?.(m.type, m.data, m.from);
        break;
    }
  }

  send(type: string, data: unknown, to?: string): void {
    this.ch.postMessage({ t: 'msg', from: this.selfId, to, type, data } satisfies LocalEnvelope);
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
    return [...this.known];
  }
  close(): void {
    window.removeEventListener('pagehide', this.onHide);
    try {
      this.ch.postMessage({ t: 'leave', id: this.selfId } satisfies LocalEnvelope);
      this.ch.close();
    } catch {
      /* noop */
    }
  }
}

/* ---------- WebRTC（Trystero）：ちがう端末同士 ---------- */

interface TrysteroRoom {
  makeAction: <T>(name: string, cfg?: { onMessage?: (data: T, ctx: { peerId: string }) => void }) => { send: (data: T, opts?: { target?: string | string[] | null }) => Promise<void> };
  onPeerJoin: ((id: string) => void) | null;
  onPeerLeave: ((id: string) => void) | null;
  getPeers: () => Record<string, unknown>;
  leave: () => Promise<void>;
}

const APP_ID = 'weblox-play-v1';

export class TrysteroTransport implements Transport {
  readonly kind = 'p2p' as const;
  readonly selfId: string;
  private room: TrysteroRoom;
  private known = new Set<string>();
  private msgCb: ((type: string, data: unknown, from: string) => void) | null = null;
  private joinCb: ((id: string) => void) | null = null;
  private leaveCb: ((id: string) => void) | null = null;
  private sendMsg: (data: { type: string; data: unknown }, opts?: { target?: string | string[] | null }) => Promise<void>;

  private constructor(room: TrysteroRoom, selfId: string) {
    this.room = room;
    this.selfId = selfId;
    const action = room.makeAction<{ type: string; data: unknown }>('wbx', {
      onMessage: (m, ctx) => this.msgCb?.(m.type, m.data, ctx.peerId),
    });
    this.sendMsg = action.send;
    room.onPeerJoin = (id) => {
      this.known.add(id);
      this.joinCb?.(id);
    };
    room.onPeerLeave = (id) => {
      this.known.delete(id);
      this.leaveCb?.(id);
    };
  }

  static async connect(code: string): Promise<TrysteroTransport> {
    const mod = (await import('trystero')) as unknown as {
      joinRoom: (cfg: { appId: string; password?: string }, roomId: string) => TrysteroRoom;
      selfId: string;
    };
    const room = mod.joinRoom({ appId: APP_ID }, `room-${code}`);
    return new TrysteroTransport(room, mod.selfId);
  }

  send(type: string, data: unknown, to?: string): void {
    void this.sendMsg({ type, data }, to ? { target: to } : undefined).catch(() => {});
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
    return Object.keys(this.room.getPeers());
  }
  close(): void {
    void this.room.leave().catch(() => {});
  }
}

/** テスト・同一端末確認用に BroadcastChannel を使うか（localStorage の weblox.net = local） */
export function preferLocalTransport(): boolean {
  try {
    return localStorage.getItem('weblox.net') === 'local' || (window as unknown as { __weblox_net?: string }).__weblox_net === 'local';
  } catch {
    return false;
  }
}

export async function openTransport(code: string): Promise<Transport> {
  if (preferLocalTransport() || typeof RTCPeerConnection === 'undefined') return new LocalTransport(code);
  try {
    return await TrysteroTransport.connect(code);
  } catch {
    return new LocalTransport(code);
  }
}
