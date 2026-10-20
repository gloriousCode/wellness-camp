#!/usr/bin/env python3
"""Recover partially obscured rooms using independent spatial gradient votes.

No placement is inferred from route alone. Matching remains heuristic and outputs
reviewable evidence for every recovered frame, retaining baseline decisions.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

from match_capture import atlas_features, group_rooms, structure_features, write_contact_sheets


def regional_features(feature: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Normalise sixteen disjoint regions and retain their structural energy."""
    gradients = feature.reshape(2, 86, 158)
    regions = []
    for top, bottom in zip(np.linspace(0, 86, 5, dtype=int)[:-1], np.linspace(0, 86, 5, dtype=int)[1:]):
        for left, right in zip(np.linspace(0, 158, 5, dtype=int)[:-1], np.linspace(0, 158, 5, dtype=int)[1:]):
            region = gradients[:, top:bottom, left:right].ravel()
            padded = np.zeros(2 * 22 * 40, dtype=np.float32)
            padded[:len(region)] = region
            regions.append(padded)
    values = np.stack(regions)
    energy = np.linalg.norm(values, axis=1)
    return values / np.maximum(energy[:, None], 1e-9), energy


def regional_vote(query: np.ndarray, templates: np.ndarray, template_energy: np.ndarray) -> dict:
    """Require agreement among distinctive, spatially separate visible regions.

    Sparse black regions cannot vote. Duplicate atlas patches abstain because
    their best-versus-runner-up margin is too small. Three votes are needed with
    no conflicting regions; acceptance additionally requires temporal support.
    """
    if len(templates) < 2:
        raise ValueError('At least two atlas cells are required to establish ambiguity')
    regions, energy = regional_features(query)
    scores = np.einsum('rc,nrc->nr', regions, templates)
    scores = np.where(template_energy >= .06, scores, 0)
    order = np.argsort(scores, axis=0, kind='stable')
    best, second = order[-1], order[-2]
    columns = np.arange(16)
    winning = scores[best, columns]
    margins = winning - scores[second, columns]
    distinctive = (winning >= .73) & (margins >= .12) & (energy >= .06)
    counts = np.bincount(best[distinctive], minlength=len(templates))
    winner = int(np.argmax(counts))
    votes = np.flatnonzero(distinctive & (best == winner))
    conflicts = int(distinctive.sum() - len(votes))
    return {'accepted': len(votes) >= 3 and conflicts == 0,
            'index': winner, 'votes': votes.tolist(), 'conflicts': conflicts,
            'regional_scores': winning[votes].tolist(), 'regional_margins': margins[votes].tolist()}


def main() -> None:
    """Extend a baseline matching report and write evidence plus contact sheets."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--matches', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Choose a new output directory to preserve previous analysis')
    baseline = json.loads(args.matches.read_text())
    with Image.open(baseline['atlas']) as image:
        atlas = image.convert('RGB')
    coordinates, features = atlas_features(atlas)
    indexed = [regional_features(feature) for feature in features]
    templates = np.stack([value[0] for value in indexed])
    energy = np.stack([value[1] for value in indexed])
    recovered = 0
    proposals = []
    for match in baseline['matches']:
        if match['accepted']:
            match['acceptance_reason'] = 'baseline global gradient score and margin'
            continue
        with Image.open(match['frame']) as image:
            query = structure_features(image)
        evidence = regional_vote(query, templates, energy)
        match['regional_evidence'] = evidence
        if not evidence['accepted']:
            continue
        proposals.append((match, evidence, query))
    for match, evidence, query in proposals:
        support = [other for other, other_evidence, _ in proposals
                   if other_evidence['index'] == evidence['index'] and
                   abs(other.get('seconds', 0) - match.get('seconds', 0)) >= .3]
        if not support:
            evidence['accepted'] = False
            continue
        evidence['support_frames'] = [other['frame'] for other in support]
        winner = evidence['index']
        scores = features @ query
        ranked = [winner] + [int(index) for index in np.argsort(scores)[::-1] if index != winner][:2]
        match['baseline_candidates'] = match['candidates']
        match['candidates'] = [{'column': coordinates[index][0], 'row': coordinates[index][1],
                                'score': float(scores[index])} for index in ranked]
        match['margin'] = float(scores[winner] - max(np.delete(scores, winner)))
        match['accepted'] = True
        match['acceptance_reason'] = 'three distinctive spatial region votes, no conflict, independently repeated after 0.3 seconds'
        recovered += 1
    rooms = group_rooms(baseline['matches'])
    args.output.mkdir(parents=True, exist_ok=True)
    baseline.update(rooms=rooms, accepted_frames=sum(match['accepted'] for match in baseline['matches']),
                    distinct_accepted_cells=len(rooms), recovered_frames=recovered,
                    refinement='Disjoint gradient region consensus; no route-only placements.',
                    contact_sheets=write_contact_sheets(rooms, atlas, args.output))
    (args.output / 'matches.json').write_text(json.dumps(baseline, indent=2) + '\n')
    print(json.dumps({key: baseline[key] for key in ('recovered_frames', 'accepted_frames', 'distinct_accepted_cells')}))


if __name__ == '__main__':
    main()
