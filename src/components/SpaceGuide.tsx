import { SPACE_LANDMARKS } from '../space';
import type { Bounds } from '../types';
import './SpaceLandmarks.css';

interface Props { onFocus: (bounds: Bounds) => void }

/** Explain the flat image's wrap seam and provide accessible landmark shortcuts. */
export function SpaceGuide({ onFocus }: Props) {
  return <section className="space-guide" aria-label="How space fits together">
    <p>The clock is below the manticore landing island. Space wraps vertically: continue below the image’s bottom edge to reach its top edge.</p>
    <nav aria-label="Jump to space landmark">{SPACE_LANDMARKS.map(landmark =>
      <button key={landmark.id} onClick={() => onFocus(landmark.bounds)}>{landmark.label}</button>)}</nav>
    <a href="https://animalwell.wiki.gg/wiki/Space" target="_blank" rel="noreferrer">Space layout reference ↗</a>
  </section>;
}
