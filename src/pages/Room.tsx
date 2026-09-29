import { useEffect, useState } from 'react';
import { sfx } from '../audio';
import { toast } from '../components/feedback';
import { AvatarBadge, Empty, Thumbnail } from '../components/ui';
import type { GameData, GameResult } from '../engine/types';
import { enterFullscreen, exitFullscreen } from '../fullscreen';
import { currentRoom, RoomSession, roomUrl, setCurrentRoom, TAG_SECONDS, useCurrentRoom, useRoomSnapshot, type RoomMode } from '../net/room';
import { hrefFor, navigate } from '../router';
import { getState } from '../store/store';
import { GamePlayer } from './Play';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 部屋への招待（リンク共有） */
async function invite(code: string): Promise<void> {
  const url = roomUrl(code);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `Weblox いっしょにあそぼう（${code}）`, text: `あいことば: ${code}`, url });
      return;
    } catch {
      /* キャンセル時はコピー */
    }
  }
  const ok = await copyText(url);
  toast(ok ? '🔗 さそいリンクをコピーしました' : `あいことば: ${code}`);
}

/** 部屋がなければコードで入る（招待リンクから来たとき） */
function ensureRoom(code: string): RoomSession {
  const cur = currentRoom();
  if (cur && cur.code === code) return cur;
  const me = { name: getState().profile.name, avatar: getState().profile.avatar };
  const r = RoomSession.join(code, me);
  setCurrentRoom(r);
  return r;
}

export function RoomPage({ code, play }: { code: string; play?: boolean }) {
  const [room] = useState(() => ensureRoom(code));
  useCurrentRoom();
  const snap = useRoomSnapshot(room);

  // ホストがスタートしたら全員プレイ画面へ、ロビーに戻したら全員ロビーへ
  useEffect(() => {
    if (!snap) return;
    if (snap.phase === 'playing' && !play) {
      void enterFullscreen();
      navigate({ name: 'room', code, play: true });
    }
    if (snap.phase === 'lobby' && play) navigate({ name: 'room', code });
  }, [snap, play, code]);

  if (!snap) return null;
  if (play && snap.phase === 'playing' && snap.game) return <RoomPlay room={room} game={snap.game} />;
  return <Lobby room={room} />;
}

