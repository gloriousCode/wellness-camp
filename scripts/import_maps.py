"""Import the original versioned map images with pinned provenance."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REPO = 'cwithw/animal-well-old-maps'
HEADERS = {'User-Agent': 'wellness-camp-map-importer'}


def read_url(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=90) as response:
        return response.read()


def main():
    commit = json.loads(read_url(f'https://api.github.com/repos/{REPO}/commits/main'))['sha']
    base = f'https://raw.githubusercontent.com/{REPO}/{commit}'
    versions = json.loads(read_url(f'{base}/metadata.json'))
    destination = ROOT / 'public/maps'
    destination.mkdir(parents=True, exist_ok=True)

    def fetch(version):
        filename = f'{version}.webp'
        source = f'{base}/old_version_map_screenshots_webp/{filename}'
        image = read_url(source)
        (destination / filename).write_bytes(image)
        date = f'{version[:4]}-{version[4:6]}-{version[6:8]}'
        return {'id': version, 'date': date, 'file': f'maps/{filename}',
                'bytes': len(image), 'sha256': hashlib.sha256(image).hexdigest()}

    with ThreadPoolExecutor(max_workers=6) as pool:
        maps = list(pool.map(fetch, versions))
    manifest = {'source': f'https://github.com/{REPO}', 'commit': commit,
                'sourceViewer': 'https://cwithw.github.io/animal-well-old-maps/',
                'textureNote': 'The source uses newer textures when rendering older layouts.',
                'maps': maps}
    (ROOT / 'public/maps.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Imported {len(maps)} maps, {sum(m["bytes"] for m in maps):,} bytes, source commit {commit}')


if __name__ == '__main__':
    main()
