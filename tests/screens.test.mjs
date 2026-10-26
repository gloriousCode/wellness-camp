import assert from 'node:assert/strict';
import test from 'node:test';
import { detectScreens, screenAt, screenMatches } from '../src/screens.ts';

const screen = { id: '02,04', column: 2, row: 4, x: 640, y: 704, width: 320, height: 176 };

test('detectScreens retains populated cells at their source coordinates and excludes black margins', () => {
  const width = 120, height = 44, pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 22; y < 44; y++) for (let x = 40; x < 80; x++) {
    const offset = (y * width + x) * 4;
    pixels[offset] = 200; pixels[offset + 3] = 255;
  }
  assert.deepEqual(detectScreens(pixels, width, height, 960, 352), [{ id: '01,01', column: 1, row: 1, x: 320, y: 176, width: 320, height: 176 }]);
});

test('detectScreens ignores transparent colour and isolated compression noise', () => {
  const width = 40, height = 22, pixels = new Uint8ClampedArray(width * height * 4);
  pixels[0] = 255;
  pixels[4] = 255; pixels[7] = 255;
  assert.deepEqual(detectScreens(pixels, width, height, 320, 176), []);
});

test('screenAt uses half-open edges so clicks on adjacent cells select only one', () => {
  const next = { ...screen, id: '03,04', column: 3, x: 960 };
  assert.equal(screenAt([screen, next], 959.99, 704), screen);
  assert.equal(screenAt([screen, next], 960, 704), next);
  assert.equal(screenAt([screen], 640, 880), undefined);
  assert.equal(screenAt([screen], -1, 704), undefined);
});

test('screenMatches searches coordinates in the correct column,row order', () => {
  for (const query of ['', '02,04', '2,4', 'Screen 2, 4', '04']) assert.equal(screenMatches(screen, query), true, query);
  for (const query of ['4,2', '02,05', 'no match']) assert.equal(screenMatches(screen, query), false, query);
});

test('detectScreens preserves the native 180-pixel room grid of space captures', () => {
  const width = 40, height = 45;
  const pixels = new Uint8ClampedArray(width * height * 4);
  // A feature in row two must belong to Y=180, rather than the well's Y=176.
  for (let y = 30; y < 34; y++) for (let x = 8; x < 12; x++) {
    const offset = (y * width + x) * 4;
    pixels[offset] = 150; pixels[offset + 3] = 255;
  }
  const screens = detectScreens(pixels, width, height, 320, 360, 180);
  assert.deepEqual(screens, [{ id: '00,01', column: 0, row: 1, x: 0, y: 180, width: 320, height: 180 }]);
});