function Lobby({ room }: { room: RoomSession }) {
  const snap = useRoomSnapshot(room)!;
  const leave = () => {
    sfx.tap();
    setCurrentRoom(null);
    navigate(snap.game ? { name: 'game', id: snap.game.id } : { name: 'home' });
  };
  const start = () => {
    sfx.tap();
    room.start();
    void enterFullscreen();
    navigate({ name: 'room', code: snap.code, play: true });
  };
  const modeBtn = (m: RoomMode, label: string, hint: string) => (
    <button
      className={`choice ${snap.mode === m ? 'selected' : ''}`}
      disabled={!snap.isHost}
      onClick={() => {
        sfx.tap();
        room.setMode(m);
      }}
    >
      <span className="choice-emoji">{m === 'race' ? '🏁' : '👹'}</span>
      <span>{label}</span>
      <span className="hint">{hint}</span>
    </button>
  );

  return (
    <main className="page">
      <div className="play-head" style={{ marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={leave}>
          ← さんかを やめる
        </button>
        <h1 style={{ fontSize: 22 }}>👥 いっしょにあそぶ</h1>
      </div>

      {snap.error && (
        <Empty icon="📡" title="つなげませんでした">
          <p>{snap.error}</p>
          <button className="btn btn-primary" onClick={leave}>
            もどる
          </button>
        </Empty>
      )}

      <div className="room">
        <section className="card room-code-card">
          <div className="hint">あいことば（部屋コード）</div>
          <div className="room-code" aria-label={`部屋コード ${snap.code}`}>
            {snap.code}
          </div>
          <p className="hint">
            ほかの端末で「🔑 コードで さんか」にこの 4 文字を入れるか、さそいリンクを送ってね。
            {snap.transport === 'local' && <b>（同じブラウザのタブどうしでつながるテストモード）</b>}
            {snap.transport === null && !snap.error && ' つないでいます…'}
          </p>
          <div className="toolbar">
            <button className="btn btn-blue" onClick={() => void invite(snap.code)}>
              🔗 さそう（リンクを送る）
            </button>
            <button className="btn" onClick={() => void copyText(snap.code).then((ok) => toast(ok ? 'あいことばをコピーしました' : snap.code))}>
              📋 あいことばをコピー
            </button>
          </div>
        </section>

        <section className="card">
          <h3>ゲーム</h3>
          {snap.game ? (
            <div className="room-game">
              <div style={{ width: 200 }}>
                <Thumbnail game={snap.game} />
              </div>
              <div>
                <b style={{ fontSize: 18 }}>{snap.game.title || 'なまえのないゲーム'}</b>
                <p className="hint">{snap.game.description}</p>
              </div>
            </div>
          ) : (
            <p className="hint">ホストからゲームを受け取っています…（ホストがまだ部屋を開いていないときは、開くまで待ってね）</p>
          )}
          <h3 style={{ marginTop: 14 }}>あそびかた</h3>
          <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(140px, 240px))' }}>
            {modeBtn('race', 'きょうそう', 'だれが いちばん はやく クリアできるか')}
            {modeBtn('tag', 'おにごっこ', `ホストが おに。タッチで うつる。${TAG_SECONDS} 秒で おに だった人の負け`)}
          </div>
          {!snap.isHost && <p className="hint">あそびかたは ホストが えらびます。</p>}
        </section>

        <section className="card">
          <h3>
            メンバー <span className="hint">{snap.players.length} 人</span>
          </h3>
          <ul className="room-members">
            {snap.players.map((p) => (
              <li key={p.id}>
                <AvatarBadge avatar={p.avatar} size={36} />
                <b>{p.name}</b>
                {p.isHost && <span className="badge">ホスト</span>}
                {p.isSelf && <span className="badge badge-blue">あなた</span>}
              </li>
            ))}
          </ul>
          {snap.players.length < 2 && <p className="hint">ともだちが 入ってくるのを まっています…</p>}
        </section>

        <div className="kid-actions">
          {snap.isHost ? (
            <button className="btn btn-primary btn-xl" onClick={start} disabled={!snap.game}>
              ▶ みんなで スタート
            </button>
          ) : (
            <p className="hint" style={{ fontSize: 16 }}>
              ホストが スタートするのを まってね…
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function RoomPlay({ room, game }: { room: RoomSession; game: GameData }) {
  const snap = useRoomSnapshot(room)!;
  // おにごっこ ではゲームのルールを「時間まで生きのこる」に置きかえる
  const played = snap.mode === 'tag' ? { ...game, rules: { ...game.rules, win: 'survive' as const, timeLimit: TAG_SECONDS, lives: 9 } } : game;
  const onLeave = () => {
    void exitFullscreen();
    room.backToLobby();
    navigate({ name: 'room', code: snap.code });
  };
  const onFinish = (r: GameResult) => {
    // おにごっこ：時間切れのとき おに なら負け
    const result = snap.mode === 'tag' ? { ...r, outcome: room.amIt ? ('lose' as const) : ('win' as const) } : r;
    room.finish(result);
    return result;
  };
  return <GamePlayer key={`${snap.code}-${snap.round}`} game={played} published={false} autoStart onLeave={onLeave} room={room} transformResult={onFinish} />;
}

/** ホームなどに置く「コードで さんか」フォーム */
export function JoinRoomForm() {
  const [code, setCode] = useState('');
  const cur = useCurrentRoom();
  const go = () => {
    const c = code
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);
    if (c.length !== 4) {
      toast('あいことばは 4 文字です');
      return;
    }
    sfx.tap();
    navigate({ name: 'room', code: c });
  };
  return (
    <div className="join-form">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go();
        }}
        placeholder="あいことば（4文字）"
        aria-label="あいことば"
        maxLength={4}
        autoCapitalize="characters"
        autoComplete="off"
      />
      <button className="btn btn-blue" onClick={go}>
        🔑 コードで さんか
      </button>
      {cur && (
        <a className="btn" href={hrefFor({ name: 'room', code: cur.code })}>
          👥 いまの部屋（{cur.code}）へ
        </a>
      )}
    </div>
  );
}
