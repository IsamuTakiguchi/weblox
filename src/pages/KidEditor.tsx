import { useCallback, useEffect, useMemo, useState } from 'react';
import { sfx, speak } from '../audio';
import { fireConfetti, toast } from '../components/feedback';
import { AnyGameCanvas } from '../components/AnyGameCanvas';
import { GridEditor, TileSwatch } from '../components/GridEditor';
import { Modal, SpeakButton, Thumbnail } from '../components/ui';
import { autoFix, createGame, defaultRules, emptyTiles, fillAll, fillFloor, KID_WIDTH, randomLevel } from '../engine/level';
import { HEROES, THEMES } from '../engine/themes';
import { KID_PALETTE, SWATCH_TILES, tileDef } from '../engine/tiles';
import type { GameData, GameResult, TileId } from '../engine/types';
import { enterFullscreen, requestAutoStart } from '../fullscreen';
import { hrefFor, navigate } from '../router';
import { shareGame } from './Play';
import { getDraft, getState, publishGame, saveDraft } from '../store/store';

type Step = 0 | 1 | 2 | 3;

const STEP_TEXT: Record<Step, string> = {
  0: 'どんな せかいに する？ すきなのを えらんでね。',
  1: 'しゅじんこうを えらんでね。',
  2: 'したの えを えらんで、マスを タッチして おいてね。コインや てきを おいて、さいごに ゴールを おこう。',
  3: 'できた！ なまえを きめて、みんなに みせよう。',
};

const NAME_IDEAS = ['ぼうけん', 'コインいっぱい', 'ドキドキ', 'にんじゃ', 'キラキラ', 'めいろ', 'ぴょんぴょん', 'おたから', 'スーパー', 'ふしぎな'];
const NAME_TAIL = ['ランド', 'アイランド', 'ワールド', 'たんけん', 'レース', 'クエスト', 'めいろ', 'パーク'];

function suggestName(hero: string): string {
  const a = NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)];
  const b = NAME_TAIL[Math.floor(Math.random() * NAME_TAIL.length)];
  return `${hero} ${a}${b}`;
}

