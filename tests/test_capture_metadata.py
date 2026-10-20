"""Publishing repair provenance must not expose local filesystem paths."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from build_gameplay_atlas import public_provenance


class CaptureMetadataTests(unittest.TestCase):
    def test_public_provenance(self):
        source = {'source': '/Users/example/private/frame.png',
                  'support': ['/private/captures/other.png', 'relative.png'],
                  'rectangle': [1, 2, 3, 4], 'method': 'Approximate local repair', 'detected': True}
        result = public_provenance(source)
        self.assertEqual(result['source'], 'frame.png')
        self.assertEqual(result['support'], ['other.png', 'relative.png'])
        self.assertEqual(result['rectangle'], source['rectangle'])
        self.assertEqual(result['method'], source['method'])
        self.assertTrue(result['detected'])
        self.assertEqual(source['source'], '/Users/example/private/frame.png')


if __name__ == '__main__':
    unittest.main()
