import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraForView } from '../src/camera.ts';
import { cameraView, readView, viewUrl } from '../src/viewUrl.ts';

test('world bounds round-trip through camera coordinates without flipping Y', () => {
  const bounds = { left: 640, top: 704, right: 1280, bottom: 1056 };
  const size = { width: 640, height: 352 };
  const camera = cameraForView(bounds, size);
  assert.equal(camera.scale, 1);
  assert.equal(camera.y, -704);
  assert.deepEqual(cameraView(camera, size), bounds);
});

test('cameraForView fits different viewport shapes while preserving the centre', () => {
  const bounds = { left: -3264, top: -5493, right: 7688, bottom: 4588 };
  const size = { width: 800, height: 600 };
  const actual = cameraView(cameraForView(bounds, size), size);
  assert.ok(actual.left <= bounds.left && actual.right >= bounds.right);
  assert.ok(actual.top <= bounds.top && actual.bottom >= bounds.bottom);
  assert.ok(Math.abs((actual.top + actual.bottom) / 2 - (bounds.top + bounds.bottom) / 2) < 1e-8);
});

test('readView rejects missing, non-finite and reversed bounds', () => {
  for (const query of ['', 'top=0&bottom=1&left=0', 'top=0&bottom=NaN&left=0&right=1', 'top=5&bottom=0&left=0&right=1', 'top=0&bottom=1&left=1&right=1']) assert.equal(readView(new URLSearchParams(query)), undefined);
});

test('viewUrl creates reloadable bounds and room selection beneath a Pages project path', () => {
  const bounds = { top: 704, bottom: 880, left: 640, right: 960 };
  const url = viewUrl(new URL('https://example.github.io/wellness-camp/#map=old'), 'latest', bounds, '02,04');
  assert.equal(url.pathname, '/wellness-camp/');
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('map'), 'latest');
  assert.equal(url.searchParams.get('room'), '02,04');
  assert.deepEqual(readView(url.searchParams), bounds);
  assert.equal(viewUrl(url, 'latest', bounds).searchParams.has('room'), false);
});
