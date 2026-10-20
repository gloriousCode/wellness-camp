import type { ImageryMode } from '../types';
import './ImageryToggle.css';

interface Props {
  mode: ImageryMode;
  onChange: (mode: ImageryMode) => void;
  available: boolean;
  mapAvailable: boolean;
  count: number;
  totalCount?: number;
  inferredCount?: number;
}

/** Choose the atlas imagery without changing the current map position. */
export function ImageryToggle({ mode, onChange, available, mapAvailable, count, totalCount, inferredCount = 0 }: Props) {
  return <div className="imagery-picker">
    <div className="imagery-toggle" role="group" aria-label="Map imagery">
      <button aria-pressed={mode === 'gameplay'} disabled={!available} title={available ? 'Show captured gameplay where available' : 'In-game captures are available for the latest map only'} onClick={() => onChange('gameplay')}>Game view</button>
      <button aria-pressed={mode === 'normal'} onClick={() => onChange('normal')}>Raw view</button>
      <button aria-pressed={mode === 'map'} disabled={!mapAvailable} title={mapAvailable ? 'Show the aligned in-game map overlay' : 'The map overlay is available for the latest map only'} onClick={() => onChange('map')}>Map view</button>
    </div>
    <small className="imagery-note" role="status">{mode === 'map' ? 'In-game map overlay' : mode === 'gameplay' ? count === totalCount ? `${count} placed · ${inferredCount} inferred` : `${count} captured · other rooms use normal` : !available ? 'Captures available on the latest map' : 'Original layout'}</small>
  </div>;
}
