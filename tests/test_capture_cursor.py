"""Check measured cursor repair with independent backgrounds and exact change bounds."""
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from repair_cursor import cursor_mask, cursor_present, repair_cursor


class CursorRepairTests(unittest.TestCase):
    def test_repair_cursor_continues_wall_and_preserves_outside(self):
        background = np.full((176, 320, 3), [4, 9, 17], dtype=np.uint8)
        background[123] = [25, 90, 140]
        mask = cursor_mask((320, 176))
        occluded = background.copy()
        occluded[mask] = [77, 77, 77]
        occluded[122, 206] = 0
        image = Image.fromarray(occluded)
        self.assertTrue(cursor_present(image))
        result, changed, evidence = repair_cursor(image)
        np.testing.assert_array_equal(np.asarray(result)[~mask], occluded[~mask])
        np.testing.assert_array_equal(np.asarray(result), background)
        self.assertTrue(np.any(changed))
        self.assertEqual(evidence['donor_translation_native'][1], 0)
        self.assertLess(mask.sum(), 35)

    def test_absent_cursor_is_untouched(self):
        pixels = np.full((176, 320, 3), [12, 80, 7], dtype=np.uint8)
        image = Image.fromarray(pixels)
        result, changed, evidence = repair_cursor(image)
        self.assertFalse(evidence['detected'])
        self.assertFalse(changed.any())
        np.testing.assert_array_equal(np.asarray(result), pixels)

    def test_explicit_fixed_cursor_override_preserves_detection_evidence(self):
        pixels = np.full((176, 320, 3), [4, 9, 17], dtype=np.uint8)
        mask = cursor_mask((320, 176))
        pixels[mask] = [24, 24, 24]  # A faint residue fails the white-outline detector.
        result, changed, evidence = repair_cursor(Image.fromarray(pixels), assume_fixed=True)
        self.assertFalse(evidence['detected'])
        self.assertTrue(evidence['forced'])
        self.assertTrue(changed.any())
        np.testing.assert_array_equal(np.asarray(result)[~mask], pixels[~mask])
        np.testing.assert_array_equal(np.asarray(result)[mask], np.tile([4, 9, 17], (mask.sum(), 1)))

    def test_high_resolution_mask_preserves_geometry_and_scale(self):
        mask = cursor_mask((2560, 1408))
        ys, xs = np.where(mask)
        self.assertLess(xs.max() - xs.min(), 30)
        self.assertLess(ys.max() - ys.min(), 44)
        self.assertLess(mask.sum(), 1000)
        native = np.asarray(Image.fromarray(mask.astype(np.uint8)*255).resize((320,176), Image.Resampling.BOX)) > 0
        np.testing.assert_array_equal(native, cursor_mask((320, 176)))
        with self.assertRaises(ValueError):
            cursor_mask((640, 176))


if __name__ == '__main__':
    unittest.main()
