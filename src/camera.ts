import type { Bounds, Camera, Size } from './types';

export function zoomAt(camera: Camera, factor: number, x: number, y: number): Camera {
  const scale = Math.max(0.025, Math.min(12, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { scale, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio };
}

export function fitBounds(bounds: Bounds, size: Size): Camera {
  const scale = Math.max(0.025, Math.min((size.width - 56) / bounds.width, (size.height - 56) / bounds.height, 4));
  return { scale, x: (size.width - bounds.width * scale) / 2 - bounds.x * scale,
    y: (size.height - bounds.height * scale) / 2 - bounds.y * scale };
}

export function imageBounds(image: HTMLImageElement): Bounds {
  // Inspect a small thumbnail only; retain the untouched source image for drawing.
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 520 / image.naturalWidth);
  canvas.width = Math.ceil(image.naturalWidth * ratio);
  canvas.height = Math.ceil(image.naturalHeight * ratio);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, right = 0, top = canvas.height, bottom = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 30) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (left > right) return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  return { x: Math.max(0, left - 2) / ratio, y: Math.max(0, top - 2) / ratio,
    width: (right - left + 5) / ratio, height: (bottom - top + 5) / ratio };
}
