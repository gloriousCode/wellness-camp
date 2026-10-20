import { useMemo, useRef, useState } from 'react';
import type { AtlasContent, Manifest, Screen } from '../types';
import { ScreenPreview } from './ScreenPreview';
import { screenMatches } from '../screens';
interface Props {
  manifest: Manifest; content: AtlasContent | null; selected?: Screen;
  onScreen: (screen: Screen) => void; onWorld: () => void;
  onClear: () => void; onSave: (screen?: Screen) => void; width: number; onWidth: (width: number) => void;
}
export function Sidebar({ manifest, content, selected, onScreen, onWorld, onClear, onSave, width, onWidth }: Props) {
  const [query, setQuery] = useState('');
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const resize = (value: number) => onWidth(Math.max(180, Math.min(480, window.innerWidth * 0.65, value)));
  const screens = useMemo(() => {
    return (content?.screens || []).filter(screen => screenMatches(screen, query));
  }, [content, query]);
  const rows = [...new Set(screens.map(screen => screen.row))];
  return <aside className="room-sidebar" aria-label="Screen browser">
    <div className="map-picker"><div className="atlas-heading">ANIMAL WELL <span>ATLAS</span></div></div>
    <div className="room-search"><label className="sr-only" htmlFor="screen-search">Search screens</label><input id="screen-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search screens, e.g. 08,12" /><button aria-label="Clear screen search" onClick={() => setQuery('')}>×</button></div>
    <button className={`world-button ${selected ? '' : 'active'}`} onClick={onWorld}><span>▦ &nbsp; Whole world</span><span>{content?.screens.length ?? '…'}</span></button>
    <div className="room-list" aria-label="Available screens">
      {rows.map(row => <section key={row} className="room-row"><h2>ROW {String(row).padStart(2, '0')}</h2><div>{screens.filter(screen => screen.row === row).map(screen => <button key={screen.id} aria-pressed={screen.id === selected?.id} aria-label={`Screen ${screen.id}`} className={screen.id === selected?.id ? 'active' : ''} onClick={() => onScreen(screen)}>{screen.id}<span>↗</span></button>)}</div></section>)}
      {content && !screens.length && <p className="empty-search">No matching screens.</p>}
    </div>
    {content && selected ? <ScreenPreview content={content} screen={selected} onFocus={() => onScreen(selected)} onSave={() => onSave(selected)} onClear={onClear} /> : <div className="selection-hint"><span>↖</span><p>Click a screen on the map<br />or choose one above.</p><small>Screen IDs follow the atlas image grid.<br />{content?.mapOverlay ? 'In-game map aligned over captured rooms.' : content?.gameplayScreens ? 'Captured rooms replace the normal image.' : 'These are slices of an exported layout.'}</small></div>}
    <div className="sidebar-foot"><button className="save-view" disabled={!content} onClick={() => onSave()}>Save visible map <span>↧</span></button><a href={manifest.sourceViewer} target="_blank" rel="noreferrer">Normal images: cwithw ↗</a>{content?.gameplayScreens && <small>Gameplay: Scott’s recording · 20 Oct 2026</small>}<a href="https://github.com/Silverfeelin/AnimalWell-Helper" target="_blank" rel="noreferrer">Map imagery: AnimalWell-Helper ↗</a><small>ANIMAL WELL © Shared Memory LLC</small><small>Unofficial study atlas · Full-game spoilers</small></div>
    <div className="sidebar-divider" role="separator" aria-label="Screen browser width" aria-orientation="vertical" aria-valuemin={180} aria-valuemax={Math.min(480, Math.floor(window.innerWidth * 0.65))} aria-valuenow={Math.round(width)} tabIndex={0}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); resizeStart.current = { x: event.clientX, width }; }}
      onPointerMove={event => { if (resizeStart.current) resize(resizeStart.current.width + event.clientX - resizeStart.current.x); }}
      onPointerUp={() => { resizeStart.current = null; }} onPointerCancel={() => { resizeStart.current = null; }} onLostPointerCapture={() => { resizeStart.current = null; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resize(width + (event.key === 'ArrowRight' ? 20 : -20)); } }} />
  </aside>;
}
