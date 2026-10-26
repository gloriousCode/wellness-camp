import type { MapEntry } from './types';

/** Original community space captures; retain their native 320 × 180 room grid. */
export const SPACE_ATLAS: MapEntry = {
  "id": "bunny-island",
  "date": "Community capture",
  "file": "space/bunny-island.png",
  "bytes": 781195,
  "sha256": "3232a092b04c084cad119174fc1bfde1e45f285195ada2936b0037a696c28d31"
};

/** Labels identify visible structures in the source image, not a measured flight route. */
export const SPACE_LANDMARKS = [
  { id: 'landing', label: 'Manticore landing island', note: 'Bunny gathering island · below here wraps to the clock',
    x: 1120, y: 2700, bounds: { x: 0, y: 2700, width: 2240, height: 180 } },
  { id: 'clock', label: 'Second clock', note: 'Below the landing island, across the vertical wrap',
    x: 1120, y: 180, bounds: { x: 960, y: 0, width: 320, height: 180 } },
  { id: 'temple', label: 'Giant rabbit temple', note: 'Separate from the manticore landing island',
    x: 1120, y: 660, bounds: { x: 320, y: 540, width: 1600, height: 540 } },
] as const;

export const SPACE_SIZE = { width: 2240, height: 2880 } as const;
