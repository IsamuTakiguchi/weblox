import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio';
import { fireConfetti, toast } from '../components/feedback';
import { AnyGameCanvas } from '../components/AnyGameCanvas';
import { GridEditor } from '../components/GridEditor';
import { Modal } from '../components/ui';
import { autoFix, createGame, defaultRules, emptyTiles, ENEMY_EMOJIS, fillAll, fillFloor, FLOOD_OPTIONS, GRID_SIZES, randomLevel, resizeTiles, validateGame } from '../engine/level';
import { HEROES, THEMES } from '../engine/themes';
import { PRO_PALETTE, tileDef } from '../engine/tiles';
import type { GameData, GameMode, GameResult, TileId, WinCondition } from '../engine/types';
import { hrefFor, navigate } from '../router';
import { exportJson, importJson } from '../share/codec';
import { shareGame } from './Play';
import { deleteDraft, getDraft, getPublished, getState, publishGame, saveDraft, unpublishGame, useStore } from '../store/store';

export function StudioPage({ id }: { id?: string }) {
  const profile = getState().profile;
  const [game, setGame] = useState<GameData>(() => {
    const existing = id ? getDraft(id) ?? getPublished(id) : undefined;
    if (existing) return { ...existing };
    return createGame({
      kidMode: false,
      author: profile.name,
      authorAvatar: profile.avatar.face,
      width: 16,
      height: 10,
      rules: defaultRules('platformer'),
      tiles: fillFloor(emptyTiles(16, 10), 16, 10),
    });
  });
  const [tool, setTool] = useState<TileId>('ground');
  const [testing, setTesting] = useState(false);
  const [testKey, setTestKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [cell, setCell] = useState(32);
  const fileRef = useRef<HTMLInputElement>(null);
  const isPublished = useStore((s) => s.published.some((g) => g.id === game.id));
  const isFeatured = useStore((s) => s.published.find((g) => g.id === game.id)?.featured ?? false);

  useEffect(() => {
    const calc = () => {
      const avail = window.innerWidth >= 1100 ? window.innerWidth - 640 : window.innerWidth - 60;
      setCell(Math.max(18, Math.min(44, Math.floor(Math.min(avail, 900) / game.width) - 1)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [game.width]);

  const update = useCallback((patch: Partial<GameData>) => {
    setGame((g) => ({ ...g, ...patch }));
    setDirty(true);
  }, []);
  const updateRules = (patch: Partial<GameData['rules']>) => update({ rules: { ...game.rules, ...patch } });
  const onTiles = useCallback((tiles: string) => {
    setGame((g) => ({ ...g, tiles }));
    setDirty(true);
  }, []);

  const issues = useMemo(() => validateGame(game), [game]);
  const hasErrors = issues.some((i) => i.level === 'error');

  const save = () => {
    // 同梱ゲームを編集した場合は自分のコピーとして保存する
    const g = isFeatured ? { ...game, id: `${game.id}_copy_${Date.now().toString(36)}`, author: profile.name, authorAvatar: profile.avatar.face } : game;
    if (g.id !== game.id) setGame(g);
    saveDraft(g);
    setDirty(false);
    toast('💾 保存しました');
    if (g.id !== id) navigate({ name: 'studio', id: g.id });
  };

  const publish = () => {
    if (hasErrors) {
      toast('⚠️ エラーを直してから公開してください');
      return;
    }
    const g = isFeatured ? { ...game, id: `${game.id}_copy_${Date.now().toString(36)}`, author: profile.name, authorAvatar: profile.avatar.face } : game;
    const pub = publishGame(g);
    saveDraft(pub);
    setGame(pub);
    setDirty(false);
    fireConfetti();
    sfx.win();
    toast(`🌍 「${pub.title}」を公開しました！`);
    if (pub.id !== id) navigate({ name: 'studio', id: pub.id });
  };

  const resize = (w: number, h: number) => {
    update({ width: w, height: h, tiles: resizeTiles(game.tiles, game.width, game.height, w, h) });
  };

  const setMode = (mode: GameMode) => {
    let tiles = game.tiles;
    if (mode === 'platformer' && game.rules.mode !== 'platformer') tiles = fillFloor(tiles, game.width, game.height);
    if (mode === '3d' && game.rules.mode !== '3d') tiles = fillAll(tiles, 'ground');
    update({ tiles, rules: { ...game.rules, mode } });
  };

  const doExport = () => {
    const blob = new Blob([exportJson(game)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${game.title || 'weblox-game'}.weblox.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doImport = async (file: File) => {
    const text = await file.text();
    const g = importJson(text);
    if (!g) {
      toast('⚠️ 読み込めないファイルです');
      return;
    }
    setGame({ ...g, id: game.id });
    setDirty(true);
    toast('📥 読み込みました');
  };

  const onTestFinish = (r: GameResult) => {
    setTesting(false);
    toast(r.outcome === 'win' ? `🏆 クリア！ ${(r.timeMs / 1000).toFixed(1)}秒` : '💫 ゲームオーバー');
  };

  const prepared = useMemo(() => autoFix(game), [game]);
  const range = (label: string, key: 'speed' | 'jump' | 'lives' | 'enemySpeed', min: number, max: number, hint?: string) => (
    <div className="field">
      <label>
        {label}: <b>{game.rules[key]}</b> {hint && <span className="hint">({hint})</span>}
      </label>
      <div className="field-row">
        <input type="range" min={min} max={max} value={game.rules[key]} onChange={(e) => updateRules({ [key]: Number(e.target.value) })} />
      </div>
    </div>
  );

  return (
    <main className="page page-wide">
      <div className="play-head" style={{ marginBottom: 12 }}>
        <a className="btn btn-icon" href={hrefFor({ name: 'create' })} aria-label="もどる">
          ←
        </a>
        <h1 style={{ fontSize: 22 }}>🛠️ スタジオ</h1>
        <span className="hint">
          {isFeatured ? 'サンプルを編集中（保存すると自分のコピーになります）' : isPublished ? '🌍 公開中' : '下書き'}
          {dirty ? ' · 未保存' : ''}
        </span>
        <span className="spacer" />
        <div className="toolbar">
          <button className="btn btn-sm" onClick={save}>
            💾 保存
          </button>
          <button
            className="btn btn-sm btn-blue"
            onClick={() => {
              setTestKey((k) => k + 1);
              setTesting(true);
            }}
          >
            ▶ テストプレイ
          </button>
          <button className="btn btn-sm btn-primary" onClick={publish} disabled={hasErrors}>
            🌍 {isPublished && !isFeatured ? '更新して公開' : '公開'}
          </button>
          <button className="btn btn-sm" onClick={() => void shareGame(prepared)} disabled={hasErrors}>
            🔗 リンク
          </button>
        </div>
      </div>

      <div className="studio">
        <aside className="panel">
          <h3>パーツ</h3>
          <div className="palette palette-pro">
            {PRO_PALETTE.map((t) => {
              const d = tileDef(t);
              return (
                <button key={t} className={`palette-btn ${tool === t ? 'selected' : ''}`} onClick={() => setTool(t)} title={d.hint} aria-pressed={tool === t}>
                  <span className="palette-emoji">{t === 'start' ? game.hero : t === 'enemy' ? (game.enemyEmoji ?? d.emoji) : d.emoji}</span>
                  <span>{d.label}</span>
                </button>
              );
            })}
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            {tileDef(tool).emoji} {tileDef(tool).label}：{tileDef(tool).hint}
          </p>
          <h3 style={{ marginTop: 16 }}>マップ</h3>
          <div className="field">
            <label>サイズ</label>
            <select
              value={`${game.width}x${game.height}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                resize(w, h);
              }}
            >
              {GRID_SIZES.map((s) => (
                <option key={s.label} value={`${s.width}x${s.height}`}>
                  {s.label}
                </option>
              ))}
              {!GRID_SIZES.some((s) => s.width === game.width && s.height === game.height) && (
                <option value={`${game.width}x${game.height}`}>
                  {game.width}×{game.height}
                </option>
              )}
            </select>
          </div>
          <div className="editor-tools">
            <button className="btn btn-sm" onClick={() => update({ tiles: randomLevel(game.width, game.height, game.rules.mode) })}>
              🎲 おまかせ
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                if (confirm('マップをぜんぶ消しますか？')) update({ tiles: emptyTiles(game.width, game.height) });
              }}
            >
              🗑️ クリア
            </button>
          </div>
          <div className="issues">
            {issues.map((i, n) => (
              <div key={n} className={`issue issue-${i.level}`}>
                {i.level === 'error' ? '⛔' : '⚠️'} {i.message}
              </div>
            ))}
            {issues.length === 0 && <div className="issue" style={{ background: 'rgba(0,176,111,0.15)', color: '#86efac' }}>✅ 公開できます</div>}
          </div>
        </aside>

        <section>
          <GridEditor game={game} tool={tool} onChange={onTiles} cell={cell} />
          <p className="hint" style={{ marginTop: 8 }}>
            クリック／タッチでパーツを置く。ドラッグでまとめて置ける。「けす」で消す。
          </p>
        </section>

        <aside className="panel">
          <h3>ゲームの情報</h3>
          <div className="field">
            <label>タイトル</label>
            <input value={game.title} onChange={(e) => update({ title: e.target.value.slice(0, 60) })} placeholder="ゲームのタイトル" />
          </div>
          <div className="field">
            <label>説明</label>
            <textarea rows={3} value={game.description} onChange={(e) => update({ description: e.target.value.slice(0, 300) })} placeholder="どんなゲーム？ あそびかたのヒントなど" />
          </div>
          <div className="field">
            <label>テーマ</label>
            <div className="seg" style={{ flexWrap: 'wrap' }}>
              {THEMES.map((t) => (
                <button key={t.id} className={game.theme === t.id ? 'on' : ''} onClick={() => update({ theme: t.id })} title={t.name}>
                  {t.emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>主人公</label>
            <div className="seg" style={{ flexWrap: 'wrap' }}>
              {HEROES.map((h) => (
                <button key={h} className={game.hero === h ? 'on' : ''} onClick={() => update({ hero: h })}>
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>てき（きょうりゅう・おばけなどに変えられる）</label>
            <div className="seg" style={{ flexWrap: 'wrap' }}>
              {ENEMY_EMOJIS.map((e) => (
                <button key={e} className={(game.enemyEmoji ?? '👾') === e ? 'on' : ''} onClick={() => update({ enemyEmoji: e === '👾' ? undefined : e })}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>ルール</h3>
          <div className="field">
            <label>見かた</label>
            <div className="seg">
              <button className={game.rules.mode === 'topdown' ? 'on' : ''} onClick={() => setMode('topdown')}>
                🚶 あるく（上から）
              </button>
              <button className={game.rules.mode === 'platformer' ? 'on' : ''} onClick={() => setMode('platformer')}>
                🦘 ジャンプ（横から）
              </button>
              <button className={game.rules.mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>
                🧊 3D（立体）
              </button>
            </div>
            {game.rules.mode === '3d' && (
              <span className="hint">3D では「けす」で空けたマスが奈落になります。かべは高さ 3、くもは浮いた足場。「レール」をつなげるとコースター、「おに」は追いかけてくる、「きえるゆか」は乗るとくずれます。</span>
            )}
          </div>
          <div className="field">
            <label>クリア条件</label>
            <select
              value={game.rules.win}
              onChange={(e) => {
                const win = e.target.value as WinCondition;
                updateRules(win === 'survive' && game.rules.timeLimit <= 0 ? { win, timeLimit: 60 } : { win });
              }}
            >
              <option value="goal">🚩 ゴールに着く</option>
              <option value="coins">🪙 コインをぜんぶ集める</option>
              <option value="both">🪙→🚩 コインをぜんぶ集めてゴール</option>
              <option value="survive">⏱ 時間まで 生きのこる（おに・みずから にげる）</option>
            </select>
            {game.rules.win === 'survive' && <span className="hint">「おに」👹 を置いたり、下の「みずが上がってくる」を使うと、にげるゲームになります。</span>}
          </div>
          {game.rules.mode === '3d' && (
            <div className="field">
              <label>🌊 みず（かざんでは ようがん）が上がってくる</label>
              <select value={game.rules.flood ?? 0} onChange={(e) => updateRules({ flood: Number(e.target.value) })}>
                {FLOOD_OPTIONS.map((o) => (
                  <option key={o.seconds} value={o.seconds}>
                    {o.label}
                  </option>
                ))}
                {(game.rules.flood ?? 0) > 0 && !FLOOD_OPTIONS.some((o) => o.seconds === game.rules.flood) && <option value={game.rules.flood}>{game.rules.flood} 秒</option>}
              </select>
              {(game.rules.flood ?? 0) > 0 && <span className="hint">だん4・だん5 の高い足場に登ってにげよう。だん5 の上だけは最後まで安全。</span>}
            </div>
          )}
          {range('はやさ', 'speed', 1, 5)}
          {game.rules.mode !== 'topdown' && range('ジャンプ力', 'jump', 1, 5)}
          {range('ライフ', 'lives', 1, 9)}
          {range('てきのはやさ', 'enemySpeed', 0, 5, '0で止まる')}
          <div className="field">
            <label>
              制限時間: <b>{game.rules.timeLimit === 0 ? 'なし' : `${game.rules.timeLimit}秒`}</b>
            </label>
            <input type="range" min={0} max={300} step={10} value={game.rules.timeLimit} onChange={(e) => updateRules({ timeLimit: Number(e.target.value) })} />
          </div>

          <h3 style={{ marginTop: 16 }}>ファイル</h3>
          <div className="toolbar">
            <button className="btn btn-sm" onClick={doExport}>
              📤 書き出し
            </button>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              📥 読み込み
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = '';
              }}
            />
            {isPublished && !isFeatured && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (confirm('公開をとりやめますか？（下書きは残ります）')) {
                    unpublishGame(game.id);
                    toast('公開をとりやめました');
                  }
                }}
              >
                公開をやめる
              </button>
            )}
            {id && getDraft(id) && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (confirm('このゲームを削除しますか？')) {
                    deleteDraft(game.id);
                    unpublishGame(game.id);
                    navigate({ name: 'create' });
                  }
                }}
              >
                🗑️ 削除
              </button>
            )}
          </div>
        </aside>
      </div>

      {testing && (
        <Modal big onClose={() => setTesting(false)}>
          <div className="play-head" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>▶ テストプレイ</h2>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => setTestKey((k) => k + 1)}>
              🔁 最初から
            </button>
            <button className="btn btn-sm" onClick={() => setTesting(false)}>
              ✖ 閉じる
            </button>
          </div>
          <AnyGameCanvas game={prepared} onFinish={onTestFinish} resetKey={testKey} />
        </Modal>
      )}
    </main>
  );
}
