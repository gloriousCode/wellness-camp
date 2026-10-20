#!/usr/bin/env python3
"""Approximate the recording's fixed mouse cursor with a nearby recorded patch.

This is a local pixel repair, not recovered footage. Originals are never overwritten.
Only the measured cursor silhouette, including its antialiasing/shadow, may change.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

NATIVE_SIZE = (320, 176)
# Coordinates measured in the supplied 2560 x 1408 room-only recording crop.
CURSOR_POLYGON = [(1640, 961), (1645, 961), (1665, 980), (1665, 984),
                  (1657, 987), (1662, 994), (1661, 998), (1656, 1000),
                  (1652, 998), (1648, 991), (1643, 994), (1640, 991)]


def cursor_mask(size: tuple[int, int]) -> np.ndarray:
    """Scale the measured silhouette to an integer multiple of a native room."""
    if size[0] % 320 or size[1] % 176 or size[0] // 320 != size[1] // 176:
        raise ValueError('Expected an integer-scaled 320 x 176 room')
    canonical = Image.new('L', (2560, 1408))
    ImageDraw.Draw(canonical).polygon(CURSOR_POLYGON, fill=255)
    canonical = canonical.filter(ImageFilter.MaxFilter(3))
    return np.asarray(canonical.resize(size, Image.Resampling.BOX)) > 0


def cursor_present(image: Image.Image) -> bool:
    """Require the distinctive fixed white outline and black arrow interior."""
    native = np.asarray(image.convert('RGB').resize(NATIVE_SIZE, Image.Resampling.BOX))
    samples = np.array([native[y, x] for x, y in [(205, 120), (205, 121), (206, 121),
                       (205, 122), (207, 122), (205, 123), (206, 123),
                       (207, 123), (206, 124), (207, 124)]], dtype=np.int16)
    white = (samples.min(axis=1) >= 35) & (samples.max(axis=1) <= 240)
    neutral = np.ptp(samples, axis=1) <= 120
    return bool(np.count_nonzero(white & neutral) >= 9 and native[122, 206].max() <= 22)


def repair_cursor(image: Image.Image, search_radius: int = 28, assume_fixed: bool = False) -> tuple[Image.Image, np.ndarray, dict]:
    """Copy a context-matched nearby patch solely inside the fixed cursor mask.

    Candidate translations preserve original pixels and prefer the same scanline
    where contextual errors tie. Shapes hidden by the cursor remain approximate.
    """
    original = np.asarray(image.convert('RGB'))
    mask = cursor_mask(image.size)
    changed = np.zeros(mask.shape, dtype=bool)
    metadata = {'method': 'Approximate local exemplar patch; hidden pixels are not recovered',
                'detected': cursor_present(image), 'changed_pixels': 0, 'forced': bool(assume_fixed)}
    if not metadata['detected'] and not assume_fixed:
        return Image.fromarray(original), changed, metadata
    if search_radius < 6:
        raise ValueError('Search radius must be at least six native pixels')
    native = np.asarray(image.convert('RGB').resize(NATIVE_SIZE, Image.Resampling.BOX), dtype=np.float32)
    native_mask = cursor_mask(NATIVE_SIZE)
    # Wider structure plus a strongly weighted narrow ring helps continue walls.
    x0, y0, x1, y1 = 200, 115, 214, 131
    target = native[y0:y1, x0:x1]
    forbidden = native_mask[y0:y1, x0:x1]
    expanded = np.asarray(Image.fromarray(native_mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    weight = np.where(expanded[y0:y1, x0:x1], 4., 1.) * ~forbidden
    best = None
    for dy in range(-search_radius, search_radius + 1):
        for dx in range(-search_radius, search_radius + 1):
            if not (0 <= x0 + dx < x1 + dx <= 320 and 0 <= y0 + dy < y1 + dy <= 176):
                continue
            # The donor rectangle must not contain the original cursor.
            if native_mask[y0 + dy:y1 + dy, x0 + dx:x1 + dx].any():
                continue
            candidate = native[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            error = float((((candidate - target) ** 2).mean(axis=2) * weight).sum() / weight.sum())
            rank = (error, abs(dy), abs(dx), dy, dx)
            if best is None or rank < best:
                best = rank
    if best is None:
        raise ValueError('No cursor-free donor patch available')
    error, _, _, dy, dx = best
    scale = image.width // 320
    ys, xs = np.where(mask)
    result = original.copy()
    result[ys, xs] = original[ys + dy * scale, xs + dx * scale]
    changed = np.any(result != original, axis=2)
    metadata.update(changed_pixels=int(changed.sum()), mask_pixels=int(mask.sum()),
                    donor_translation_native=[dx, dy], context_mse=error,
                    mask_bounds=[int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)])
    return Image.fromarray(result), changed, metadata


def repair_collection(source: Path, output: Path, assume_fixed: bool = False) -> dict:
    """Write cleaned siblings, exact change masks and a provenance manifest."""
    if source.resolve() == output.resolve():
        raise ValueError('Output must differ from the original directory')
    manifest = source if source.is_file() else source / 'rooms.json'
    data = json.loads(manifest.read_text()) if manifest.is_file() else None
    base = manifest.parent if data else source
    paths = [Path(room['image']) for room in data['rooms']] if data else [path.relative_to(base) for path in sorted(base.glob('*.png'))]
    if not paths:
        raise ValueError('No room images found')
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    for relative in paths:
        path = base / relative
        with Image.open(path) as original:
            repaired, changed, evidence = repair_cursor(original, assume_fixed=assume_fixed)
        destination = output / relative.with_suffix('.png')
        if destination.resolve() == path.resolve():
            raise ValueError('Refusing to overwrite original image')
        destination.parent.mkdir(parents=True, exist_ok=True)
        repaired.save(destination)
        mask_name = relative.with_suffix('.mask.png')
        Image.fromarray(changed.astype(np.uint8) * 255).save(output / mask_name)
        entries.append({'source': str(path.resolve()), 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'image': str(destination.relative_to(output)), 'changed_mask': str(mask_name), **evidence})
    if data:
        for room, entry in zip(data['rooms'], entries):
            room['image'] = entry['image']
            room['cursorRepair'] = entry
        data['processing'] = str(data.get('processing', '')) + '; approximate fixed cursor repair; originals preserved'
        (output / 'rooms.json').write_text(json.dumps(data, indent=2) + '\n')
    result = {'method': 'Approximate local pixel repair, not recovered background', 'images': entries,
              'repaired_images': sum(entry['detected'] or entry['forced'] for entry in entries)}
    (output / 'cursor-repair.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main() -> None:
    """Repair room-only images from a directory or rooms.json manifest."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rooms', dest='source', type=Path, required=True, help='rooms.json manifest or image directory')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--assume-fixed', action='store_true', help='Repair the measured fixed cursor even when prior processing weakened its outline; requires visually confirmed source provenance')
    args = parser.parse_args()
    result = repair_collection(args.source, args.output, assume_fixed=args.assume_fixed)
    print(f"Repaired {result['repaired_images']} of {len(result['images'])} images; originals preserved")


if __name__ == '__main__':
    main()
