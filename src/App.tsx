import { useCallback, useEffect, useRef, useState } from 'react';
import { Atlas } from './components/Atlas';
import { Sidebar } from './components/Sidebar';
import type { AtlasHandle, Camera, Manifest, Size } from './types';

const DEFAULT_MAP = '20240603_4757794989373292024';
export function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new URLSearchParams(location.hash.slice(1)).get('map') || DEFAULT_MAP);
  const [grid, setGrid] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [view, setView] = useState<{ camera: Camera; size: Size }>({ camera: { x: 0, y: 0, scale: 0.1 }, size: { width: 1, height: 1 } });
  const [pixel, setPixel] = useState({ x: 0, y: 0 });
  const [notice, setNotice] = useState('');
  const atlas = useRef<AtlasHandle>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCamera = useCallback((camera: Camera, size: Size) => setView({ camera, size }), []);
  const onPixel = useCallback((x: number, y: number) => setPixel({ x, y }), []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}maps.json`, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Map catalogue could not be loaded.');
      return response.json();
    }).then((data: Manifest) => { if (!data.maps.length) throw new Error('The map catalogue is empty.'); setManifest(data); setSelected(id => data.maps.some(map => map.id === id) ? id : data.maps.at(-1)!.id); }).catch(reason => { if (reason.name !== 'AbortError') setError(String(reason.message)); });
    return () => controller.abort();
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const notify = (message: string) => { setNotice(message); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 5000); };
  const copyView = async () => {
    const { camera: c, size } = view;
    const params = new URLSearchParams({ map: selected, x: ((size.width / 2 - c.x) / c.scale).toFixed(2), y: ((size.height / 2 - c.y) / c.scale).toFixed(2), z: c.scale.toFixed(5) });
    const url = new URL(location.href); url.hash = params.toString();
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url.href); notify('Link to this view copied.'); }
    catch { notify('View saved in the address bar. Copy its URL to share.'); }
  };
  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { notify('Fullscreen is unavailable in this browser.'); }
  };
  if (error) return <main className="error-page"><h1>Atlas unavailable</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (!manifest) return <main className="error-page"><span className="status-orb" /><p>Opening the atlas…</p></main>;
  const map = manifest.maps.find(entry => entry.id === selected)!;
  return <div className={`app ${sidebar ? 'sidebar-open' : ''}`}>
    <header className="topbar"><a className="brand" href="./" onClick={event => { event.preventDefault(); setSelected(DEFAULT_MAP); setGrid(false); setSidebar(false); history.replaceState(null, '', new URL('./', location.href)); atlas.current?.fit(); }} aria-label="Wellness Camp home"><span className="brand-icon" aria-hidden="true"><i /><i /><i /></span><span>wellness<span className="brand-light">camp</span><span className="brand-period">.</span></span></a>
      <div className="topbar-centre"><span className="live-dot" /> ANIMAL WELL <span className="slash">/</span> LEVEL DESIGN ATLAS</div>
      <div className="header-actions"><span className="free-label">FREE TO EXPLORE</span><button className="mobile-menu" onClick={() => setSidebar(!sidebar)} aria-expanded={sidebar} aria-label="Toggle atlas settings">☰</button><button className="share-button" onClick={copyView}>Share view <span>↗</span></button></div>
    </header>
    <Sidebar manifest={manifest} selected={map} grid={grid} onGrid={setGrid} onSelect={id => { setSelected(id); const url = new URL(location.href); url.hash = new URLSearchParams({ map: id }).toString(); history.replaceState(null, '', url); setSidebar(false); }} />
    <main className="workspace">
      <div className="workspace-heading"><div><span className="eyebrow">EXPLORER</span><h2>The whole world, room by room.</h2></div><div className="version-pill"><span className="live-dot" />{map.id === DEFAULT_MAP ? 'LATEST CAPTURE' : 'ARCHIVE CAPTURE'}<span>{map.date}</span></div></div>
      <div className="viewer-frame"><Atlas ref={atlas} map={map} grid={grid} onCamera={onCamera} onPixel={onPixel} />
        <div className="zoom-controls" aria-label="Map controls"><button aria-label="Zoom in" title="Zoom in (+)" onClick={() => atlas.current?.zoom(1.5)}>＋</button><output aria-label="Zoom level">{Math.round(view.camera.scale * 100)}%</output><button aria-label="Zoom out" title="Zoom out (-)" onClick={() => atlas.current?.zoom(1 / 1.5)}>−</button><span className="control-line" /><button className="fit-button" onClick={() => atlas.current?.fit()} title="Fit world (0)">Fit world</button><button className="native-button" onClick={() => atlas.current?.native()} title="One source pixel per CSS pixel">1:1</button><button aria-label="Toggle fullscreen" title="Toggle fullscreen" onClick={fullscreen}>⛶</button></div>
      </div>
      <footer className="viewer-footer"><div className="instructions"><span><kbd>DRAG</kbd> Pan</span><span><kbd>SCROLL</kbd> Zoom</span><span><kbd>2× CLICK</kbd> Look closer</span></div><output className="coordinates" aria-label="Image coordinates">X <strong>{pixel.x.toLocaleString()}</strong><span>/</span> Y <strong>{pixel.y.toLocaleString()}</strong></output></footer>
      <div className="study-note"><span>✳</span><p>Follow a path. Find a pattern. <span>Study how rooms connect, gate progress, and reward curiosity.</span></p><span className="note-index">01 — 94</span></div>
    </main>
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}
