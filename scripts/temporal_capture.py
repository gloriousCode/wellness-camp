#!/usr/bin/env python3
"""Locate recording gaps bracketed by straight, known atlas traversal."""
import json
from pathlib import Path


def bracketed_gaps(matches, unresolved, maximum_seconds=8):
    """Return candidate time windows; temporal evidence alone never accepts rooms."""
    runs = []
    for match in sorted(matches, key=lambda item: item['seconds']):
        if not match.get('accepted'):
            continue
        candidate = match['candidates'][0]
        cell = (candidate['column'], candidate['row'])
        if runs and runs[-1]['cell'] == cell:
            runs[-1]['end'] = match['seconds']
        else:
            runs.append({'cell': cell, 'start': match['seconds'], 'end': match['seconds']})
    windows = []
    for before, after in zip(runs, runs[1:]):
        x0, y0 = before['cell']; x1, y1 = after['cell']
        distance = abs(x1-x0) + abs(y1-y0)
        duration = after['start'] - before['end']
        if (x0 != x1 and y0 != y1) or not 2 <= distance <= 5 or not 0 < duration <= maximum_seconds:
            continue
        dx = (x1 > x0) - (x1 < x0); dy = (y1 > y0) - (y1 < y0)
        for step in range(1, distance):
            cell = (x0 + dx*step, y0 + dy*step)
            if cell not in unresolved:
                continue
            windows.append({'cell': list(cell), 'seconds': before['end'] + duration*step/distance,
                            'start': before['end'], 'end': after['start'],
                            'before': list(before['cell']), 'after': list(after['cell']),
                            'status': 'Candidate only; geometry review required'})
    return windows


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--matches', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = json.loads(args.matches.read_text())
    unresolved = {tuple(map(int, room.split(','))) for room in report['coverage']['unmatchedRoomIds']}
    windows = bracketed_gaps(report['matches'], unresolved)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'method': __doc__, 'windows': windows}, indent=2)+'\n')
    print(f'{len(windows)} temporal candidate windows')
