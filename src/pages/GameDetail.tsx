import { useMemo } from 'react';
import { sfx } from '../audio';
import { toast } from '../components/feedback';
import { AvatarBadge, Empty, GameCard, Thumbnail } from '../components/ui';
import { themeDef } from '../engine/themes';
import type { GameData, PublishedGame } from '../engine/types';
import { enterFullscreen, requestAutoStart } from '../fullscreen';
import { hrefFor, navigate } from '../router';
import { getDraft, importToLibrary, toggleLike, useStore } from '../store/store';
import { shareGame } from './Play';

/**
 * Roblox の「ゲーム詳細ページ」に相当。大きなサムネイルと ▶ ボタン、作者、統計、説明。
 * ▶ を押すと全画面でゲームが始まる。
 */
export function GameDetail({ game, shared, onPlay }: { game: GameData; shared?: boolean; onPlay: () => void }) {
  const pub = useStore((s) => s.published.find((g) => g.id === game.id));
  const liked = useStore((s) => s.likes.includes(game.id));
  const best = useStore((s) => s.best[game.id]);
  const published = useStore((s) => s.published);
  const others = useMemo(() => published.filter((g) => g.id !== game.id).slice(0, 4), [published, game.id]);
  const profile = useStore((s) => s.profile);
  const th = themeDef(game.theme);
  const mine = Boolean(getDraft(game.id));
  const modeLabel =
    game.rules.mode === '3d' ? '🧊 3D' : game.rules.mode === 'platformer' ? '🦘 ジャンプ' : game.rules.mode === 'garden' ? '🌱 はたけ' : game.rules.mode === 'fishing' ? '🎣 つり' : '🚶 あるく';
  const mini = game.rules.mode === 'garden' || game.rules.mode === 'fishing';

  const play = () => {
    sfx.tap();
    requestAutoStart();
    // ユーザー操作の直後でないと全画面にできないので、ここで要求してから遷移する
    void enterFullscreen();
    onPlay();
  };

  return (
    <main className="page">
      <div className="detail">
        <div className="detail-thumb">
          <Thumbnail game={game} />
          <button type="button" className="detail-play-overlay" onClick={play} aria-label="あそぶ">
            <span className="start-big">▶</span>
          </button>
        </div>
        <div className="detail-info">
          <h1>{game.title || 'なまえのないゲーム'}</h1>
          <div className="detail-creator">
            {mine || (!pub && !shared) ? <AvatarBadge avatar={profile.avatar} size={32} /> : <span className="detail-creator-emoji">{game.authorAvatar}</span>}
            <span>
              つくった人: <b>{game.author || profile.name}</b>
            </span>
          </div>
          <button type="button" className="btn btn-primary btn-xl detail-play" onClick={play}>
            ▶ あそぶ
          </button>
          <div className="detail-stats">
            {pub && (
              <>
                <div className="stat">
                  <div className="stat-value">▶ {pub.plays}</div>
                  <div className="stat-label">あそばれた回数</div>
                </div>
                <div className="stat">
                  <div className="stat-value">👍 {pub.likes}</div>
                  <div className="stat-label">いいね</div>
                </div>
              </>
            )}
            <div className="stat">
              <div className="stat-value">{modeLabel}</div>
              <div className="stat-label">あそびかた</div>
            </div>
            <div className="stat">
              <div className="stat-value">
                {th.emoji} {th.name}
              </div>
              <div className="stat-label">せかい</div>
            </div>
            {best !== undefined && (
              <div className="stat">
                <div className="stat-value">🥇 {best}</div>
                <div className="stat-label">ベストスコア</div>
              </div>
            )}
          </div>
          <div className="toolbar">
            {pub && (
              <button
                className={liked ? 'btn btn-pink' : 'btn'}
                onClick={() => {
                  sfx.tap();
                  toggleLike(game.id);
                }}
              >
                👍 いいね {pub.likes}
              </button>
            )}
            <button className="btn" onClick={() => void shareGame(game)}>
              🔗 シェア
            </button>
            {shared && (
              <button
                className="btn btn-blue"
                onClick={() => {
                  importToLibrary(game);
                  toast('📚 ライブラリに保存しました');
                }}
              >
                📚 ほぞん
              </button>
            )}
            {mine && (
              <a className="btn" href={hrefFor(game.kidMode ? { name: 'kid', id: game.id } : { name: 'studio', id: game.id })}>
                ✏️ へんしゅう
              </a>
            )}
          </div>
          <section className="detail-desc">
            <h3>せつめい</h3>
            <p>{game.description || 'せつめいは ありません。'}</p>
            <p className="hint">
              {game.rules.mode === 'garden'
                ? '◈ 500 コインためるとクリア · タップだけで あそべる'
                : game.rules.mode === 'fishing'
                  ? '⭐ 40 ポイントでクリア · タップだけで あそべる'
                  : game.rules.win === 'coins'
                    ? '🪙 コインをぜんぶ集めるとクリア'
                    : game.rules.win === 'both'
                      ? '🪙 コインをぜんぶ集めてから 🚩 ゴールへ'
                      : '🚩 ゴールに着くとクリア'}
              {game.rules.timeLimit > 0 ? ` · ⏱ ${game.rules.timeLimit}秒` : ''}
              {mini ? '' : ` · ❤️ ライフ ${game.rules.lives}`}
            </p>
          </section>
        </div>
      </div>

      {others.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">🎮 ほかのゲーム</h2>
            <a className="section-link" href={hrefFor({ name: 'discover' })}>
              すべて →
            </a>
          </div>
          <div className="grid">
            {others.map((g: PublishedGame) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export function GameDetailPage({ id }: { id: string }) {
  const game = useStore((s) => s.published.find((g) => g.id === id) ?? s.drafts.find((g) => g.id === id));
  if (!game) {
    return (
      <main className="page">
        <Empty icon="🫥" title="ゲームがみつかりません">
          <a className="btn btn-primary" href={hrefFor({ name: 'discover' })}>
            ゲームをさがす
          </a>
        </Empty>
      </main>
    );
  }
  return <GameDetail game={game} onPlay={() => navigate({ name: 'play', id })} />;
}
