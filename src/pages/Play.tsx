import { useCallback, useEffect, useMemo, useState } from 'react';
import { sfx, speak } from '../audio';
import { AnyGameCanvas } from '../components/AnyGameCanvas';
import { fireConfetti, toast } from '../components/feedback';
import { Empty, Modal } from '../components/ui';
import type { GameData, GameResult } from '../engine/types';
import { consumeAutoStart, enterFullscreen, exitFullscreen, lockPageZoom, resetPageView } from '../fullscreen';
import { hrefFor, navigate } from '../router';
import { decodeGame, shareUrl } from '../share/codec';
import { getDraft, recordPlay, recordWin, useStore } from '../store/store';
import { GameDetail } from './GameDetail';

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

/** ゲームをやめてホームへ（ヘッダーが見えない状態でも確実に戻れるように、メニューにも置く） */
function goHome(): void {
  sfx.tap();
  void exitFullscreen();
  resetPageView();
  navigate({ name: 'home' });
}

function ResultModal({ result, game, onRetry, onLeave, published }: { result: GameResult; game: GameData; onRetry: () => void; onLeave: () => void; published: boolean }) {
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
          <button className="btn btn-lg" onClick={onLeave}>
            🚪 やめる
          </button>
          <button className="btn btn-lg" onClick={goHome}>
            🏠 ホームへ
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PauseMenu({ onResume, onRestart, onLeave, game }: { onResume: () => void; onRestart: () => void; onLeave: () => void; game: GameData }) {
  const is3d = game.rules.mode === '3d';
  const platformer = game.rules.mode === 'platformer';
  const mini = game.rules.mode === 'garden' || game.rules.mode === 'fishing';
  if (mini) {
    return (
      <Modal onClose={onResume}>
        <div className="pause-menu">
          <div className="pause-head">
            <img src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="" width={40} height={40} />
            <h2>{game.title || 'なまえのないゲーム'}</h2>
          </div>
          <div className="pause-actions">
            <button className="btn btn-primary btn-lg" onClick={onResume}>
              ▶ つづける
            </button>
            <button className="btn btn-lg" onClick={onRestart}>
              🔁 さいしょから
            </button>
            <button className="btn btn-lg btn-danger" onClick={onLeave}>
              🚪 ゲームをやめる
            </button>
            <button className="btn btn-lg" onClick={goHome}>
              🏠 ホームへ
            </button>
          </div>
          <div className="pause-help">
            <h3>そうさほうほう</h3>
            <p className="hint">
              {game.rules.mode === 'garden'
                ? 'したの タネをえらんで、あいている はたけをタップ。💧 のはたけをタップすると みずやり。そだったらタップで しゅうかく！'
                : '画面をタップして さおをなげる。「！」が出たら、みどりのゾーンに マーカーが来たしゅんかんに タップ！'}
            </p>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onResume}>
      <div className="pause-menu">
        <div className="pause-head">
          <img src={`${import.meta.env.BASE_URL}icons/logo.svg`} alt="" width={40} height={40} />
          <h2>{game.title || 'なまえのないゲーム'}</h2>
        </div>
        <div className="pause-actions">
          <button className="btn btn-primary btn-lg" onClick={onResume}>
            ▶ つづける
          </button>
          <button className="btn btn-lg" onClick={onRestart}>
            🔁 さいしょから
          </button>
          <button className="btn btn-lg btn-danger" onClick={onLeave}>
            🚪 ゲームをやめる
          </button>
          <button className="btn btn-lg" onClick={goHome}>
            🏠 ホームへ
          </button>
        </div>
        <div className="pause-help">
          <h3>そうさほうほう</h3>
          <div className="pause-help-grid">
            <div>
              <b>📱 スマホ・タブレット</b>
              <ul>
                <li>画面の<b>左側</b>をなぞる → うごく（ジョイスティック）</li>
                {(is3d || platformer) && <li>右下の <b>⬆ ボタン</b> → ジャンプ</li>}
                {is3d && <li>画面の<b>右側</b>をなぞる → カメラをまわす</li>}
                {is3d && <li>2 本の指でひらく・とじる → ズーム</li>}
              </ul>
            </div>
            <div>
              <b>⌨️ パソコン</b>
              <ul>
                <li>
                  <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> か 矢印キー → うごく
                </li>
                {(is3d || platformer) && (
                  <li>
                    <kbd>スペース</kbd> → ジャンプ
                  </li>
                )}
                {is3d && <li>マウスをドラッグ → カメラをまわす</li>}
                {is3d && (
                  <li>
                    ホイール / <kbd>I</kbd> <kbd>O</kbd> → ズーム
                  </li>
                )}
                <li>
                  <kbd>Esc</kbd> → このメニュー
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface PlayerProps {
  game: GameData;
  /** 公開済みゲームなら統計を記録する */
  published: boolean;
  /** 「やめる」で戻る先 */
  onLeave: () => void;
  autoStart?: boolean;
}

/** 全画面のゲームプレイ画面（Roblox でゲームに入ったときの画面） */
export function GamePlayer({ game, published, onLeave, autoStart = false }: PlayerProps) {
  const [result, setResult] = useState<GameResult | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (published) recordPlay(game.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  // ページの上下（ヘッダーなど）を隠して、画面いっぱいにする。
  // プレイ中はページのピンチズームを止め、やめたあとは倍率とスクロールを元に戻す
  useEffect(() => {
    document.body.classList.add('immersive-open');
    const unlock = lockPageZoom();
    return () => {
      document.body.classList.remove('immersive-open');
      unlock();
      resetPageView();
    };
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !result) {
        e.preventDefault();
        setMenu((m) => !m);
      }
      if (e.code === 'KeyF' && !e.repeat) void enterFullscreen();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [result]);

  const onFinish = useCallback((r: GameResult) => setResult(r), []);
  const retry = () => {
    sfx.tap();
    setResult(null);
    setMenu(false);
    setResetKey((k) => k + 1);
  };
  const leave = () => {
    sfx.tap();
    void exitFullscreen();
    resetPageView();
    onLeave();
  };

  return (
    <div className="immersive">
      <AnyGameCanvas
        game={game}
        onFinish={onFinish}
        resetKey={resetKey}
        autoStart={autoStart}
        paused={menu || Boolean(result)}
        onMenu={() => {
          sfx.tap();
          setMenu(true);
        }}
        fullscreenButton
      />
      {menu && !result && <PauseMenu game={game} onResume={() => setMenu(false)} onRestart={retry} onLeave={leave} />}
      {result && <ResultModal result={result} game={game} onRetry={retry} onLeave={leave} published={published} />}
    </div>
  );
}

export function PlayPage({ id }: { id: string }) {
  const game = useStore((s) => s.published.find((g) => g.id === id) ?? s.drafts.find((g) => g.id === id));
  const isPublished = useStore((s) => s.published.some((g) => g.id === id));
  // 「▶ あそぶ」から来たときだけ自動スタート（id が変わるたびに判定し直す）
  const auto = useMemo(() => consumeAutoStart(), [id]);
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
  return (
    <GamePlayer
      key={game.id + game.updatedAt}
      game={game}
      published={isPublished}
      autoStart={auto}
      onLeave={() => navigate(getDraft(game.id) || isPublished ? { name: 'game', id: game.id } : { name: 'discover' })}
    />
  );
}

export function SharedPage({ code, play }: { code: string; play?: boolean }) {
  const game = useMemo(() => decodeGame(code), [code]);
  // 詳細 → プレイに切り替わるときに判定する（同じコンポーネントが使い回されるため）
  const auto = useMemo(() => (play ? consumeAutoStart() : false), [play, code]);
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
  if (play) {
    return <GamePlayer key={game.id} game={game} published={false} autoStart={auto} onLeave={() => navigate({ name: 'shared', code })} />;
  }
  return <GameDetail game={game} shared onPlay={() => navigate({ name: 'shared', code, play: true })} />;
}
