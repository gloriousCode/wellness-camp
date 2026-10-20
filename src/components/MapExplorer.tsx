import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAtlasContent } from '../hooks';
import { GAMEPLAY_ATLAS } from '../gameplay';
import { cameraView, readView, viewUrl } from '../viewUrl';
import type { AtlasHandle, Camera, ImageryMode, Manifest, Screen, Size } from '../types';
import { Atlas } from './Atlas';
import { Sidebar } from './Sidebar';
import { ImageryToggle } from './ImageryToggle';

const DEFAULT_MAP = '20240603_4757794989373292024';
interface Props { manifest: Manifest }
export function MapExplorer({ manifest }: Props) {
  const [mapId, setMapId] = useState(() => { const id = new URLSearchParams(location.search).get('map') || new URLSearchParams(location.hash.slice(1)).get('map') || DEFAULT_MAP; return manifest.maps.some(map => map.id === id) ? id : DEFAULT_MAP; });
  const map = manifest.maps.find(entry => entry.id === mapId)!;
  const gameplayAvailable = mapId === GAMEPLAY_ATLAS.mapId;
  const [imagery, setImagery] = useState<ImageryMode>(() => gameplayAvailable && new URLSearchParams(location.search).get('imagery') === 'gameplay' ? 'gameplay' : 'normal');
  const mode = gameplayAvailable ? imagery : 'normal';
  const { content, status } = useAtlasContent(map, mode);
  const [selected, setSelected] = useState<Screen>();
  const [grid, setGrid] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 700);
  const [sidebarWidth, setSidebarWidth] = useState(() => window.innerWidth > 1100 ? 278 : 238);
  const [settings, setSettings] = useState(false);
  const [view, setView] = useState<{ camera: Camera; size: Size }>({ camera: { x: 0, y: 0, scale: 0.1 }, size: { width: 1, height: 1 } });
  const [pixel, setPixel] = useState({ x: 0, y: 0 });
  const [notice, setNotice] = useState('');
  const atlas = useRef<AtlasHandle>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCamera = useCallback((camera: Camera, size: Size) => setView({ camera, size }), []);
  const onPixel = useCallback((x: number, y: number) => setPixel({ x, y }), []);
  const onSelect = useCallback((screen?: Screen) => setSelected(screen), []);
  const notify = useCallback((message: string) => { setNotice(message); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 5000); }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    if (!content || view.size.width <= 1) return;
    const timer = setTimeout(() => history.replaceState(null, '', viewUrl(new URL(location.href), mapId, cameraView(view.camera, view.size), selected?.id, mode)), 180);
    return () => clearTimeout(timer);
  }, [content, view, mapId, selected, mode]);
  useEffect(() => {
    const navigate = () => {
      const url = new URL(location.href), id = url.searchParams.get('map') || DEFAULT_MAP;
      if (!manifest.maps.some(entry => entry.id === id)) return;
      setMapId(id);
      setImagery(id === GAMEPLAY_ATLAS.mapId && url.searchParams.get('imagery') === 'gameplay' ? 'gameplay' : 'normal');
      const room = content?.screens.find(entry => entry.id === url.searchParams.get('room'));
      setSelected(room);
      const bounds = readView(url.searchParams);
      if (bounds) atlas.current?.setView(bounds);
      else if (room) atlas.current?.focus(room);
    };
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, [manifest, content]);
  const changeMap = (id: string) => { setMapId(id); setSelected(undefined); if (id !== GAMEPLAY_ATLAS.mapId) setImagery('normal'); };
  const selectScreen = (screen: Screen) => { setSelected(screen); atlas.current?.focus(screen); if (window.innerWidth <= 700) setSidebarOpen(false); };
  const world = () => { setSelected(undefined); atlas.current?.fit(); };
  const copyView = async () => {
    const url = viewUrl(new URL(location.href), mapId, cameraView(view.camera, view.size), selected?.id, mode);
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url.href); notify('Link to this view copied.'); }
    catch { notify('View saved in the address bar. Copy its URL to share.'); }
  };
  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { notify('Fullscreen is unavailable in this browser.'); }
  };
  return <div className={`camp-app ${sidebarOpen ? 'with-sidebar' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
    <header className="camp-header"><button className="menu-toggle" aria-label="Toggle screen browser" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(value => !value)}>☰</button>
      <a className="camp-brand" href="./" onClick={event => { event.preventDefault(); setMapId(DEFAULT_MAP); world(); }}>wellness<span>camp.</span></a><span className="header-subtitle">ANIMAL WELL</span>
      <nav aria-label="Viewer actions"><button onClick={copyView}>Share ↗</button><button aria-label="Open viewer settings" aria-expanded={settings} onClick={() => setSettings(value => !value)}>⚙</button></nav>
    </header>
    {sidebarOpen && <Sidebar width={sidebarWidth} onWidth={setSidebarWidth} manifest={manifest} map={map} content={content} selected={selected} onMap={changeMap} onScreen={selectScreen} onWorld={world} onClear={() => setSelected(undefined)} onSave={screen => atlas.current?.save(screen)} />}
    <main className="map-workspace">
      <section className="main-map" aria-label={mode === 'gameplay' ? 'In-game capture atlas' : 'Normal layout atlas'}><div className="map-title"><strong>Animal Well</strong><span>{selected ? `Screen ${selected.id}` : 'Whole world'} · {map.date}</span><ImageryToggle mode={mode} onChange={setImagery} available={gameplayAvailable} count={GAMEPLAY_ATLAS.roomIds.length} totalCount={content?.screens.length} inferredCount={GAMEPLAY_ATLAS.inferredRoomIds.length} /></div>
        <div className="map-surface"><Atlas ref={atlas} content={content} status={status} mapId={mapId} grid={grid} minimap={minimap} selected={selected} onSelect={onSelect} onCamera={onCamera} onPixel={onPixel} onError={notify} />
          <div className="zoom-controls" aria-label="Map controls"><button aria-label="Zoom in" onClick={() => atlas.current?.zoom(1.5)}>＋</button><output aria-label="Zoom level">{Math.round(view.camera.scale * 100)}%</output><button aria-label="Zoom out" onClick={() => atlas.current?.zoom(1 / 1.5)}>−</button><span className="control-line" /><button className="fit-button" onClick={world}>Fit world</button><button className="native-button" onClick={() => atlas.current?.native()}>1:1</button><button aria-label="Toggle fullscreen" onClick={fullscreen}>⛶</button></div>
        </div><footer className="map-status"><span>Drag · scroll to zoom · click a screen to focus</span><output aria-label="Image coordinates">X {pixel.x.toLocaleString()} &nbsp; Y {pixel.y.toLocaleString()}</output></footer>
      </section>
    </main>
    {settings && <section className="settings-popover" aria-label="Viewer settings"><div><strong>Viewer settings</strong><button aria-label="Close viewer settings" onClick={() => setSettings(false)}>×</button></div><label><input type="checkbox" checked={grid} onChange={event => setGrid(event.target.checked)} /> Show screen boundaries</label><label><input type="checkbox" checked={minimap} onChange={event => setMinimap(event.target.checked)} /> Show minimap</label><p>Screen cells are sliced from the original atlas. Coordinates increase rightwards and downwards. Source colours and orientation are unchanged.</p></section>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}
