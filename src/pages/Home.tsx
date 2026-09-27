import { Empty, GameCard } from '../components/ui';
import { hrefFor } from '../router';
import { useStore } from '../store/store';

export function HomePage() {
  const published = useStore((s) => s.published);
  const drafts = useStore((s) => s.drafts);
  const profile = useStore((s) => s.profile);
  const featured = published.filter((g) => g.featured && g.collection !== 'popular');
  const popular = published.filter((g) => g.collection === 'popular');
  const community = [...published.filter((g) => !g.featured)].sort((a, b) => b.publishedAt - a.publishedAt);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>
            あそぼう。つくろう。
            <br />
            みんなにみせよう。
          </h1>
          <p>
            Weblox は、ゲームであそべて、じぶんのゲームもつくれる場所。
            5さいのこどもでも、絵をおくだけでゲームが完成します。
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary btn-lg" href={hrefFor({ name: 'discover' })}>
              🎮 あそぶ
            </a>
            <a className="btn btn-blue btn-lg" href={hrefFor({ name: 'kid' })}>
              ✨ かんたんに つくる
            </a>
            <a className="btn btn-lg" href={hrefFor({ name: 'studio' })}>
              🛠️ スタジオ
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          🎮🧱🚩
        </div>
      </section>

      {popular.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">🔥 Roblox で人気のあそび（風）</h2>
            <span className="hint">はたけ・つり・タワー・スピードラン・まち・ラバ</span>
          </div>
          <div className="row-scroll">
            {popular.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">⭐ おすすめ</h2>
          <a className="section-link" href={hrefFor({ name: 'discover' })}>
            もっとみる →
          </a>
        </div>
        <div className="row-scroll">
          {featured.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">🌍 みんなのゲーム</h2>
          <a className="section-link" href={hrefFor({ name: 'discover' })}>
            すべて →
          </a>
        </div>
        {community.length === 0 ? (
          <Empty icon="🌱" title="まだ公開されたゲームがありません">
            <p>じぶんのゲームをつくって、いちばんめに公開しよう！</p>
            <a className="btn btn-blue" href={hrefFor({ name: 'kid' })}>
              ✨ かんたんに つくる
            </a>
          </Empty>
        ) : (
          <div className="grid">
            {community.slice(0, 8).map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">🛠️ {profile.name} のつくったゲーム</h2>
          <a className="section-link" href={hrefFor({ name: 'me' })}>
            ライブラリ →
          </a>
        </div>
        {drafts.length === 0 ? (
          <Empty icon="🧩" title="まだゲームがありません">
            <a className="btn btn-blue" href={hrefFor({ name: 'create' })}>
              はじめてのゲームをつくる
            </a>
          </Empty>
        ) : (
          <div className="grid">
            {drafts.slice(0, 4).map((g) => (
              <div key={g.id} className="card" style={{ padding: 0 }}>
                <GameCard game={g} onClick={() => (location.hash = hrefFor(g.kidMode ? { name: 'kid', id: g.id } : { name: 'studio', id: g.id }))} />
                <div className="card-actions">
                  <a className="btn btn-sm btn-primary" href={hrefFor({ name: 'game', id: g.id })}>
                    ▶ あそぶ
                  </a>
                  <a className="btn btn-sm" href={hrefFor(g.kidMode ? { name: 'kid', id: g.id } : { name: 'studio', id: g.id })}>
                    ✏️ つづきをつくる
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
