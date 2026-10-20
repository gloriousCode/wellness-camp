"""Temporal merge checks on synthetic independently generated image arrays."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
spec = importlib.util.spec_from_file_location('merge_capture', Path(__file__).parents[1] / 'scripts/merge_capture.py')
merging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(merging)


class CaptureMergeTests(unittest.TestCase):
    def test_write_existing_layer(self):
        import json

        existing = {'recording': 'recording.mov', 'image_size': [640, 352], 'rooms': [
            {'column': 1, 'row': 2, 'image': 'first.png', 'seconds': 1, 'score': .7, 'margin': .1},
            {'column': 2, 'row': 2, 'image': 'second.png', 'seconds': 2, 'score': .8, 'margin': .2},
        ]}
        merged = [{'column': 1, 'row': 2, 'file': 'merged.png', 'changes': [{'rectangle': [0, 0, 16, 16]}],
                   'base_frame': 'dense.png', 'frames': [{'file': 'dense.png', 'seconds': 4}], 'base_index': 0, 'changed_pixels': 8},
                  {'column': 99, 'row': 99, 'file': 'extra.png', 'changes': [{}]}]
        matching = {'matches': [{'frame': 'dense.png', 'margin': .3, 'candidates': [{'score': .9}]}]}
        pixels = np.random.default_rng(1).integers(0, 255, (352, 640, 3), dtype=np.uint8)
        original = Image.fromarray(pixels)
        saved = {}

        def save(image, destination):
            saved[Path(destination).name] = np.asarray(image).copy()

        with patch.object(Path, 'read_text', return_value=json.dumps(existing)), \
                patch.object(Path, 'mkdir'), patch.object(Path, 'write_text'), \
                patch.object(Image, 'open', side_effect=lambda _: original.copy()), \
                patch.object(Image.Image, 'save', new=save):
            result = merging.write_existing_layer(Path('original/rooms.json'), merged, matching, Path('merged'))
        self.assertEqual([(r['column'], r['row']) for r in result['rooms']], [(1, 2), (2, 2)])
        self.assertEqual(result['image_size'], [320, 176])
        self.assertEqual(result['rooms'][0]['temporalMerge']['originalSeconds'], 1)
        self.assertEqual(result['rooms'][0]['seconds'], 4)
        self.assertNotIn('temporalMerge', result['rooms'][1])
        self.assertEqual(result['rooms'][1]['seconds'], 2)
        expected = np.asarray(original.resize((320, 176), Image.Resampling.BOX))
        np.testing.assert_array_equal(saved['room-02-02.png'], expected)
        self.assertEqual(len(saved), 2)

    def test_merge_patches(self):
        random = np.random.default_rng(128)
        clear = random.integers(40, 180, size=(176, 320, 3), dtype=np.uint8)
        clouded = (clear.astype(float) * .2).astype(np.uint8)
        first = clouded.copy()
        second = clouded.copy()
        first[16:64, 16:64] = clear[16:64, 16:64]
        second[80:128, 64:112] = clear[80:128, 64:112]
        frames = np.stack([clouded, first, first, second, second])
        with self.subTest('combine separately revealed regions without generating pixels'):
            output, sources, changes = merging.merge_patches(frames, times=[0, 1, 2, 3, 4])
            np.testing.assert_array_equal(output[16:64, 16:64], clear[16:64, 16:64])
            np.testing.assert_array_equal(output[80:128, 64:112], clear[80:128, 64:112])
            np.testing.assert_array_equal(output[140:], clouded[140:])
            self.assertTrue(changes)
            for y in range(176):
                for x in range(320):
                    np.testing.assert_array_equal(output[y, x], frames[sources[y, x], y, x])
        with self.subTest('reject a single bright moving outlier'):
            outlier = clouded.copy()
            outlier[16:32, 16:32] = clear[16:32, 16:32]
            output, _, changes = merging.merge_patches(np.stack([clouded, clouded, outlier]), times=[0, 1, 2])
            np.testing.assert_array_equal(output, clouded)
            self.assertFalse(changes)
        with self.subTest('sparse samples and near-identical timestamps retain base'):
            for inputs, times in [(frames[:1], [0]), (frames[:3], [0, 1, 1.1])]:
                output, _, changes = merging.merge_patches(inputs, times=times)
                np.testing.assert_array_equal(output, clouded)
                self.assertFalse(changes)
        with self.subTest('fixed HUD and cursor retain base'):
            bright = clear.copy()
            output, _, _ = merging.merge_patches(np.stack([clouded, bright, bright]), times=[0, 1, 2])
            np.testing.assert_array_equal(output[152:], clouded[152:])
            np.testing.assert_array_equal(output[112:134, 194:216], clouded[112:134, 194:216])
        with self.subTest('invalid input'):
            for frames, kwargs in [(np.zeros((0, 176, 320, 3)), {}), (clear, {}),
                                   (np.stack([clear]), {'times': []}),
                                   (np.stack([clear]), {'base_index': 2})]:
                with self.assertRaises(ValueError):
                    merging.merge_patches(frames, **kwargs)


if __name__ == '__main__':
    unittest.main()
