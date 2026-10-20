import assert from 'node:assert/strict';
import test from 'node:test';
import { zoomAt, fitBounds } from '../src/camera.ts';

test('zoomAt keeps the map pixel under the cursor fixed', () => {
  const camera = { x: -420, y: 130, scale: 0.75 };
  const point = { x: 330, y: 200 };
  const result = zoomAt(camera, 2, point.x, point.y);
  assert.equal((point.x - result.x) / result.scale, (point.x - camera.x) / camera.scale);
  assert.equal((point.y - result.y) / result.scale, (point.y - camera.y) / camera.scale);
});

test('zoomAt clamps at both bounds while retaining the anchor', () => {
  for (const [factor, expected] of [[0.00001, 0.025], [10000, 12]]) {
    const result = zoomAt({ x: 0, y: 0, scale: 1 }, factor, 50, 100);
    assert.equal(result.scale, expected);
    assert.ok(Math.abs((50 - result.x) / result.scale - 50) < 1e-10);
    assert.ok(Math.abs((100 - result.y) / result.scale - 100) < 1e-10);
  }
});

test('fitBounds centres the visible world, excluding source-image margins', () => {
  const bounds = { x: 640, y: 704, width: 5120, height: 2816 };
  const size = { width: 1200, height: 800 };
  const result = fitBounds(bounds, size);
  assert.ok(bounds.x * result.scale + result.x >= 27.999);
  assert.ok(bounds.y * result.scale + result.y >= 27.999);
  assert.ok((bounds.x + bounds.width) * result.scale + result.x <= size.width - 27.999);
  assert.ok((bounds.y + bounds.height) * result.scale + result.y <= size.height - 27.999);
  assert.equal((bounds.x + bounds.width / 2) * result.scale + result.x, size.width / 2);
  assert.equal((bounds.y + bounds.height / 2) * result.scale + result.y, size.height / 2);
});

test('fitBounds returns a usable positive scale before layout is measured', () => {
  assert.ok(fitBounds({ x: 0, y: 0, width: 8320, height: 4576 }, { width: 1, height: 1 }).scale > 0);
});
