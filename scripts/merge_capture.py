#!/usr/bin/env python3
"""Conservatively combine repeatedly revealed patches from matched room recordings.

Every output pixel comes unchanged from a recorded sample. This cannot recover
unseen details and does not remove stationary HUD, cursor or gameplay objects.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from match_capture import structure_features


def merge_patches(frames: np.ndarray, base_index: int = 0, times: list[float] | None = None,
                  patch_size: int = 16) -> tuple[np.ndarray, np.ndarray, list[dict]]:
    """Copy clearer patches supported by at least two temporally separate samples.

    Selection uses luminance detail, not maximum brightness. Near-identical patch
    support suppresses transient bright particles and moving players. No blending
    or sharpening occurs. Fixed bottom HUD and the supplied recording's cursor
    region remain from the base frame. Small seams or persistent objects can remain.
    """
    if frames.ndim != 4 or frames.shape[-1] != 3 or not len(frames):
        raise ValueError('Expected one or more RGB frames of equal dimensions')
    if not 0 <= base_index < len(frames) or patch_size < 4:
        raise ValueError('Invalid base index or patch size')
    if times is not None and len(times) != len(frames):
        raise ValueError('A timestamp is required for every frame')
    values = frames.astype(np.float32)
    luminance = values @ np.array([.2126, .7152, .0722], dtype=np.float32)
    output = frames[base_index].copy()
    sources = np.full(frames.shape[1:3], base_index, dtype=np.uint16)
    changes = []
    height, width = output.shape[:2]
    for y in range(0, height, patch_size):
        for x in range(0, width, patch_size):
            right, bottom = min(x + patch_size, width), min(y + patch_size, height)
            if bottom > height - 24 or (x < 216 and right > 194 and y < 134 and bottom > 112):
                continue
            patches = values[:, y:bottom, x:right]
            grey = luminance[:, y:bottom, x:right]
            detail = (np.abs(np.diff(grey, axis=1)).mean(axis=(1, 2)) +
                      np.abs(np.diff(grey, axis=2)).mean(axis=(1, 2))) / 2
            brightness = grey.mean(axis=(1, 2))
            # A meaningful rise in both visible structure and illumination is
            # required; avoid changing already clear regions for animation alone.
            eligible = np.flatnonzero((detail > detail[base_index] * 1.18 + .45) &
                                      (brightness > brightness[base_index] + 4))
            ranked = sorted(eligible, key=lambda index: float(detail[index]), reverse=True)
            for index in ranked:
                difference = np.abs(patches - patches[index]).mean(axis=(1, 2, 3))
                support = (difference < 4.5) & (detail >= detail[index] * .85)
                support[index] = False
                if times is not None:
                    support &= np.abs(np.asarray(times) - times[index]) >= .3
                if not support.any():
                    continue
                # Select a whole factual patch, retaining the RGB values exactly.
                output[y:bottom, x:right] = frames[index, y:bottom, x:right]
                sources[y:bottom, x:right] = index
                changes.append({'rectangle': [x, y, right, bottom], 'source_index': int(index),
                                'support_indices': np.flatnonzero(support).tolist(),
                                'detail_before': float(detail[base_index]), 'detail_after': float(detail[index])})
                break
    return output, sources, changes


def write_existing_layer(existing_path: Path, merged_rooms: list[dict], matching: dict,
                         output: Path, minimum_changed_pixels: int = 1) -> dict:
    """Write build-ready imagery for exactly the original layer's room coverage.

    Rooms with no accepted composite retain their original pixels after the same
    BOX downsampling used by the atlas builder. New dense matches never expand
    coverage implicitly. Composite metadata retains original and new timestamps.
    """
    original = json.loads(existing_path.read_text())
    if minimum_changed_pixels < 1:
        raise ValueError('Minimum changed pixels must be positive')
    composites = {(room['column'], room['row']): room for room in merged_rooms
                  if room['changes'] and room['changed_pixels'] >= minimum_changed_pixels}
    matches = {match['frame']: match for match in matching['matches']}
    layer = output / 'layer'
    layer.mkdir()
    rooms = []
    changed = 0
    for original_room in original['rooms']:
        room = dict(original_room)
        room['image'] = f"room-{room['column']:02d}-{room['row']:02d}.png"
        merged = composites.get((room['column'], room['row']))
        source = output / merged['file'] if merged else existing_path.parent / original_room['image']
        with Image.open(source) as image:
            image.convert('RGB').resize((320, 176), Image.Resampling.BOX).save(layer / room['image'])
        if merged:
            changed += 1
            base = matches[merged['base_frame']]
            room.update(best_frame=merged['base_frame'],
                        frames=[frame['file'] for frame in merged['frames']],
                        seconds=merged['frames'][merged['base_index']]['seconds'],
                        score=base['candidates'][0]['score'], margin=base['margin'])
            room['temporalMerge'] = {
                'originalSeconds': original_room['seconds'], 'baseSeconds': room['seconds'],
                'changedPixelsFromDenseBase': merged['changed_pixels'],
                'frames': [{'seconds': frame['seconds']} for frame in merged['frames']],
                'patches': merged['changes'],
            }
        rooms.append(room)
    result = {**original, 'image_size': [320, 176], 'rooms': rooms,
              'processing': f'{changed} rooms combine repeatedly revealed patches from recorded frames; player, HUD, cursor and effects remain'}
    (layer / 'rooms.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main() -> None:
    """Write new room composites with source maps and timestamped provenance."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--matches', type=Path, required=True)
    parser.add_argument('--capture', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--existing-rooms', type=Path,
                        help='Also write layer/rooms.json preserving this existing layer coverage and untouched images')
    parser.add_argument('--minimum-changed-pixels', type=int, default=1,
                        help='Minimum changed pixels before replacing an existing room with its composite')
    args = parser.parse_args()
    if args.minimum_changed_pixels < 1:
        parser.error('--minimum-changed-pixels must be positive')
    if args.output.exists():
        parser.error('Output already exists; use a new directory to preserve originals')
    matching = json.loads(args.matches.read_text())
    capture = json.loads(args.capture.read_text())
    times = {str((args.capture.parent / sample['file']).resolve()): sample['seconds']
             for sample in capture['frames']}
    args.output.mkdir(parents=True)
    rooms = []
    for room in matching['rooms']:
        paths = room['frames']
        base_index = paths.index(room['best_frame'])
        images = []
        for path in paths:
            with Image.open(path) as image:
                images.append(np.asarray(image.convert('RGB')).copy())
        base_feature = structure_features(Image.fromarray(images[base_index]))
        retained = [index for index, pixels in enumerate(images)
                    if float(structure_features(Image.fromarray(pixels)) @ base_feature) >= .55]
        # Room transitions can pass atlas matching; retain only samples agreeing
        # structurally with this room's strongest original frame.
        images = [images[index] for index in retained]
        paths = [paths[index] for index in retained]
        base_index = retained.index(base_index)
        seconds = [times.get(str(Path(path).resolve())) for path in paths]
        if any(value is None for value in seconds):
            raise ValueError('Capture manifest is missing a matched frame timestamp')
        merged, source_map, changes = merge_patches(np.stack(images), base_index, seconds)
        name = f"room-{room['column']:02d}-{room['row']:02d}"
        Image.fromarray(merged).save(args.output / f'{name}.png')
        Image.fromarray(source_map).save(args.output / f'{name}-sources.png')
        rooms.append({'column': room['column'], 'row': room['row'], 'file': f'{name}.png',
                      'base_frame': room['best_frame'], 'base_index': base_index,
                      'frames': [{'file': path, 'seconds': seconds[index]} for index, path in enumerate(paths)],
                      'rejected_structure_frames': len(room['frames']) - len(paths),
                      'changed_pixels': int(np.any(merged != images[base_index], axis=2).sum()),
                      'changes': changes, 'source_map': f'{name}-sources.png'})
    report = {'method': 'Unblended 16px patches with repeated luminance-detail support; no generated pixels.',
              'limitations': 'Heuristic matches; unseen details remain hidden. Fixed HUD/cursor preserved. Persistent objects and patch seams may remain.',
              'capture': str(args.capture.resolve()), 'matches': str(args.matches.resolve()),
              'changed_rooms': sum(bool(room['changes']) for room in rooms), 'rooms': rooms}
    (args.output / 'merges.json').write_text(json.dumps(report, indent=2) + '\n')
    if args.existing_rooms:
        write_existing_layer(args.existing_rooms, rooms, matching, args.output,
                             args.minimum_changed_pixels)
    changed = sorted((room for room in rooms if room['changes']), key=lambda room: room['changed_pixels'], reverse=True)[:12]
    if changed:
        preview = Image.new('RGB', (640, len(changed) * 196), '#10101a')
        draw = ImageDraw.Draw(preview)
        for index, room in enumerate(changed):
            with Image.open(room['base_frame']) as image:
                preview.paste(image.convert('RGB'), (0, index * 196))
            with Image.open(args.output / room['file']) as image:
                preview.paste(image.convert('RGB'), (320, index * 196))
            draw.text((4, index * 196 + 178), f"{room['column']},{room['row']} original | merged: {room['changed_pixels']} changed pixels", fill='white')
        preview.save(args.output / 'preview.png')
    print(json.dumps({'rooms': len(rooms), 'changed_rooms': report['changed_rooms']}))


if __name__ == '__main__':
    main()
