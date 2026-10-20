"""Align the genuine map's pixels with the gameplay atlas; never redraw geometry."""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/map/in-game-map.png'
OUTPUT = ROOT / 'public/map/overlay.webp'
SOURCE_URL = 'https://github.com/Silverfeelin/AnimalWell-Helper/blob/81432337b6a95ddbb951e6efcf5d256c2f82e517/src/assets/game/map.png'


def build_overlay():
    """Place forty-by-twenty-two map cells over native gameplay room cells."""
    source = Image.open(SOURCE).convert('RGB')
    if source.size != (640, 352):
        raise ValueError('Unexpected in-game map dimensions')
    base = Image.open(ROOT / 'public/gameplay/20261020.webp').convert('RGB')
    # Subdue the capture so the original map colours remain legible.
    result = ImageEnhance.Brightness(base).enhance(0.22)
    pixels = np.asarray(source)
    # Black map paper becomes transparent. Keep original coloured lines and icons.
    alpha = np.where(pixels.max(axis=2) > 24, 245, 0).astype('uint8')
    overlay = source.convert('RGBA')
    overlay.putalpha(Image.fromarray(alpha))
    overlay = overlay.resize((5120, 2816), Image.Resampling.NEAREST)
    result.paste(overlay, (640, 704), overlay)
    result.save(OUTPUT, lossless=True, method=6)
    metadata = {
        'source': SOURCE_URL,
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'copyright': 'ANIMAL WELL © 2024 Shared Memory LLC. Game assets are excluded from the upstream MIT licence.',
        'sourceSize': [640, 352], 'atlasSize': list(base.size),
        'transform': {'scale': 8, 'x': 640, 'y': 704, 'resampling': 'nearest'},
        'composition': {'gameplayBrightness': 0.22, 'mapAlpha': 245, 'paperThreshold': 24},
        'note': 'Source includes ordinary in-game map detail, not every cheat-only or hidden area. No vector tracing or invented detail.'
    }
    (ROOT / 'public/map/overlay.json').write_text(json.dumps(metadata, indent=2) + '\n')


if __name__ == '__main__':
    build_overlay()
