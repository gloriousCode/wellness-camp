# Wellness Camp

A free, unofficial Animal Well atlas for studying level design. Built with React, TypeScript and Vite; the static production output is suitable for GitHub Pages.

## Run and build

Requires Node.js 24+ and npm. No game, account or API key is needed.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To validate and build:

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` includes all viewer imagery. The relative Vite base supports GitHub Pages repository paths. Fonts use Google Fonts with system fallbacks.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` checks types, runs the viewer tests, builds with Node.js 24 and deploys only `dist/`. It runs on pushes to `main` and can also be started manually from Actions. The recording, local backups, dependencies and Git history are excluded from the published site.

In the repository’s **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. After the workflow reaches `main`, its successful deployment will publish [Wellness Camp](https://gloriouscode.github.io/wellness-camp/). The Actions deployment job also reports the final URL. Future pushes to `main` update the site automatically. No custom domain or API keys are required.

## Explore

- Switch between **Game view**, **Raw view** and **Map view** while keeping the camera and selected room. Map view overlays the in-game map on subdued gameplay.
- Drag to pan; scroll or pinch to zoom around the pointer. Click a room to select and focus it.
- Search coordinates in column,row order, such as `08,12`. Bare numbers match either coordinate.
- Use the sidebar preview or right-click a room to focus or save it. **Save visible map** exports the current imagery without viewer controls or selection outlines.
- **Fit world** frames visible content; **1:1** displays one source pixel per CSS pixel. The minimap relocates the camera.
- Focus the canvas for arrow-key panning, `+` / `-` zoom, `0` to fit, and Escape to clear selection. Shift + double-click zooms out.
- Settings toggle room boundaries and the minimap. The screen browser can be hidden or resized; its divider also supports arrow keys.
- The URL records the map, camera bounds, selected room and imagery mode. **Share** copies it. Earlier development-map links use the retained layout; older hash-based camera links remain readable on initial load.

Room IDs refer to 320 × 176 image cells, not official room names. Coordinates increase rightwards and downwards. Magnified pixels remain crisp.

## Imagery and limitations

All three views use the same 8,320 × 4,576 coordinate system. The retained layout is `20240603_4757794989373292024`; earlier development images are absent from the checkout and build but remain in Git history.

Game view contains placements in all 256 main-grid cells from Scott’s 20 October 2026 recording. Locations `11,13` and `11,17` are inferred from neighbouring-room traversal and remain heavily obscured. Twenty-five rooms combine repeatedly supported revealed patches. Cursor footprints in all 256 cells have approximate local repairs. Player repairs in 54 rooms use other same-room frames in 26 cases and nearby-pixel approximations in 28. Other player poses, HUD, animations, lighting seams and obscured areas may remain. These are still images, not animated captures; placement coverage does not establish complete visible geometry or coverage of alternate game layers.

The finished atlas and sanitised per-room provenance are retained in `public/gameplay/`. The source recording, intermediate frames, repair masks, review sheets and progress notes have been removed. Repeating the original capture analysis requires a new recording or an independently retained copy; the published atlas remains usable without them. `.local/` is ignored by Git and excluded from production; the small game-save backup remains there.

Raw imagery comes from [cwithw/animal-well-old-maps](https://github.com/cwithw/animal-well-old-maps), pinned at `2d187a1dda307dab714956bdddf0992c81b0fddc`. These are textured exported layouts rather than gameplay captures. `public/maps.json` records the retained image’s checksum and provenance.

Map imagery comes from [Silverfeelin/AnimalWell-Helper](https://github.com/Silverfeelin/AnimalWell-Helper/blob/81432337b6a95ddbb951e6efcf5d256c2f82e517/src/assets/game/map.png). The original 640 × 352 image is retained locally. Its 40 × 22 map pixels per room scale by eight at atlas coordinates (640, 704). Nearest-neighbour scaling preserves the original pixel geometry; the ordinary map omits some hidden or cheat-only detail. `public/map/overlay.json` records its source, checksum and composition settings.

ANIMAL WELL © 2024 Shared Memory LLC, published by BIGMODE. This educational project is unaffiliated. The project’s code licence does not grant rights to game imagery. The map source explicitly excludes game assets from its MIT licence; its educational fair-use statement is not a redistribution licence. Public redistribution permission for third-party imagery remains unverified. Attribution does not replace permission.

## Optional image tools

The small Python scripts and synthetic tests are retained for future recordings. They run offline against supplied captures without launching, controlling or reading game memory. They require Python 3.10+, Pillow and NumPy; video sampling also requires FFmpeg/ffprobe on PATH. Use each capture tool’s `--help` for its inputs and options; work inside `.local/`.

- `sample_capture.py`, `match_capture.py` and `refine_capture.py` sample video and rank room geometry for review.
- `temporal_capture.py` finds intervals between known rooms; `collate_captures.py` combines reviewed placements.
- `merge_capture.py` combines repeatedly supported revealed patches; `repair_cursor.py` and `repair_player.py` produce local repairs.
- `build_gameplay_atlas.py` assembles a reviewed room manifest into the public gameplay atlas and generated viewer descriptor.
- `build_map_overlay.py` rebuilds Map view from the retained public source images.
- `import_maps.py` refreshes only the retained raw image from its pinned source.

```sh
python3 -m unittest discover -s tests -p 'test_capture_*.py'
python3 scripts/build_map_overlay.py
```

Capture matching is heuristic and requires review. Approximate repairs must not be treated as evidence of unseen level geometry.
