import { useState } from 'react';
import { Empty, GameCard } from '../components/ui';
import type { GameMode } from '../engine/types';
import { hrefFor } from '../router';
import { useStore } from '../store/store';

type Filter = 'all' | GameMode | 'mini';
type Sort = 'popular' | 'new' | 'liked';

export function DiscoverPage() {
  const published = useStore((s) => s.published);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [q, setQ] = useState('');

  let list = published.filter((g) => filter === 'all' || g.rules.mode === filter || (filter === 'mini' && (g.rules.mode === 'garden' || g.rules.mode === 'fishing')));
  if (q.trim()) {
    const k = q.trim().toLowerCase();
    list = list.filter((g) => g.title.toLowerCase().includes(k) || g.author.toLowerCase().includes(k) || g.description.toLowerCase().includes(k));
  }
  list = [...list].sort((a, b) => {
    if (sort === 'new') return b.publishedAt - a.publishedAt;
    if (sort === 'liked') return b.likes - a.likes;
    return b.plays - a.plays;
  });

  return (
    <main className="page">
      <div className="section-head">
        <h1 className="section-title" style={{ fontSize: 28 }}>
          🎮 あそぶ
        </h1>
        <a className="btn btn-blue btn-sm" href={hrefFor({ name: 'create' })}>
          ＋ つくる
        </a>
      </div>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="seg" role="tablist" aria-label="しゅるい">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            すべて
          </button>
          <button className={filter === 'topdown' ? 'on' : ''} onClick={() => setFilter('topdown')}>
            🚶 あるく
          </button>
          <button className={filter === 'platformer' ? 'on' : ''} onClick={() => setFilter('platformer')}>
            🦘 ジャンプ
          </button>
          <button className={filter === '3d' ? 'on' : ''} onClick={() => setFilter('3d')}>
            🧊 3D
          </button>
          <button className={filter === 'mini' ? 'on' : ''} onClick={() => setFilter('mini')}>
            🌱 ミニ
          </button>
        </div>
        <div className="seg" role="tablist" aria-label="ならびかえ">
          <button className={sort === 'popular' ? 'on' : ''} onClick={() => setSort('popular')}>
            🔥 人気
          </button>
          <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>
            🆕 新しい
          </button>
          <button className={sort === 'liked' ? 'on' : ''} onClick={() => setSort('liked')}>
            👍 いいね
          </button>
        </div>
        <input style={{ maxWidth: 260 }} placeholder="🔍 さがす" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ゲームをさがす" />
      </div>
      {list.length === 0 ? (
        <Empty icon="🔍" title="みつかりませんでした" />
      ) : (
        <div className="grid">
          {list.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </main>
  );
}
