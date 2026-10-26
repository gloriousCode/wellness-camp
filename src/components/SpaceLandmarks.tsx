import { SPACE_LANDMARKS, SPACE_SIZE } from '../space';
import type { Bounds, Camera, Size } from '../types';
import './SpaceLandmarks.css';

interface Props { camera: Camera; size: Size; onFocus: (bounds: Bounds) => void }

/** Viewer annotations follow the capture coordinates and never alter saved imagery. */
export function SpaceLandmarks({ camera, size, onFocus }: Props) {
  const left = camera.x, right = left + SPACE_SIZE.width * camera.scale;
  return <div className="space-landmarks" aria-label="Space landmarks and vertical wrap">
    {[0, SPACE_SIZE.height].map((edge, index) => {
      const top = camera.y + edge * camera.scale;
      if (top < 0 || top > size.height) return null;
      return <div key={edge} className={`space-wrap space-wrap-${index}`} style={{ left, top, width: right - left }}>
        <span>{index === 0 ? '↑ Continues from below the landing island' : '↓ Continues at the top · second clock'}</span>
      </div>;
    })}
    {SPACE_LANDMARKS.map(landmark => {
      const left = camera.x + landmark.x * camera.scale;
      const top = camera.y + landmark.y * camera.scale;
      if (left < 0 || left > size.width || top < 0 || top > size.height) return null;
      return <button key={landmark.id} className={`space-landmark space-landmark-${landmark.id}`}
        style={{ left: Math.max(125, Math.min(size.width - 125, left)), top }}
        title={landmark.note} onClick={() => onFocus(landmark.bounds)}>{landmark.label} ↗</button>;
    })}
  </div>;
}
