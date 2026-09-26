import { sfx, speak } from '../audio';
import { toast } from '../components/feedback';
import { AvatarBadge, SpeakButton } from '../components/ui';
import { buyHat, COLORS, FACES, HATS, updateAvatar, updateProfile, useStore } from '../store/store';

const INTRO = 'じぶんの アバターを つくろう。かおと いろと ぼうしを えらんでね。ぼうしは ウェブックスで かえるよ。';

export function AvatarPage() {
  const profile = useStore((s) => s.profile);
  const av = profile.avatar;
  return (
    <main className="page">
      <div className="kid-title">
        <span>🧢 アバター</span>
        <SpeakButton text={INTRO} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <AvatarBadge avatar={av} size={140} />
          <div style={{ marginTop: 28 }}>
            <input
              value={profile.name}
              onChange={(e) => updateProfile({ name: e.target.value.slice(0, 20) })}
              style={{ textAlign: 'center', fontWeight: 800, fontSize: 20, maxWidth: 260 }}
              aria-label="なまえ"
              placeholder="なまえ"
            />
          </div>
          <p className="hint">
            もっている ウェブックス: <b className="wbx">◈ {profile.wbx}</b>
            <br />
            ゲームをクリアすると +10、公開すると +50 もらえるよ
          </p>
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">😀 かお</h2>
        <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
          {FACES.map((f) => (
            <button
              key={f}
              className={`choice ${av.face === f ? 'selected' : ''}`}
              style={{ minHeight: 90, padding: 8 }}
              onClick={() => {
                sfx.tap();
                updateAvatar({ face: f });
              }}
            >
              <span className="choice-emoji" style={{ fontSize: 44 }}>
                {f}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">🎨 いろ</h2>
        <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`choice ${av.color === c ? 'selected' : ''}`}
              style={{ minHeight: 70, padding: 8 }}
              onClick={() => {
                sfx.tap();
                updateAvatar({ color: c });
              }}
              aria-label={`いろ ${c}`}
            >
              <span className="choice-swatch" style={{ background: c, height: 44 }} />
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">🧢 ぼうし</h2>
        <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
          {HATS.map((h) => {
            const owned = av.unlocked.includes(h.id);
            const selected = av.hat === h.id;
            return (
              <button
                key={h.id}
                className={`choice ${selected ? 'selected' : ''}`}
                style={{ minHeight: 120 }}
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
                <span className="choice-emoji">{h.emoji || '🚫'}</span>
                <span>{h.name}</span>
                <span className="hint">{owned ? (selected ? 'つけている' : 'もっている') : `◈ ${h.price}`}</span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
