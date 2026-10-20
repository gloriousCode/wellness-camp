import { useState } from 'react';
import type { Manifest, MapEntry } from '../types';
interface Props { manifest: Manifest; selected: MapEntry; grid: boolean; onGrid: (value: boolean) => void; onSelect: (id: string) => void }
export function Sidebar({ manifest, selected, grid, onGrid, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const maps = [...manifest.maps].reverse().filter(map => `${map.id} ${map.date}`.includes(query.trim()));
  return <aside className="sidebar" aria-label="Atlas settings">
    <div className="sidebar-heading"><span className="eyebrow">FIELD GUIDE / 01</span><h1>Into the<br /><em>well.</em></h1>
      <p>A closer look at the spaces<br />between the secrets.</p></div>
    <div className="section-label"><span>THE ATLAS</span><span>↘</span></div>
    <div className="active-map"><div className="map-symbol" aria-hidden="true">▦</div><div><strong>Animal Well</strong><span>World room layout</span></div><span className="live-dot" /></div>
    <div className="map-details"><div><span>CAPTURE DATE</span><strong>{selected.date}</strong></div><div><span>IMAGE SIZE</span><strong>{(selected.bytes / 1_000_000).toFixed(2)} MB</strong></div></div>
    <div className="sidebar-section"><div className="section-label"><span>STUDY TOOLS</span><span>＋</span></div>
      <label className="toggle-row"><span><strong>Room grid</strong><small>320 × 176 pixel divisions</small></span><input type="checkbox" checked={grid} onChange={event => onGrid(event.target.checked)} /><span className="switch" aria-hidden="true" /></label>
      <p className="subtle-note">Grid coordinates refer to the source image, including its outer margins.</p>
    </div>
    <details className="archive"><summary>Historical layouts <span>{manifest.maps.length}</span></summary>
      <label className="search-label" htmlFor="version-search">Find a date or capture ID</label>
      <input id="version-search" className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. 20240603" />
      <label className="sr-only" htmlFor="map-version">Map version</label>
      <select id="map-version" value={selected.id} onChange={event => onSelect(event.target.value)}>
        {!maps.some(map => map.id === selected.id) && <option value={selected.id}>{selected.date} · current selection</option>}
        {maps.map(map => <option key={map.id} value={map.id}>{map.date} · {map.id.slice(9, 15)}{map.id === '20240603_4757794989373292024' ? ' · latest' : ''}</option>)}
      </select>
      <p className="subtle-note">Older layouts use newer textures. Each selection loads one image.</p>
    </details>
    <div className="sidebar-bottom"><div className="eyebrow">MADE FOR LOOKING CLOSER</div><p>Unofficial level-design study.<br />Full-game spoilers throughout.</p>
      <a href={manifest.sourceViewer} target="_blank" rel="noreferrer">Map images by cwithw <span>↗</span></a>
      <small>Animal Well © Billy Basso / Shared Memory. Published by BIGMODE. No affiliation.</small>
    </div>
  </aside>;
}
