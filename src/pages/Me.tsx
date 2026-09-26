import { useState } from 'react';
import { isMuted, setMuted } from '../audio';
import { toast } from '../components/feedback';
import { AvatarBadge, Empty, GameCard, SpeechToggle } from '../components/ui';
import { hrefFor } from '../router';
import { deleteDraft, resetStore, unpublishGame, useStore } from '../store/store';
import { shareGame } from './Play';

export function MePage() {
  const profile = useStore((s) => s.profile);
  const drafts = useStore((s) => s.drafts);
  const mine = useStore((s) => s.published.filter((g) => !g.featured));
  const [muted, setMutedState] = useState(isMuted());

  return (
    <main className="page">
      <div className="play-head" style={{ marginBottom: 16 }}>
        <AvatarBadge avatar={profile.avatar} size={64} />
        <div>
          <h1 style={{ margin: 0 }}>{profile.name}</h1>
          <a className="section-link" href={hrefFor({ name: 'avatar' })}>
            アバターをかえる →
          </a>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="stat-value wbx">◈ {profile.wbx}</div>
          <div className="stat-label">ウェブックス</div>
        </div>
        <div className="stat">
          <div className="stat-value">🏆 {profile.wins}</div>
          <div className="stat-label">クリアした回数</div>
        </div>
        <div className="stat">
          <div className="stat-value">▶ {profile.plays}</div>
          <div className="stat-label">あそんだ回数</div>
        </div>
        <div className="stat">
          <div className="stat-value">🌍 {mine.length}</div>
          <div className="stat-label">公開したゲーム</div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">🌍 公開したゲーム</h2>
        </div>
        {mine.length === 0 ? (
          <Empty icon="🌱" title="まだ公開していません">
            <a className="btn btn-blue" href={hrefFor({ name: 'create' })}>
              つくって公開する
            </a>
          </Empty>
        ) : (
          <div className="grid">
            {mine.map((g) => (
              <div key={g.id} className="card" style={{ padding: 0 }}>
                <GameCard game={g} />
                <div className="card-actions">
                  <button className="btn btn-sm" onClick={() => void shareGame(g)}>
                    🔗 シェア
                  </button>
                  <a className="btn btn-sm" href={hrefFor(g.kidMode ? { name: 'kid', id: g.id } : { name: 'studio', id: g.id })}>
                    ✏️
                  </a>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (confirm(`「${g.title}」の公開をとりやめますか？`)) {
                        unpublishGame(g.id);
                        toast('公開をとりやめました');
                      }
                    }}
                  >
                    公開をやめる
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">📚 ライブラリ（下書き・保存したゲーム）</h2>
        </div>
        {drafts.length === 0 ? (
          <Empty icon="🧩" title="まだゲームがありません" />
        ) : (
          <div className="grid">
            {drafts.map((g) => (
              <div key={g.id} className="card" style={{ padding: 0 }}>
                <GameCard game={g} />
                <div className="card-actions">
                  <a className="btn btn-sm btn-blue" href={hrefFor(g.kidMode ? { name: 'kid', id: g.id } : { name: 'studio', id: g.id })}>
                    ✏️ へんしゅう
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
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">⚙️ せってい</h2>
        </div>
        <div className="toolbar">
          <button
            className="btn"
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? '🔇 おと オフ' : '🔉 おと オン'}
          </button>
          <SpeechToggle />
          <a className="btn" href={hrefFor({ name: 'help' })}>
            ❓ あそびかた・つくりかた
          </a>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('ぜんぶのデータ（つくったゲーム・アバター・ウェブックス）を消して最初にもどしますか？')) {
                resetStore();
                toast('リセットしました');
              }
            }}
          >
            🧹 データをリセット
          </button>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          データはこの端末のブラウザに保存されます。別の端末で遊ぶには「🔗 シェア」でリンクを送ってください。
        </p>
      </section>
    </main>
  );
}
