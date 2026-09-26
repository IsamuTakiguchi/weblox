import { sfx, speak } from '../audio';
import { GameCard, SpeakButton } from '../components/ui';
import { hrefFor } from '../router';
import { deleteDraft, useStore } from '../store/store';

const INTRO = 'どっちで つくる？ かんたんモードは 絵をおくだけ。スタジオは くわしく つくれるよ。';

export function CreatePage() {
  const drafts = useStore((s) => s.drafts);
  return (
    <main className="page">
      <div className="kid-title">
        <span>🛠️ ゲームを つくろう！</span>
        <SpeakButton text={INTRO} />
      </div>
      <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <a
          className="choice"
          href={hrefFor({ name: 'kid' })}
          style={{ minHeight: 220 }}
          onClick={() => {
            sfx.tap();
            speak('かんたんモード');
          }}
        >
          <span className="choice-emoji">🧒✨</span>
          <span style={{ fontSize: 24 }}>かんたんモード</span>
          <span className="hint" style={{ textAlign: 'center' }}>
            5さいから。せかいをえらんで、絵をぽんぽんおくだけ。
            <br />
            字がよめなくても、こえで教えてくれるよ。
          </span>
        </a>
        <a
          className="choice"
          href={hrefFor({ name: 'studio' })}
          style={{ minHeight: 220 }}
          onClick={() => {
            sfx.tap();
            speak('スタジオ');
          }}
        >
          <span className="choice-emoji">🧑‍💻🎛️</span>
          <span style={{ fontSize: 24 }}>スタジオ</span>
          <span className="hint" style={{ textAlign: 'center' }}>
            大きなマップ、かぎとドア、ワープ、ばね、タイマー…
            <br />
            ルールを細かく決めて、本格的なゲームをつくる。
          </span>
        </a>
      </div>

      {drafts.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">✏️ つくりかけ・つくったゲーム</h2>
          </div>
          <div className="grid">
            {drafts.map((g) => (
              <div key={g.id} className="card" style={{ padding: 0 }}>
                <GameCard game={g} onClick={() => (location.hash = hrefFor(g.kidMode ? { name: 'kid', id: g.id } : { name: 'studio', id: g.id }))} />
                <div className="card-actions">
                  <a className="btn btn-sm btn-blue" href={hrefFor(g.kidMode ? { name: 'kid', id: g.id } : { name: 'studio', id: g.id })}>
                    ✏️ つづき
                  </a>
                  <a className="btn btn-sm" href={hrefFor({ name: 'game', id: g.id })}>
                    ▶ あそぶ
                  </a>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (confirm(`「${g.title || 'なまえのないゲーム'}」を けしますか？`)) deleteDraft(g.id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
