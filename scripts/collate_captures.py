#!/usr/bin/env python3
"""Combine reviewed matching passes into a timestamped gameplay layer inventory."""

import argparse
import json
from pathlib import Path

from PIL import Image

from match_capture import group_rooms


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--matches', nargs='+', type=Path, required=True)
    parser.add_argument('--captures', nargs='+', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--cell-bounds', nargs=4, type=int, default=[2, 4, 17, 19],
                        metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'), help='Inclusive atlas cell bounds')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Choose a new output directory to preserve previous analysis')
    captures = [json.loads(path.read_text()) for path in args.captures]
    if len({capture['video'] for capture in captures}) != 1 or len({tuple(capture['crop']) for capture in captures}) != 1:
        parser.error('All capture passes must use the same recording and crop')
    times = {}
    for path, capture in zip(args.captures, captures):
        for frame in capture['frames']:
            times[str((path.parent / frame['file']).resolve())] = frame['seconds']
    reports = [json.loads(path.read_text()) for path in args.matches]
    matches = {}
    excluded = []
    left, top, right, bottom = args.cell_bounds
    if left > right or top > bottom:
        parser.error('Cell bounds must increase rightwards and downwards')
    for path, report in zip(args.matches, reports):
        for match in report['matches']:
            if not match['accepted']:
                continue
            candidate = match['candidates'][0]
            column, row = candidate['column'], candidate['row']
            if not (left <= column <= right and top <= row <= bottom):
                excluded.append({'frame': match['frame'], 'cell': [column, row], 'report': str(path)})
                continue
            frame = str(Path(match['frame']).resolve())
            if frame not in times:
                raise ValueError(f'No recorded timestamp for {frame}')
            previous = matches.get(frame)
            if previous and (previous['candidates'][0]['column'], previous['candidates'][0]['row']) != (column, row):
                raise ValueError(f'Conflicting accepted room assignments for {frame}; review before publishing')
            # Later review reports can add corroboration to an already accepted sample.
            matches[frame] = {**match, 'frame': frame, 'seconds': times[frame], 'review_report': str(path)}
    accepted = sorted(matches.values(), key=lambda match: (match['seconds'], match['frame']))
    rooms = group_rooms(accepted)
    placed = {(room['column'], room['row']) for room in rooms}
    coverage = {'cellBounds': args.cell_bounds, 'totalCells': (right - left + 1) * (bottom - top + 1),
                'capturedCells': len(rooms),
                'unmatchedRoomIds': [f'{column:02d},{row:02d}' for row in range(top, bottom + 1)
                                     for column in range(left, right + 1) if (column, row) not in placed]}
    args.output.mkdir(parents=True)
    source = args.output / 'source-rooms'
    source.mkdir()
    inventory = []
    for room in rooms:
        file = f"room-{room['column']:02d}-{room['row']:02d}.png"
        with Image.open(room['best_frame']) as image:
            if image.size != (320, 176):
                raise ValueError(f'Expected a calibrated room crop: {room["best_frame"]}')
            image.convert('RGB').save(source / file)
        inventory.append({**room, 'seconds': times[room['best_frame']], 'image': file,
                          'review_status': 'Reviewed candidate placement; recorded pixels, possible occlusion',
                          'inferredLocation': bool(matches[room['best_frame']].get('inferred_location')),
                          'reviewEvidence': matches[room['best_frame']].get('acceptance_reason',
                              'Global structural matching with candidate score and margin; placement reviewed')})
    capture = {**captures[0], 'sampling': 'Union of recorded samples from multiple passes',
               'frames': [{'file': frame, 'seconds': seconds} for frame, seconds in sorted(times.items(), key=lambda item: item[1])]}
    report = {'method': 'Union of accepted samples from reviewed matching passes',
              'source_reports': [str(path.resolve()) for path in args.matches], 'cell_bounds': args.cell_bounds,
              'frame_count': len(accepted), 'distinct_accepted_cells': len(rooms), 'matches': accepted,
              'rooms': rooms, 'coverage': coverage, 'excluded_outside_bounds': excluded}
    layer = {'recording': captures[0]['video'], 'crop': captures[0]['crop'], 'image_size': [320, 176],
             'rooms': inventory, 'coverage': coverage,
             'processing': 'Strongest accepted recorded sample per reviewed atlas cell'}
    for path, value in [(args.output / 'capture.json', capture), (args.output / 'matches.json', report),
                        (source / 'rooms.json', layer)]:
        path.write_text(json.dumps(value, indent=2) + '\n')
    print(f'Collated {len(accepted)} accepted samples across {len(rooms)} cells; excluded {len(excluded)} outside bounds')


if __name__ == '__main__':
    main()
