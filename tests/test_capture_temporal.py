"""Temporal windows propose review candidates without inventing room evidence."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from temporal_capture import bracketed_gaps


def sample(x, y, seconds, accepted=True):
    return {'seconds': seconds, 'accepted': accepted, 'candidates': [{'column': x, 'row': y}]}


class TemporalWindowsTests(unittest.TestCase):
    def test_bracketed_gaps(self):
        scenarios = [
            ('straight', [sample(2, 4, 0), sample(2, 4, 1), sample(4, 4, 3)], {(3, 4)}, 1),
            ('reverse', [sample(4, 4, 0), sample(2, 4, 2)], {(3, 4)}, 1),
            ('vertical', [sample(2, 4, 0), sample(2, 6, 2)], {(2, 5)}, 1),
            ('diagonal', [sample(2, 4, 0), sample(4, 6, 2)], {(3, 5)}, 0),
            ('slow', [sample(2, 4, 0), sample(4, 4, 20)], {(3, 4)}, 0),
            ('resolved', [sample(2, 4, 0), sample(4, 4, 2)], set(), 0),
            ('rejected', [sample(2, 4, 0), sample(3, 4, 1, False), sample(4, 4, 2)], {(3, 4)}, 1),
        ]
        for name, matches, unresolved, expected in scenarios:
            with self.subTest(name=name):
                windows = bracketed_gaps(matches, unresolved)
                self.assertEqual(len(windows), expected)
                if windows:
                    self.assertIn('geometry review required', windows[0]['status'])
                    self.assertEqual(windows[0]['seconds'], 2 if name == 'straight' else 1)
