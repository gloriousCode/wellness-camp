"""Structural matching checks using synthetic rooms independent of game assets."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

spec = importlib.util.spec_from_file_location('match_capture', Path(__file__).parents[1] / 'scripts/match_capture.py')
matching = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matching)


def room(seed):
    image = Image.new('RGB', (320, 176), '#101010')
    draw = ImageDraw.Draw(image)
    random = np.random.default_rng(seed)
    for _ in range(16):
        x, y = random.integers(0, 270), random.integers(0, 145)
        draw.rectangle((int(x), int(y), int(x + 30), int(y + 15)), fill='#a0a0a0')
    return image


class CaptureMatchingTests(unittest.TestCase):
    def test_structure_features(self):
        image = room(1)
        self.assertAlmostEqual(float(np.linalg.norm(matching.structure_features(image))), 1., places=5)
        self.assertTrue(np.isfinite(matching.structure_features(Image.new('RGB', (320, 176)))).all())

    def test_atlas_features(self):
        atlas = Image.new('RGB', (640, 176))
        atlas.paste(room(1), (320, 0))
        coordinates, features = matching.atlas_features(atlas)
        self.assertEqual(coordinates, [(1, 0)])
        self.assertEqual(features.shape[0], 1)
        with self.assertRaises(ValueError):
            matching.atlas_features(Image.new('RGB', (320, 176)))

    def test_rank_frame(self):
        templates = [room(seed) for seed in range(3)]
        features = np.stack([matching.structure_features(image) for image in templates])
        coordinates = [(index, 0) for index in range(3)]
        for factor in (.4, .7, 1.4):
            with self.subTest(brightness=factor):
                query = ImageEnhance.Brightness(templates[1]).enhance(factor)
                query = ImageEnhance.Contrast(query).enhance(.7)
                result = matching.rank_frame(query, coordinates, features)
                self.assertTrue(result['accepted'])
                self.assertEqual(result['candidates'][0]['column'], 1)
        self.assertFalse(matching.rank_frame(Image.new('RGB', (320, 176)), coordinates, features)['accepted'])
        repeated = np.stack([features[0], features[0]])
        self.assertFalse(matching.rank_frame(templates[0], coordinates[:2], repeated)['accepted'])
        self.assertFalse(matching.rank_frame(room(80), coordinates, features, minimum_score=.9)['accepted'])

    def test_group_rooms(self):
        matches = [{'frame': name, 'accepted': accepted, 'margin': .2,
                    'candidates': [{'column': 1, 'row': 2, 'score': score}]}
                   for name, accepted, score in [('a', True, .6), ('b', True, .8), ('c', False, .9)]]
        result = matching.group_rooms(matches)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['best_frame'], 'b')
        self.assertEqual(result[0]['frames'], ['a', 'b'])
        self.assertEqual(matching.group_rooms([]), [])


if __name__ == '__main__':
    unittest.main()
