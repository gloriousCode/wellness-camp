#!/usr/bin/env python3
"""Replace confidently detected player sprites with recorded same-room pixels.

Detection uses a calibrated sprite template and remains deliberately conservative.
Only small sprite rectangles are copied; animations elsewhere retain base pixels.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw


def detect_player(image: np.ndarray, template: np.ndarray, threshold: float = .70, exclude_hud: bool = True) -> list[dict]:
    """Return non-overlapping template matches passing shape and colour checks."""
    if isinstance(template, list):
        candidates = [match for item in template for match in detect_player(image, item, threshold, exclude_hud)]
        result = []
        for candidate in sorted(candidates, key=lambda item: item['score'], reverse=True):
            x, y, right, bottom = candidate['rectangle']
            if not any(abs(x - item['rectangle'][0]) < 7 and abs(y - item['rectangle'][1]) < 7 for item in result):
                result.append(candidate)
        return result
    height, width = template.shape[:2]
    windows = np.lib.stride_tricks.sliding_window_view(image.astype(np.float32), (height, width), axis=(0, 1))
    # Shape is measured across RGB channels so purple feet and dark eyes matter.
    values = windows.transpose(0, 1, 3, 4, 2)
    centred = values - values.mean(axis=(2, 3, 4), keepdims=True)
    target = template.astype(np.float32) - template.mean()
    numerator = np.einsum('yxhwc,hwc->yx', centred, target)
    energy = np.sqrt(np.einsum('yxhwc,yxhwc->yx', centred, centred) * (target * target).sum())
    scores = numerator / np.maximum(energy, 1)
    matches = []
    for flat in np.argsort(scores.ravel())[::-1]:
        y, x = np.unravel_index(flat, scores.shape)
        score = float(scores[y, x])
        if score < threshold:
            break
        if exclude_hud and (y >= image.shape[0] - 22 or (194 < x < 216 and 110 < y < 134)):
            continue
        if any(abs(x - m['rectangle'][0]) < width and abs(y - m['rectangle'][1]) < height for m in matches):
            continue
        # Require similar hue distribution; structural shapes alone are insufficient.
        patch = values[y, x]
        scale = float((patch * template).sum() / max(float((template.astype(float) ** 2).sum()), 1))
        error = float(np.abs(patch - template * scale).mean())
        if .35 <= scale <= 2.5 and error < 15:
            matches.append({'rectangle': [int(x), int(y), int(x + width), int(y + height)], 'score': score, 'error': error})
    return matches


def replace_player(base: np.ndarray, rectangle: list[int], donors: list[np.ndarray], donor_ids: list[str],
                   template: np.ndarray, donor_times: list[float] | None = None) -> tuple[np.ndarray, dict | None]:
    """Copy one corroborated clean donor patch, leaving every other pixel intact."""
    x, y, right, bottom = rectangle
    # One pixel around the template covers interpolation edges without a broad halo.
    x, y, right, bottom = max(0, x - 1), max(0, y - 1), min(base.shape[1], right + 1), min(base.shape[0], bottom + 1)
    clean = []
    if donor_times is None:
        donor_times = list(range(len(donors)))
    for donor, identifier, seconds in zip(donors, donor_ids, donor_times):
        # Search only near the repair rectangle; a distant player cannot contaminate it.
        crop_x, crop_y = max(0, x - 8), max(0, y - 9)
        local = donor[crop_y:min(donor.shape[0], bottom + 9), crop_x:min(donor.shape[1], right + 8)]
        occupied = bool(detect_player(local, template, threshold=.65, exclude_hud=False))
        if not occupied:
            clean.append((donor[y:bottom, x:right], identifier, seconds))
    if len(clean) < 2:
        return base, None
    patches = np.array([item[0] for item in clean], dtype=np.float32)
    median = np.median(patches, axis=0)
    distances = np.abs(patches - median).mean(axis=(1, 2, 3))
    ranked = np.argsort(distances)
    index = int(ranked[0])
    # Two observations must corroborate the revealed background.
    support = np.flatnonzero(np.abs(patches - patches[index]).mean(axis=(1, 2, 3)) < 6)
    if len(support) < 2 or not any(abs(clean[int(i)][2] - clean[index][2]) >= .3 for i in support) or np.abs(base[y:bottom, x:right].astype(float) - patches[index]).mean() < 4:
        return base, None
    output = base.copy()
    output[y:bottom, x:right] = clean[index][0]
    return output, {'rectangle': [x, y, right, bottom], 'source_frame': clean[index][1], 'source_seconds': clean[index][2],
                    'support_frames': [clean[int(i)][1] for i in support]}


def approximate_patch(base: np.ndarray, rectangle: list[int]) -> tuple[np.ndarray, dict | None]:
    """Approximate an unrevealed sprite patch from nearby matching border pixels."""
    x, y, right, bottom = rectangle
    x, y, right, bottom = max(0, x - 1), max(0, y - 1), min(base.shape[1], right + 1), min(base.shape[0], bottom + 1)
    border = 3
    if x < border or y < border or right + border > base.shape[1] or bottom + border > base.shape[0]:
        return base, None
    context = base[y-border:bottom+border, x-border:right+border].astype(float)
    mask = np.ones(context.shape[:2], dtype=bool)
    mask[border:-border, border:-border] = False
    best = None
    for dy in range(-32, 33):
        for dx in range(-32, 33):
            if abs(dx) < right - x + border and abs(dy) < bottom - y + border:
                continue
            sx, sy = x + dx, y + dy
            if sx < border or sy < border or sx + right-x + border > base.shape[1] or sy + bottom-y + border > base.shape[0]:
                continue
            candidate = base[sy-border:sy+bottom-y+border, sx-border:sx+right-x+border].astype(float)
            error = float(np.abs(candidate[mask] - context[mask]).mean())
            rank = error + .02 * (abs(dx) + abs(dy))
            if best is None or rank < best[0]:
                best = (rank, dx, dy, error)
    if best is None:
        return base, None
    _, dx, dy, error = best
    result = base.copy()
    result[y:bottom, x:right] = base[y+dy:bottom+dy, x+dx:right+dx]
    return result, {'rectangle': [x, y, right, bottom], 'approximate': True,
                    'method': 'Nearby pixel patch selected by border similarity; not recovered background',
                    'donor_translation_native': [dx, dy], 'border_error': error}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--layer', '--rooms', dest='layer', type=Path, required=True)
    parser.add_argument('--capture', type=Path, help='Optional timestamp manifest for audit compatibility')
    parser.add_argument('--matches', type=Path, required=True)
    parser.add_argument('--template-frame', type=Path, required=True)
    parser.add_argument('--template-rectangle', nargs=4, type=int, default=[54, 87, 63, 96])
    parser.add_argument('--extra-template', action='append', nargs=5, default=[], metavar=('FRAME', 'X', 'Y', 'RIGHT', 'BOTTOM'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.layer.read_text())
    matching = json.loads(args.matches.read_text())
    template = np.asarray(Image.open(args.template_frame).convert('RGB').crop(tuple(args.template_rectangle)))
    template = [template, template[:, ::-1].copy()]
    for path, *rectangle in args.extra_template:
        item = np.asarray(Image.open(path).convert('RGB').crop(tuple(map(int, rectangle))))
        template.extend([item, item[:, ::-1].copy()])
    grouped = {}
    for match in matching['matches']:
        if match.get('accepted') and match['candidates'][0]['score'] >= .55:
            candidate = match['candidates'][0]
            grouped.setdefault((candidate['column'], candidate['row']), []).append(match)
    if args.output.resolve() == args.layer.parent.resolve():
        raise ValueError('Output must preserve the original directory')
    args.output.mkdir(parents=True, exist_ok=True)
    repairs = []
    sheet = []
    for room in data['rooms']:
        original = Image.open(args.layer.parent / room['image']).convert('RGB')
        if original.width % 320 or original.height % 176 or original.width // 320 != original.height // 176:
            raise ValueError('Room images must be integral multiples of 320 by 176')
        base = np.asarray(original.resize((320, 176), Image.Resampling.BOX))
        found = detect_player(base, template)
        changes = []
        candidates = grouped.get((room['column'], room['row']), [])
        # Limit temporal repetition and memory use while preserving traversal diversity.
        candidates = candidates[::max(1, len(candidates) // 30)]
        donors, identifiers, donor_times = [], [], []
        if found:
            for match in candidates:
                path = Path(match['frame'])
                if path.exists():
                    donors.append(np.asarray(Image.open(path).convert('RGB').resize((320, 176), Image.Resampling.BOX)))
                    identifiers.append(str(path))
                    donor_times.append(match['seconds'])
            before = base.copy()
            for detection in found:
                base, change = replace_player(base, detection['rectangle'], donors, identifiers, template, donor_times)
                if change is None:
                    base, change = approximate_patch(base, detection['rectangle'])
                if change:
                    change['detection'] = detection
                    changes.append(change)
            sheet.append((room, before, base, found))
        # Map only the repair rectangles back to full-resolution originals.
        # Resampled recorded pixels are explicitly approximate at larger scales.
        output = np.asarray(original).copy()
        scale = original.width // 320
        for change in changes:
            x, y, right, bottom = change['rectangle']
            if scale > 1 and change.get('donor_translation_native'):
                dx, dy = change['donor_translation_native']
                output[y*scale:bottom*scale, x*scale:right*scale] = np.asarray(original)[(y+dy)*scale:(bottom+dy)*scale, (x+dx)*scale:(right+dx)*scale]
            else:
                patch = Image.fromarray(base[y:bottom, x:right]).resize(((right-x)*scale, (bottom-y)*scale), Image.Resampling.NEAREST)
                output[y*scale:bottom*scale, x*scale:right*scale] = np.asarray(patch)
                if scale > 1:
                    change['approximate'] = True
                    change['resampling'] = 'Native recorded background expanded with nearest-neighbour sampling'
        Image.fromarray(output).save(args.output / room['image'])
        changed = np.any(output != np.asarray(original), axis=2)
        mask_file = str(Path(room['image']).with_suffix('.player-mask.png'))
        Image.fromarray(changed.astype(np.uint8) * 255).save(args.output / mask_file)
        entry = {'column': room['column'], 'row': room['row'], 'detections': found, 'changes': changes, 'changed_mask': mask_file, 'changed_pixels': int(changed.sum())}
        repairs.append(entry)
        if changes:
            room['playerRepair'] = {'method': 'Same-room recorded replacement with explicitly marked approximate fallback', 'changes': changes, 'changed_mask': mask_file}
    data['playerRepair'] = {'roomsChanged': sum(bool(r['changes']) for r in repairs), 'detectedRooms': len(sheet), 'approximateRooms': sum(any(c.get('approximate') for c in r['changes']) for r in repairs),
                            'status': 'Conservative template pass; undetected player sprites may remain', 'templateFrame': str(args.template_frame), 'templateRectangle': args.template_rectangle, 'extraTemplates': args.extra_template}
    data['processing'] = str(data.get('processing', '')) + '; conservative player removal: recorded same-room pixels where corroborated, explicitly marked local approximations otherwise; originals preserved'
    (args.output / 'rooms.json').write_text(json.dumps(data, indent=2) + '\n')
    (args.output / 'player-repair.json').write_text(json.dumps(repairs, indent=2) + '\n')
    if sheet:
        preview = Image.new('RGB', (1280, len(sheet) * 210))
        draw = ImageDraw.Draw(preview)
        for index, (room, before, after, found) in enumerate(sheet):
            a = Image.fromarray(before).resize((640, 176))
            b = Image.fromarray(after).resize((640, 176))
            preview.paste(a, (0, index * 210 + 25)); preview.paste(b, (640, index * 210 + 25))
            draw.text((5, index * 210 + 5), f"{room['column']:02},{room['row']:02}: {len(found)} detections; before / after", fill='white')
        preview.save(args.output / 'review.jpg')
    print(json.dumps(data['playerRepair']))


if __name__ == '__main__':
    main()
