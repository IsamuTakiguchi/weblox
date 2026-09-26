import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'discover' }
  | { name: 'game'; id: string }
  | { name: 'play'; id: string }
  | { name: 'shared'; code: string; play?: boolean }
  | { name: 'create' }
  | { name: 'kid'; id?: string }
  | { name: 'studio'; id?: string }
  | { name: 'avatar' }
  | { name: 'me' }
  | { name: 'help' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const parts = path.split('/').map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  switch (parts[0]) {
    case '':
    case undefined:
      return { name: 'home' };
    case 'games':
      return { name: 'discover' };
    case 'game':
      if (parts[1]) return { name: 'game', id: parts[1] };
      return { name: 'discover' };
    case 'play':
      if (parts[1] === 's' && parts[2]) {
        const last = parts[parts.length - 1];
        const play = parts.length > 3 && last === 'go';
        const code = play ? parts.slice(2, -1).join('/') : parts.slice(2).join('/');
        return play ? { name: 'shared', code, play: true } : { name: 'shared', code };
      }
      if (parts[1]) return { name: 'play', id: parts[1] };
      return { name: 'discover' };
    case 'create':
      return { name: 'create' };
    case 'kid':
      return { name: 'kid', id: parts[1] || undefined };
    case 'studio':
      return { name: 'studio', id: parts[1] || undefined };
    case 'avatar':
      return { name: 'avatar' };
    case 'me':
      return { name: 'me' };
    case 'help':
      return { name: 'help' };
    default:
      return { name: 'home' };
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'discover':
      return '#/games';
    case 'game':
      return `#/game/${encodeURIComponent(route.id)}`;
    case 'play':
      return `#/play/${encodeURIComponent(route.id)}`;
    case 'shared':
      return route.play ? `#/play/s/${route.code}/go` : `#/play/s/${route.code}`;
    case 'create':
      return '#/create';
    case 'kid':
      return route.id ? `#/kid/${encodeURIComponent(route.id)}` : '#/kid';
    case 'studio':
      return route.id ? `#/studio/${encodeURIComponent(route.id)}` : '#/studio';
    case 'avatar':
      return '#/avatar';
    case 'me':
      return '#/me';
    case 'help':
      return '#/help';
  }
}

export function navigate(route: Route): void {
  location.hash = hrefFor(route);
}

/** ゲームを全画面で遊んでいる最中か（ヘッダーなどを隠す） */
export function isImmersive(route: Route): boolean {
  return route.name === 'play' || (route.name === 'shared' && Boolean(route.play));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(typeof location !== 'undefined' ? location.hash : ''));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
