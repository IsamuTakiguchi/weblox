import { lazy, Suspense } from 'react';
import { sfx, speak } from '../audio';
import { toast } from '../components/feedback';
import { AvatarBadge, SpeakButton } from '../components/ui';
import { buyHat, COLORS, FACES, HATS, SKINS, updateAvatar, updateProfile, useStore } from '../store/store';

const AvatarPreview3D = lazy(() => import('../components/AvatarPreview3D'));

const INTRO = 'じぶんの アバターを つくろう。かおと はだの いろ、シャツと ズボンの いろ、ぼうしを えらんでね。ぼうしは ウェブックスで かえるよ。';

function Swatches({ title, values, current, onPick }: { title: string; values: readonly string[]; current: string; onPick: (v: string) => void }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      <div className="swatches">
        {values.map((c) => (
          <button
            key={c}
            className={`swatch ${current === c ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => {
              sfx.tap();
              onPick(c);
            }}
            aria-label={`${title} ${c}`}
          />
        ))}
      </div>
    </section>
  );
}

export function AvatarPage() {
  const profile = useStore((s) => s.profile);
  const av = profile.avatar;
  return (
    <main className="page">
      <div className="kid-title">
        <span>🧢 アバター</span>
        <SpeakButton text={INTRO} />
      </div>

      <div className="avatar-layout">
        <div className="avatar-stage">
          <Suspense fallback={<div className="avatar-preview loading-3d">よみこみ中…</div>}>
            <AvatarPreview3D avatar={av} />
          </Suspense>
          <div style={{ textAlign: 'center' }}>
            <input
              value={profile.name}
              onChange={(e) => updateProfile({ name: e.target.value.slice(0, 20) })}
              style={{ textAlign: 'center', fontWeight: 800, fontSize: 20, maxWidth: 260 }}
              aria-label="なまえ"
              placeholder="なまえ"
            />
            <p className="hint" style={{ marginTop: 8 }}>
              もっている ウェブックス: <b className="wbx">◈ {profile.wbx}</b>
              <br />
              ゲームをクリアすると +10、公開すると +50 もらえるよ
            </p>
            <p className="hint">
              2D のゲームでは <AvatarBadge avatar={av} size={26} /> のアイコン、3D のゲームではこのキャラクターで あそべます
            </p>
          </div>
        </div>

        <div className="avatar-options">
          <section className="section" style={{ marginTop: 0 }}>
            <h2 className="section-title">😀 かお</h2>
            <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
              {FACES.map((f) => (
                <button
                  key={f}
                  className={`choice ${av.face === f ? 'selected' : ''}`}
                  style={{ minHeight: 80, padding: 6 }}
                  onClick={() => {
                    sfx.tap();
                    updateAvatar({ face: f });
                  }}
                >
                  <span className="choice-emoji" style={{ fontSize: 40 }}>
                    {f}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <Swatches title="🟡 はだ" values={SKINS} current={av.skin} onPick={(v) => updateAvatar({ skin: v })} />
          <Swatches title="👕 シャツ" values={COLORS} current={av.color} onPick={(v) => updateAvatar({ color: v })} />
          <Swatches title="👖 ズボン" values={COLORS} current={av.pants} onPick={(v) => updateAvatar({ pants: v })} />

          <section className="section">
            <h2 className="section-title">🧢 ぼうし・アクセサリー</h2>
            <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
              {HATS.map((h) => {
                const owned = av.unlocked.includes(h.id);
                const selected = av.hat === h.id;
                return (
                  <button
                    key={h.id}
                    className={`choice ${selected ? 'selected' : ''}`}
                    style={{ minHeight: 110, padding: 10 }}
                    onClick={() => {
                      const ok = buyHat(h.id);
                      if (ok) {
                        if (!owned && h.price > 0) {
                          sfx.reward();
                          toast(`🎁 ${h.name} を てにいれた！`);
                          speak(`${h.name} を てにいれた`);
                        } else sfx.tap();
                      } else {
                        sfx.hurt();
                        toast('ウェブックスが たりないよ。ゲームをクリアして ためよう！');
                        speak('ウェブックスが たりないよ');
                      }
                    }}
                  >
                    <span className="choice-emoji" style={{ fontSize: 40 }}>
                      {h.emoji || '🚫'}
                    </span>
                    <span style={{ fontSize: 15 }}>{h.name}</span>
                    <span className="hint">{owned ? (selected ? 'つけている' : 'もっている') : `◈ ${h.price}`}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
