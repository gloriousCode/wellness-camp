"""Conservative recorded-pixel player replacement checks."""
import sys
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from repair_player import detect_player, replace_player, approximate_patch


class PlayerRepairTests(unittest.TestCase):
    def setUp(self):
        self.template = np.random.default_rng(6).integers(20, 170, (9, 9, 3), dtype=np.uint8)
        self.background = np.zeros((50, 60, 3), dtype=np.uint8)
        self.base = self.background.copy()
        self.base[10:19, 20:29] = self.template

    def test_detect_player_localises_template_and_leaves_blank(self):
        found = detect_player(self.base, self.template)
        self.assertEqual([item['rectangle'] for item in found], [[20, 10, 29, 19]])
        self.assertEqual(detect_player(self.background, self.template), [])

    def test_replace_player_requires_two_clean_observations(self):
        result, change = replace_player(self.base, [20, 10, 29, 19],
                                        [self.background], ['one'], self.template)
        self.assertIsNone(change)
        np.testing.assert_array_equal(result, self.base)

    def test_replace_player_copies_only_small_rectangle(self):
        donors = [self.background.copy(), self.background.copy()]
        for donor in donors:
            donor[35:44, 40:49] = self.template
        result, change = replace_player(self.base, [20, 10, 29, 19], donors, ['one', 'two'], self.template)
        self.assertIsNotNone(change)
        np.testing.assert_array_equal(result, self.background)
        self.assertEqual(change['source_frame'], 'one')
        self.assertEqual(change['support_frames'], ['one', 'two'])

    def test_replace_player_rejects_donors_still_covering_background(self):
        result, change = replace_player(self.base, [20, 10, 29, 19],
                                        [self.base, self.base], ['one', 'two'], self.template)
        self.assertIsNone(change)
        np.testing.assert_array_equal(result, self.base)

    def test_duplicate_timestamps_do_not_corroborate_a_replacement(self):
        result, change = replace_player(self.base, [20, 10, 29, 19],
                                        [self.background, self.background], ['one', 'two'], self.template, [1., 1.])
        self.assertIsNone(change)
        np.testing.assert_array_equal(result, self.base)

    def test_template_bank_deduplicates_matches(self):
        found = detect_player(self.base, [self.template, self.template])
        self.assertEqual(len(found), 1)

    def test_approximate_patch_marks_synthesis_and_preserves_other_pixels(self):
        result, change = approximate_patch(self.base, [20, 10, 29, 19])
        self.assertTrue(change['approximate'])
        mask = np.zeros(self.base.shape[:2], dtype=bool)
        mask[9:20, 19:30] = True
        np.testing.assert_array_equal(result[~mask], self.base[~mask])
        np.testing.assert_array_equal(result, self.background)


if __name__ == '__main__':
    unittest.main()
