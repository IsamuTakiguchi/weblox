import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'discover' }
  | { name: 'play'; id: string }
  | { name: 'shared'; code: string }
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
    case 'play':
      if (parts[1] === 's' && parts[2]) return { name: 'shared', code: parts.slice(2).join('/') };
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
    case 'play':
      return `#/play/${encodeURIComponent(route.id)}`;
    case 'shared':
      return `#/play/s/${route.code}`;
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

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(typeof location !== 'undefined' ? location.hash : ''));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
