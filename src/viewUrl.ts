import type { Area, Camera, ImageryMode, Size, WorldView } from './types';

/** Bounds increase rightwards and downwards, matching image and canvas coordinates. */
export function cameraView(camera: Camera, size: Size): WorldView {
  return { left: -camera.x / camera.scale, top: -camera.y / camera.scale,
    right: (size.width - camera.x) / camera.scale, bottom: (size.height - camera.y) / camera.scale };
}

export function readView(params: URLSearchParams): WorldView | undefined {
  const keys = ['top', 'bottom', 'left', 'right'] as const;
  if (!keys.every(key => params.has(key))) return;
  const view = Object.fromEntries(keys.map(key => [key, Number(params.get(key))])) as unknown as WorldView;
  if (!Object.values(view).every(Number.isFinite) || view.right <= view.left || view.bottom <= view.top) return;
  return view;
}

export function viewUrl(url: URL, map: string, view: WorldView, screen?: string, imagery: ImageryMode = 'normal', area: Area = 'well'): URL {
  const result = new URL(url);
  result.hash = '';
  result.search = '';
  result.searchParams.set('map', map);
  if (area === 'space') result.searchParams.set('area', area);
  for (const key of ['top', 'bottom', 'left', 'right'] as const) result.searchParams.set(key, view[key].toFixed(3));
  if (imagery !== 'normal') result.searchParams.set('imagery', imagery);
  if (screen) result.searchParams.set('room', screen);
  else result.searchParams.delete('room');
  return result;
}
