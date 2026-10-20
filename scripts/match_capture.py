#!/usr/bin/env python3
"""Rank recorded Animal Well rooms against an atlas using structural features.

Scores and margins are heuristics, not calibrated probabilities. Matching does not
alter gameplay images or remove the player, cursor, HUD, or visual effects.
"""
from __future__ import annotations

import argparse
import glob
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOM_SIZE = (320, 176)


def structure_features(image: Image.Image) -> np.ndarray:
    """Return normalised, clipped edge features insensitive to broad colour shifts."""
    grey = image.convert('L').resize(ROOM_SIZE, Image.Resampling.BOX)
    grey = grey.filter(ImageFilter.GaussianBlur(1)).resize((160, 88), Image.Resampling.BOX)
    values = np.asarray(grey, dtype=np.float32) / 255
    horizontal = np.abs(values[1:-1, 2:] - values[1:-1, :-2])
    vertical = np.abs(values[2:, 1:-1] - values[:-2, 1:-1])
    mask = np.ones_like(horizontal)
    # Ignore bottom-corner HUD and the cursor seen in the supplied recording.
    mask[77:, :31] = 0
    mask[77:, 118:] = 0
    mask[57:66, 98:107] = 0
    features = np.concatenate(((np.minimum(horizontal, .15) * mask).ravel(),
                               (np.minimum(vertical, .15) * mask).ravel()))
    return features / max(float(np.linalg.norm(features)), 1e-9)


def atlas_features(atlas: Image.Image) -> tuple[list[tuple[int, int]], np.ndarray]:
    """Index non-empty, full room cells using zero-based atlas column and row."""
    coordinates, features = [], []
    for row in range(atlas.height // ROOM_SIZE[1]):
        for column in range(atlas.width // ROOM_SIZE[0]):
            room = atlas.crop((column * 320, row * 176, (column + 1) * 320, (row + 1) * 176))
            feature = structure_features(room)
            if np.linalg.norm(feature) < .01:
                continue
            coordinates.append((column, row))
            features.append(feature)
    if not features:
        raise ValueError('Atlas contains no room cells with structural detail')
    return coordinates, np.stack(features)


def rank_frame(image: Image.Image, coordinates: list[tuple[int, int]],
               features: np.ndarray, minimum_score: float = .48,
               minimum_margin: float = .05) -> dict:
    """Return three ranked candidates and a conservative heuristic acceptance flag."""
    scores = features @ structure_features(image)
    ranked = np.argsort(scores, kind='stable')[::-1][:3]
    candidates = [{'column': coordinates[index][0], 'row': coordinates[index][1],
                   'score': float(scores[index])} for index in ranked]
    margin = candidates[0]['score'] - candidates[1]['score'] if len(candidates) > 1 else 0.
    return {'accepted': candidates[0]['score'] >= minimum_score and margin >= minimum_margin,
            'margin': margin, 'candidates': candidates}


def group_rooms(matches: list[dict]) -> list[dict]:
    """Choose the strongest accepted frame per cell, retaining all accepted repeats."""
    grouped: dict[tuple[int, int], dict] = {}
    for match in matches:
        if not match['accepted']:
            continue
        candidate = match['candidates'][0]
        key = (candidate['column'], candidate['row'])
        if key not in grouped:
            grouped[key] = {'column': key[0], 'row': key[1], 'best_frame': match['frame'],
                            'score': candidate['score'], 'margin': match['margin'], 'frames': []}
        room = grouped[key]
        room['frames'].append(match['frame'])
        if candidate['score'] > room['score']:
            room.update(best_frame=match['frame'], score=candidate['score'], margin=match['margin'])
    return sorted(grouped.values(), key=lambda room: (room['row'], room['column']))


def write_contact_sheets(rooms: list[dict], atlas: Image.Image, output: Path) -> list[str]:
    """Write paginated gameplay/atlas pairs for human inspection, without image cleanup."""
    paths = []
    for start in range(0, len(rooms), 24):
        batch = rooms[start:start + 24]
        sheet = Image.new('RGB', (640, len(batch) * 200), '#111111')
        draw = ImageDraw.Draw(sheet)
        for index, room in enumerate(batch):
            y = index * 200
            with Image.open(room['best_frame']) as image:
                sheet.paste(image.convert('RGB').resize(ROOM_SIZE), (0, y))
            column, row = room['column'], room['row']
            sheet.paste(atlas.crop((column * 320, row * 176, (column + 1) * 320, (row + 1) * 176)), (320, y))
            draw.text((4, y + 179), f"cell {column},{row} score {room['score']:.3f} margin {room['margin']:.3f} | {Path(room['best_frame']).name}", fill='white')
        path = output / f'matches-{start // 24 + 1:02d}.jpg'
        sheet.save(path, quality=90)
        paths.append(str(path.resolve()))
    return paths


def frame_inputs(pattern: str) -> tuple[list[Path], dict[str, float]]:
    """Read sampled-frame directories or globs, using manifest PTS when available."""
    directory = Path(pattern)
    files = sorted(directory.glob('frame-*.png')) if directory.is_dir() else [Path(file) for file in sorted(glob.glob(pattern))]
    manifest = (directory if directory.is_dir() else files[0].parent if files else directory.parent) / 'capture.json'
    times = {}
    if manifest.is_file():
        data = json.loads(manifest.read_text())
        times = {str((manifest.parent / frame['file']).resolve()): frame['seconds'] for frame in data['frames']}
    return files, times


def main() -> None:
    """Match pre-cropped frames and save reviewable candidates and representative pairs."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--atlas', type=Path, default=Path('public/maps/20240603_4757794989373292024.webp'))
    parser.add_argument('--frames', default='.local/capture-analysis/frame-*.png', help='Directory or glob of room-only frames')
    parser.add_argument('--output', type=Path, default=Path('.local/capture-analysis/matching'))
    parser.add_argument('--minimum-score', type=float, default=.48)
    parser.add_argument('--minimum-margin', type=float, default=.05)
    args = parser.parse_args()
    files, times = frame_inputs(args.frames)
    if not files:
        parser.error('No frames matched --frames')
    args.output.mkdir(parents=True, exist_ok=True)
    with Image.open(args.atlas) as source:
        atlas = source.convert('RGB')
    coordinates, features = atlas_features(atlas)
    matches = []
    for file in files:
        with Image.open(file) as image:
            result = rank_frame(image, coordinates, features, args.minimum_score, args.minimum_margin)
        frame_path = str(file.resolve())
        matches.append({'frame': frame_path, **({'seconds': times[frame_path]} if frame_path in times else {}), **result})
    rooms = group_rooms(matches)
    report = {'method': 'Clipped, normalised luminance gradients; scores are heuristic, not probabilities.',
              'atlas': str(args.atlas.resolve()), 'room_size': ROOM_SIZE,
              'thresholds': {'minimum_score': args.minimum_score, 'minimum_margin': args.minimum_margin},
              'feature_masks': 'Bottom-corner HUD; fixed cursor near native pixel 205,122. Images remain unchanged.',
              'indexed_cells': len(coordinates), 'frame_count': len(matches),
              'accepted_frames': sum(match['accepted'] for match in matches),
              'distinct_accepted_cells': len(rooms), 'rooms': rooms, 'matches': matches,
              'contact_sheets': write_contact_sheets(rooms, atlas, args.output)}
    (args.output / 'matches.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ('frame_count', 'accepted_frames', 'distinct_accepted_cells')}))


if __name__ == '__main__':
    main()
