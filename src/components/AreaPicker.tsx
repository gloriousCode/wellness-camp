import type { Area } from '../types';
import './AreaPicker.css';

interface Props { area: Area; onChange: (area: Area) => void }

/** Keep the well and its parallel space layer separately browsable. */
export function AreaPicker({ area, onChange }: Props) {
  return <label className="area-picker">Area
    <select aria-label="Map area" value={area} onChange={event => onChange(event.target.value as Area)}>
      <option value="well">The well</option>
      <option value="space">Bunny Island &amp; space</option>
    </select>
  </label>;
}