export function KidEditorPage({ id }: { id?: string }) {
  const profile = getState().profile;
  const [game, setGame] = useState<GameData>(() => {
    const existing = id ? getDraft(id) : undefined;
    if (existing) return existing;
    return createGame({ kidMode: true, author: profile.name, authorAvatar: profile.avatar.face, hero: '😺', rules: defaultRules('topdown') });
  });
  const [step, setStep] = useState<Step>(id && getDraft(id) ? 2 : 0);
  const [tool, setTool] = useState<TileId>('wall');
  const [testing, setTesting] = useState(false);
  const [testKey, setTestKey] = useState(0);
  const [done, setDone] = useState<GameData | null>(null);
  const [cell, setCell] = useState(44);

  // 画面幅に合わせてマスの大きさを決める
  useEffect(() => {
    const calc = () => {
      const w = Math.min(window.innerWidth - 40, 900);
      const sidebar = window.innerWidth >= 900 ? 240 : 0;
      setCell(Math.max(28, Math.min(64, Math.floor((w - sidebar) / KID_WIDTH) - 1)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // ステップが変わったら読み上げ
  useEffect(() => {
    speak(STEP_TEXT[step]);
  }, [step]);

  // 自動保存（おく画面以降）
  useEffect(() => {
    if (step >= 2) saveDraft(game);
  }, [game, step]);

  const update = useCallback((patch: Partial<GameData>) => setGame((g) => ({ ...g, ...patch })), []);
  const onTiles = useCallback((tiles: string) => setGame((g) => ({ ...g, tiles })), []);

  const setMode = (mode: 'topdown' | 'platformer' | '3d') => {
    sfx.tap();
    setGame((g) => {
      let tiles = g.tiles;
      if (mode === 'platformer' && g.rules.mode !== 'platformer') tiles = fillFloor(tiles, g.width, g.height);
      // 3D では空のマスが奈落になるので、まず全部に床を敷く
      if (mode === '3d' && g.rules.mode !== '3d') tiles = fillAll(tiles, 'ground');
      return { ...g, tiles, rules: { ...g.rules, mode } };
    });
    speak(mode === 'platformer' ? 'ジャンプで あそぶ' : mode === '3d' ? 'りったいの せかいで あそぶ。けすと あなが あくよ' : 'あるいて あそぶ');
  };

  const randomize = () => {
    sfx.reward();
    update({ tiles: randomLevel(game.width, game.height, game.rules.mode) });
    speak('おまかせで つくったよ！ すきに なおしてね');
  };
  const clearAll = () => {
    if (!confirm('ぜんぶ けしますか？')) return;
    sfx.erase();
    const blank = emptyTiles(game.width, game.height);
    update({
      tiles: game.rules.mode === 'platformer' ? fillFloor(blank, game.width, game.height) : game.rules.mode === '3d' ? fillAll(blank, 'ground') : blank,
    });
  };

  const prepared = useMemo(() => autoFix(game), [game]);

  const startTest = () => {
    sfx.tap();
    setTestKey((k) => k + 1);
    setTesting(true);
    speak('ためしに あそんでみよう');
  };
  const onTestFinish = (r: GameResult) => {
    setTesting(false);
    if (r.outcome === 'win') {
      fireConfetti();
      speak('クリア！ できたを おそう');
      toast('🏆 クリア！このゲームは あそべるよ');
    } else {
      speak('むずかしかった？ てきを へらしても いいよ');
      toast('💫 もういっかい ためしてみよう');
    }
  };

  const finish = () => {
    sfx.tap();
    const fixed = autoFix({ ...game, title: game.title || suggestName(game.hero) });
    setGame(fixed);
    setStep(3);
  };

  const publish = () => {
    const pub = publishGame({ ...prepared, title: game.title.trim() || suggestName(game.hero) });
    saveDraft(pub);
    setDone(pub);
    fireConfetti();
    sfx.win();
    speak('こうかい したよ！ おめでとう！');
  };

  const stepBtn = (s: Step, icon: string, label: string) => (
    <button
      key={s}
      className={`kid-step ${step === s ? 'active' : ''} ${step > s ? 'done' : ''}`}
      onClick={() => {
        sfx.tap();
        setStep(s);
      }}
    >
      <span>{step > s ? '✅' : icon}</span>
      <span>{label}</span>
    </button>
  );

  if (done) {
    return (
      <main className="page kid">
        <div className="result">
          <div className="result-emoji">🎉</div>
          <h2>こうかい できたよ！</h2>
          <p style={{ fontSize: 20, fontWeight: 800 }}>「{done.title}」</p>
          <p>
            <span className="reward">◈ +50 ウェブックス</span>
          </p>
          <div style={{ maxWidth: 420, margin: '12px auto' }}>
            <Thumbnail game={done} />
          </div>
          <div className="modal-actions">
            <button
              className="btn btn-primary btn-xl"
              onClick={() => {
                sfx.tap();
                requestAutoStart();
                void enterFullscreen();
                navigate({ name: 'play', id: done.id });
              }}
            >
              ▶ あそぶ
            </button>
            <button className="btn btn-blue btn-xl" onClick={() => void shareGame(done)}>
              🔗 ともだちに おくる
            </button>
          </div>
          <div className="modal-actions">
            <a className="btn btn-lg" href={hrefFor({ name: 'kid' })} onClick={() => setTimeout(() => location.reload(), 0)}>
              ✨ もういっこ つくる
            </a>
            <a className="btn btn-lg" href={hrefFor({ name: 'home' })}>
              🏠 ホーム
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page kid">
      <div className="kid-steps">
        {stepBtn(0, '🌍', 'せかい')}
        {stepBtn(1, '🙂', 'しゅじんこう')}
        {stepBtn(2, '🧱', 'おく')}
        {stepBtn(3, '🎉', 'できた')}
      </div>

      {step === 0 && (
        <>
          <div className="kid-title">
            <span>🌍 どんな せかいに する？</span>
            <SpeakButton text={STEP_TEXT[0]} />
          </div>
          <div className="choice-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`choice ${game.theme === t.id ? 'selected' : ''}`}
                onClick={() => {
                  sfx.tap();
                  update({ theme: t.id });
                  speak(t.name);
                }}
              >
                <span className="choice-emoji">{t.emoji}</span>
                <span className="choice-swatch" style={{ background: `linear-gradient(135deg, ${t.skyTop}, ${t.skyBottom})` }} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
          <div className="kid-title" style={{ marginTop: 28 }}>
            <span>どうやって あそぶ？</span>
          </div>
          <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(120px, 200px))', justifyContent: 'center' }}>
            <button className={`choice ${game.rules.mode === 'topdown' ? 'selected' : ''}`} onClick={() => setMode('topdown')}>
              <span className="choice-emoji">🚶</span>
              <span>あるく</span>
              <span className="hint">うえから みる</span>
            </button>
            <button className={`choice ${game.rules.mode === 'platformer' ? 'selected' : ''}`} onClick={() => setMode('platformer')}>
              <span className="choice-emoji">🦘</span>
              <span>ジャンプ</span>
              <span className="hint">よこから みる</span>
            </button>
            <button className={`choice ${game.rules.mode === '3d' ? 'selected' : ''}`} onClick={() => setMode('3d')}>
              <span className="choice-emoji">🧊</span>
              <span>3D</span>
              <span className="hint">りったいの せかい</span>
            </button>
          </div>
          <div className="kid-actions">
            <button
              className="btn btn-primary btn-xl"
              onClick={() => {
                sfx.tap();
                setStep(1);
              }}
            >
              つぎへ →
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="kid-title">
            <span>🙂 しゅじんこうを えらぼう</span>
            <SpeakButton text={STEP_TEXT[1]} />
          </div>
          <div className="choice-grid">
            {HEROES.map((h) => (
              <button
                key={h}
                className={`choice ${game.hero === h ? 'selected' : ''}`}
                onClick={() => {
                  sfx.tap();
                  update({ hero: h });
                }}
              >
                <span className="choice-emoji">{h}</span>
              </button>
            ))}
          </div>
          <div className="kid-actions">
            <button
              className="btn btn-lg"
              onClick={() => {
                sfx.tap();
                setStep(0);
              }}
            >
              ← もどる
            </button>
            <button
              className="btn btn-primary btn-xl"
              onClick={() => {
                sfx.tap();
                setStep(2);
              }}
            >
              つぎへ →
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="kid-title">
            <span>🧱 えを おいて つくろう</span>
            <SpeakButton text={STEP_TEXT[2]} />
          </div>
          <div className="kid-editor">
            <div>
              <div className="palette">
                {KID_PALETTE.map((t) => {
                  const d = tileDef(t);
                  return (
                    <button
                      key={t}
                      className={`palette-btn ${tool === t ? 'selected' : ''}`}
                      onClick={() => {
                        sfx.tap();
                        setTool(t);
                        speak(d.label);
                      }}
                      aria-pressed={tool === t}
                    >
                      <span className="palette-emoji">{SWATCH_TILES.includes(t) ? <TileSwatch tile={t} game={game} /> : t === 'start' ? game.hero : t === 'empty' && game.rules.mode === '3d' ? '🕳️' : d.emoji}</span>
                      <span>{t === 'empty' && game.rules.mode === '3d' ? 'あな' : d.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="editor-tools" style={{ flexDirection: 'column' }}>
                <button className="btn" onClick={randomize}>
                  🎲 おまかせ
                </button>
                <button className="btn btn-ghost" onClick={clearAll}>
                  🗑️ ぜんぶけす
                </button>
              </div>
            </div>
            <div>
              <GridEditor game={game} tool={tool} onChange={onTiles} cell={cell} />
              <div className="kid-actions">
                <button className="btn btn-blue btn-lg" onClick={startTest}>
                  ▶ ためす
                </button>
                <button className="btn btn-primary btn-xl" onClick={finish}>
                  🎉 できた！
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="kid-title">
            <span>🎉 なまえを きめよう</span>
            <SpeakButton text={STEP_TEXT[3]} />
          </div>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ marginBottom: 12 }}>
              <Thumbnail game={prepared} />
            </div>
            <div className="field">
              <input
                value={game.title}
                onChange={(e) => update({ title: e.target.value.slice(0, 40) })}
                placeholder="ゲームの なまえ"
                style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }}
                aria-label="ゲームのなまえ"
              />
            </div>
            <div className="toolbar" style={{ justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={() => {
                  sfx.tap();
                  const n = suggestName(game.hero);
                  update({ title: n });
                  speak(n);
                }}
              >
                🎲 なまえを かんがえて
              </button>
              <SpeakButton text={game.title || 'まだ なまえが ないよ'} label="なまえをよむ" />
            </div>
            <div className="kid-actions">
              <button
                className="btn btn-lg"
                onClick={() => {
                  sfx.tap();
                  setStep(2);
                }}
              >
                ← なおす
              </button>
              <button className="btn btn-blue btn-lg" onClick={startTest}>
                ▶ ためす
              </button>
              <button className="btn btn-primary btn-xl" onClick={publish}>
                🌍 みんなに みせる
              </button>
            </div>
            <p className="hint" style={{ textAlign: 'center' }}>
              「みんなに みせる」をおすと、このアプリの『みんなのゲーム』に並びます。リンクをともだちに送ればあそんでもらえます。
            </p>
            {!id && (
              <p className="hint" style={{ textAlign: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    saveDraft(prepared);
                    toast('📚 ほぞんしました');
                    navigate({ name: 'create' });
                  }}
                >
                  こうかいせずに ほぞんだけ
                </button>
              </p>
            )}
          </div>
        </>
      )}

      {testing && (
        <Modal big onClose={() => setTesting(false)}>
          <div className="play-head" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>▶ ためしに あそぶ</h2>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => setTestKey((k) => k + 1)}>
              🔁 さいしょから
            </button>
            <button className="btn btn-sm" onClick={() => setTesting(false)}>
              ✖ もどる
            </button>
          </div>
          <AnyGameCanvas game={prepared} onFinish={onTestFinish} resetKey={testKey} />
        </Modal>
      )}
    </main>
  );
}
