"""Independent synthetic evidence checks for partial-room matching."""
from pathlib import Path
import sys
import unittest

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import refine_capture as refinement


def synthetic_room(seed):
    """Create varied, distinctive geometry without relying on game assets."""
    values = np.random.default_rng(seed).integers(0, 256, (44, 80, 3), dtype=np.uint8)
    return Image.fromarray(values).resize((320, 176), Image.Resampling.NEAREST)


class CaptureRefinementTests(unittest.TestCase):
    def setUp(self):
        self.rooms = [synthetic_room(index) for index in range(5)]
        indexed = [refinement.regional_features(refinement.structure_features(image)) for image in self.rooms]
        self.templates = np.stack([item[0] for item in indexed])
        self.energy = np.stack([item[1] for item in indexed])

    def test_regional_features(self):
        regions, energy = refinement.regional_features(refinement.structure_features(self.rooms[0]))
        self.assertEqual(regions.shape, (16, 1760))
        np.testing.assert_allclose(np.linalg.norm(regions, axis=1), 1, atol=1e-6)
        blank, energy = refinement.regional_features(np.zeros(2 * 86 * 158))
        self.assertFalse(blank.any())
        self.assertFalse(energy.any())

    def test_regional_vote_partial_room(self):
        query = self.rooms[2].copy()
        ImageDraw.Draw(query).rectangle((0, 75, 319, 175), fill='black')
        result = refinement.regional_vote(refinement.structure_features(query), self.templates, self.energy)
        self.assertTrue(result['accepted'])
        self.assertEqual(result['index'], 2)
        self.assertGreaterEqual(len(result['votes']), 3)

    def test_regional_vote_rejects_unseen_blank_and_ambiguous(self):
        for query in [synthetic_room(99), Image.new('RGB', (320, 176))]:
            with self.subTest(query=query):
                result = refinement.regional_vote(refinement.structure_features(query), self.templates, self.energy)
                self.assertFalse(result['accepted'])
        duplicate = np.stack([self.templates[0], self.templates[0]])
        energies = np.stack([self.energy[0], self.energy[0]])
        result = refinement.regional_vote(refinement.structure_features(self.rooms[0]), duplicate, energies)
        self.assertFalse(result['accepted'])

    def test_regional_vote_rejects_conflicting_geometry(self):
        query = self.rooms[0].copy()
        query.paste(self.rooms[1].crop((160, 0, 320, 176)), (160, 0))
        result = refinement.regional_vote(refinement.structure_features(query), self.templates, self.energy)
        self.assertFalse(result['accepted'])
        self.assertGreater(result['conflicts'], 0)
        with self.assertRaises(ValueError):
            refinement.regional_vote(refinement.structure_features(query), self.templates[:1], self.energy[:1])


if __name__ == '__main__':
    unittest.main()
