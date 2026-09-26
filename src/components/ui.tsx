import { useEffect, useRef, type ReactNode } from 'react';
import { canSpeak, isSpeechEnabled, setSpeechEnabled, sfx, speak } from '../audio';
import { renderStatic } from '../engine/render';
import { themeDef } from '../engine/themes';
import type { GameData, PublishedGame } from '../engine/types';
import { hrefFor, type Route } from '../router';
import { HATS, useStore, type AvatarConfig } from '../store/store';

/* ---------- アバター ---------- */

export function AvatarBadge({ avatar, size = 40 }: { avatar: AvatarConfig; size?: number }) {
  const hat = HATS.find((h) => h.id === avatar.hat)?.emoji ?? '';
  return (
    <span className="avatar" style={{ width: size, height: size, background: avatar.color, fontSize: size * 0.6 }} aria-hidden>
      <span className="avatar-face">{avatar.face}</span>
      {hat && (
        <span className="avatar-hat" style={{ fontSize: size * 0.5, top: -size * 0.32 }}>
          {hat}
        </span>
      )}
    </span>
  );
}

/* ---------- ヘッダー ---------- */

export function Header({ route }: { route: Route }) {
  const profile = useStore((s) => s.profile);
  const is = (n: Route['name']) => (route.name === n ? 'nav-link active' : 'nav-link');
  return (
    <header className="header">
      <a className="brand" href="#/" aria-label="Weblox ホーム">
        <span className="brand-logo">▣</span>
        <span className="brand-name">Weblox</span>
      </a>
      <nav className="nav" aria-label="メインメニュー">
        <a className={is('discover')} href={hrefFor({ name: 'discover' })}>
          <span className="nav-icon">🎮</span>
          <span>あそぶ</span>
        </a>
        <a className={route.name === 'create' || route.name === 'kid' || route.name === 'studio' ? 'nav-link active' : 'nav-link'} href="#/create">
          <span className="nav-icon">🛠️</span>
          <span>つくる</span>
        </a>
        <a className={is('avatar')} href="#/avatar">
          <span className="nav-icon">🧢</span>
          <span>アバター</span>
        </a>
      </nav>
      <a className="wallet" href="#/me" title="ウェブックス（アプリ内コイン）">
        <span className="wbx">◈ {profile.wbx}</span>
        <AvatarBadge avatar={profile.avatar} size={34} />
      </a>
    </header>
  );
}

/* ---------- サムネイル ---------- */

export function Thumbnail({ game, className }: { game: GameData; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    renderStatic(ctx, game, c.width, c.height);
  }, [game]);
  return <canvas ref={ref} width={320} height={200} className={className ?? 'thumb'} aria-hidden />;
}

/* ---------- ゲームカード ---------- */

export function GameCard({ game, onClick }: { game: PublishedGame | GameData; onClick?: () => void }) {
  const pub = game as Partial<PublishedGame>;
  const th = themeDef(game.theme);
  const body = (
    <>
      <div className="card-thumb">
        <Thumbnail game={game} />
        <span className="card-badge">
          {th.emoji} {game.rules.mode === 'platformer' ? '🦘' : game.rules.mode === '3d' ? '🧊 3D' : '🚶'}
        </span>
      </div>
      <div className="card-body">
        <div className="card-title">{game.title || 'なまえのないゲーム'}</div>
        <div className="card-meta">
          <span>
            {game.authorAvatar} {game.author || 'あなた'}
          </span>
          {typeof pub.plays === 'number' && (
            <span className="card-stats">
              ▶ {pub.plays} · 👍 {pub.likes}
            </span>
          )}
        </div>
      </div>
    </>
  );
  if (onClick) {
    return (
      <button className="card" onClick={onClick}>
        {body}
      </button>
    );
  }
  return (
    <a className="card" href={hrefFor({ name: 'play', id: game.id })}>
      {body}
    </a>
  );
}

/* ---------- モーダル ---------- */

export function Modal({ children, onClose, big }: { children: ReactNode; onClose?: () => void; big?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className={big ? 'modal modal-big' : 'modal'} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ---------- よみあげボタン ---------- */

export function SpeakButton({ text, label }: { text: string; label?: string }) {
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost speak"
      onClick={() => {
        sfx.tap();
        speak(text, true);
      }}
      aria-label={label ?? 'よみあげる'}
      title="よみあげる"
    >
      🔊
    </button>
  );
}

export function SpeechToggle() {
  const on = isSpeechEnabled();
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        setSpeechEnabled(!on);
        if (!on) speak('よみあげを おんにしたよ', true);
        location.reload();
      }}
      title="ボタンや説明をこえで読む"
    >
      {on ? '🔊 よみあげ オン' : '🔇 よみあげ オフ'}
    </button>
  );
}

/* ---------- 空状態 ---------- */

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {children}
    </div>
  );
}
