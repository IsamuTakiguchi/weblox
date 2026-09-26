import { useCallback, useEffect, useMemo, useState } from 'react';
import { sfx, speak } from '../audio';
import { fireConfetti, toast } from '../components/feedback';
import { AnyGameCanvas } from '../components/AnyGameCanvas';
import { Empty, Modal } from '../components/ui';
import { themeDef } from '../engine/themes';
import type { GameData, GameResult } from '../engine/types';
import { hrefFor } from '../router';
import { decodeGame, shareUrl } from '../share/codec';
import { getDraft, importToLibrary, recordPlay, recordWin, toggleLike, useStore } from '../store/store';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function shareGame(game: GameData): Promise<void> {
  const url = shareUrl(game);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${game.title || 'ゲーム'} | Weblox`, text: 'わたしがつくったゲームであそんでみて！', url });
      return;
    } catch {
      /* キャンセル時はコピーにフォールバック */
    }
  }
  const ok = await copyText(url);
  toast(ok ? '🔗 リンクをコピーしました！ともだちに送ろう' : 'リンクをコピーできませんでした');
}

interface PlayerProps {
  game: GameData;
  /** 公開済みゲームなら統計を記録する */
  published: boolean;
  shared?: boolean;
}

function ResultModal({ result, game, onRetry, published }: { result: GameResult; game: GameData; onRetry: () => void; published: boolean }) {
  const [reward, setReward] = useState<{ reward: number; newBest: boolean } | null>(null);
  useEffect(() => {
    if (result.outcome === 'win') {
      fireConfetti();
      speak('クリア！ すごい！');
      if (published) setReward(recordWin(game.id, result.score));
    } else {
      speak('ざんねん。もういっかい やってみよう');
    }
  }, [result, game.id, published]);
  const win = result.outcome === 'win';
  const secs = (result.timeMs / 1000).toFixed(1);
  return (
    <Modal>
      <div className="result">
        <div className="result-emoji">{win ? '🏆' : '💫'}</div>
        <h2>{win ? 'クリア！' : 'ざんねん…'}</h2>
        <div className="result-stats">
          <span>⭐ {result.score}</span>
          <span>
            🪙 {result.coins}/{result.totalCoins}
          </span>
          <span>⏱ {secs}秒</span>
        </div>
        {win && reward && (
          <p>
            <span className="reward">
              ◈ +{reward.reward} ウェブックス {reward.newBest ? '　🥇 ベストスコア！' : ''}
            </span>
          </p>
        )}
        <div className="modal-actions">
          <button className="btn btn-primary btn-lg" onClick={onRetry}>
            🔁 もういっかい
          </button>
          <a className="btn btn-lg" href={hrefFor({ name: 'discover' })}>
            🎮 ほかのゲーム
          </a>
        </div>
      </div>
    </Modal>
  );
}

export function GamePlayer({ game, published, shared }: PlayerProps) {
  const [result, setResult] = useState<GameResult | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const liked = useStore((s) => s.likes.includes(game.id));
  const pub = useStore((s) => s.published.find((g) => g.id === game.id));
  const best = useStore((s) => s.best[game.id]);
  const mine = Boolean(getDraft(game.id));
  const th = themeDef(game.theme);

  useEffect(() => {
    if (published) recordPlay(game.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const onFinish = useCallback((r: GameResult) => setResult(r), []);
  const retry = () => {
    sfx.tap();
    setResult(null);
    setResetKey((k) => k + 1);
  };

  return (
    <main className="page play-page">
      <div className="play-head">
        <a className="btn btn-icon" href={hrefFor({ name: 'discover' })} aria-label="もどる">
          ←
        </a>
        <h1>{game.title || 'なまえのないゲーム'}</h1>
        <span className="hint">
          {th.emoji} {th.name} · {game.rules.mode === 'platformer' ? '🦘 ジャンプ' : game.rules.mode === '3d' ? '🧊 3D' : '🚶 あるく'} · {game.authorAvatar}{' '}
          {game.author || 'あなた'}
        </span>
        <span className="spacer" />
        {best !== undefined && <span className="hint">🥇 ベスト {best}</span>}
        {pub && (
          <button
            className={liked ? 'btn btn-sm btn-pink' : 'btn btn-sm'}
            onClick={() => {
              sfx.tap();
              toggleLike(game.id);
            }}
          >
            👍 {pub.likes}
          </button>
        )}
        <button className="btn btn-sm" onClick={() => void shareGame(game)}>
          🔗 シェア
        </button>
        {shared && (
          <button
            className="btn btn-sm btn-blue"
            onClick={() => {
              importToLibrary(game);
              toast('📚 ライブラリに保存しました');
            }}
          >
            📚 ほぞん
          </button>
        )}
        {mine && (
          <a className="btn btn-sm" href={hrefFor(game.kidMode ? { name: 'kid', id: game.id } : { name: 'studio', id: game.id })}>
            ✏️ へんしゅう
          </a>
        )}
        <button className="btn btn-sm" onClick={retry}>
          🔁 リスタート
        </button>
      </div>
      {game.description && <p className="hint">{game.description}</p>}
      <AnyGameCanvas game={game} onFinish={onFinish} resetKey={resetKey} />
      {result && <ResultModal result={result} game={game} onRetry={retry} published={published} />}
    </main>
  );
}

export function PlayPage({ id }: { id: string }) {
  const game = useStore((s) => s.published.find((g) => g.id === id) ?? s.drafts.find((g) => g.id === id));
  const isPublished = useStore((s) => s.published.some((g) => g.id === id));
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
  return <GamePlayer key={game.id + game.updatedAt} game={game} published={isPublished} />;
}

export function SharedPage({ code }: { code: string }) {
  const game = useMemo(() => decodeGame(code), [code]);
  if (!game) {
    return (
      <main className="page">
        <Empty icon="🔗" title="リンクが正しくありません">
          <p>リンクが途中で切れていないか確認してください。</p>
          <a className="btn btn-primary" href={hrefFor({ name: 'home' })}>
            ホームへ
          </a>
        </Empty>
      </main>
    );
  }
  return <GamePlayer key={game.id} game={game} published={false} shared />;
}
