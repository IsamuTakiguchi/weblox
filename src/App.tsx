import { useEffect } from 'react';
import { ConfettiHost, ToastHost } from './components/feedback';
import { Header } from './components/ui';
import { AvatarPage } from './pages/Avatar';
import { CreatePage } from './pages/Create';
import { DiscoverPage } from './pages/Discover';
import { GameDetailPage } from './pages/GameDetail';
import { HelpPage } from './pages/Help';
import { HomePage } from './pages/Home';
import { KidEditorPage } from './pages/KidEditor';
import { MePage } from './pages/Me';
import { PlayPage, SharedPage } from './pages/Play';
import { RoomPage } from './pages/Room';
import { StudioPage } from './pages/Studio';
import { isImmersive, useRoute } from './router';

export function App() {
  const route = useRoute();
  const immersive = isImmersive(route);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  let page: React.ReactNode;
  switch (route.name) {
    case 'home':
      page = <HomePage />;
      break;
    case 'discover':
      page = <DiscoverPage />;
      break;
    case 'game':
      page = <GameDetailPage id={route.id} />;
      break;
    case 'play':
      page = <PlayPage id={route.id} />;
      break;
    case 'shared':
      page = <SharedPage code={route.code} play={route.play} />;
      break;
    case 'create':
      page = <CreatePage />;
      break;
    case 'kid':
      page = <KidEditorPage key={route.id ?? 'new'} id={route.id} />;
      break;
    case 'studio':
      page = <StudioPage key={route.id ?? 'new'} id={route.id} />;
      break;
    case 'avatar':
      page = <AvatarPage />;
      break;
    case 'me':
      page = <MePage />;
      break;
    case 'help':
      page = <HelpPage />;
      break;
    case 'room':
      page = <RoomPage key={route.code} code={route.code} play={route.play} />;
      break;
  }

  return (
    <>
      {!immersive && <Header route={route} />}
      {page}
      {!immersive && (
        <footer className="hint" style={{ textAlign: 'center', padding: '16px 0 28px' }}>
          <a href="#/help">❓ あそびかた・つくりかた</a> · Weblox はブラウザだけで動く、こどものためのゲームづくりアプリです
        </footer>
      )}
      <ToastHost />
      <ConfettiHost />
    </>
  );
}
