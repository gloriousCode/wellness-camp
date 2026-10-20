import type { Screen } from './types';
export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 176;

/** Identify populated atlas cells from a reduced pixel buffer; IDs refer to image coordinates. */
export function detectScreens(pixels: Uint8ClampedArray, width: number, height: number, imageWidth: number, imageHeight: number): Screen[] {
  const screens: Screen[] = [];
  const columns = Math.ceil(imageWidth / SCREEN_WIDTH);
  const rows = Math.ceil(imageHeight / SCREEN_HEIGHT);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = column * SCREEN_WIDTH, y = row * SCREEN_HEIGHT;
      const cellWidth = Math.min(SCREEN_WIDTH, imageWidth - x);
      const cellHeight = Math.min(SCREEN_HEIGHT, imageHeight - y);
      const left = Math.ceil(x / imageWidth * width);
      const right = Math.min(width, Math.ceil((x + cellWidth) / imageWidth * width));
      const top = Math.ceil(y / imageHeight * height);
      const bottom = Math.min(height, Math.ceil((y + cellHeight) / imageHeight * height));
      let visible = 0;
      for (let py = top; py < bottom; py++) {
        for (let px = left; px < right; px++) {
          const offset = (py * width + px) * 4;
          if (pixels[offset + 3] > 0 && Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > 18) visible++;
        }
      }
      if (visible >= Math.max(2, (right - left) * (bottom - top) * 0.005)) {
        screens.push({ id: `${String(column).padStart(2, '0')},${String(row).padStart(2, '0')}`, column, row, x, y, width: cellWidth, height: cellHeight });
      }
    }
  }
  return screens;
}

export function screenAt(screens: Screen[], x: number, y: number): Screen | undefined {
  return screens.find(screen => x >= screen.x && x < screen.x + screen.width && y >= screen.y && y < screen.y + screen.height);
}

export function screenMatches(screen: Screen, query: string): boolean {
  const text = query.toLowerCase().replace(/screen|row|column/g, '').trim();
  if (!text) return true;
  const coordinates = text.match(/^(\d+)\s*,\s*(\d+)$/);
  if (coordinates) return screen.column === Number(coordinates[1]) && screen.row === Number(coordinates[2]);
  return text.split(/\s+/).every(token => screen.id.includes(token));
}
