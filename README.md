# Wellness Camp

A free, unofficial Animal Well atlas for studying level design. Built with React, TypeScript and Vite; the production output is a static website suitable for GitHub Pages.

The default atlas is **20240603_4757794989373292024**. All 94 map images from cwithw's collection are local, but the browser loads only the selected image. The default image is 8,320 × 4,576 pixels and approximately 1.77 MB; the complete atlas archive is 157,515,760 bytes.

## Run locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No game, MAXWELL, account or API key is needed.

## Explore screens

The interface follows Berry Camp's map-first approach: a searchable screen list, direct room focus, a screen preview, image export and automatically updated view bounds in the address bar. It uses an independent implementation and Animal Well imagery.

- Drag to pan; scroll or pinch to zoom around the pointer.
- Click a screen to select and focus it, or choose it in the sidebar. Shift + double-click zooms out.
- Search coordinates in column,row order, such as `08,12`. Bare numbers match either coordinate.
- Right-click a screen for focus/save actions. The selected-screen panel provides the same actions for touch and keyboard use.
- **Fit world** frames visible content; **1:1** displays one source pixel per CSS pixel.
- Click the minimap to relocate. Settings toggle screen boundaries and the minimap.
- Use **Normal / In game** above the map to switch imagery while keeping your position, zoom and selected screen. The gameplay version currently contains 88 candidate room matches from the 20 October recording; other rooms use the normal image. The selected-screen preview identifies captures and fallback imagery. Historical layouts support Normal only.
- Focus the main canvas for arrow-key panning, `+` / `-` zoom, `0` to fit, and Escape to clear selection.
- Use the header menu button to show or hide the screen browser. Drag its divider to resize it on desktop; focus the divider and use arrow keys for keyboard resizing. Historical atlases are selected with the date dropdown.
- **Save screen** exports the untouched 320 × 176 atlas slice. **Save visible map** exports visible source imagery at native resolution, without UI or highlight overlays.
- The URL automatically records `map`, `top`, `bottom`, `left`, `right`, optional `room` and `imagery=gameplay` when enabled. **Share** copies it. Older `#map=...&x=...&y=...&z=...` links remain readable on initial load.

Screen cells are detected from populated 320 × 176 divisions of the flattened atlas. IDs follow the source-image origin and include its outer margins; they are not verified game room names. Detection is based on visible pixels and may include artefacts or omit visually empty cells. This does not establish completeness of all game areas. Canvas X increases rightwards and Y downwards, with no inversion or rotation. Downsampling is smoothed to avoid moiré; magnified pixels stay crisp.

## Check and build

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` contains the complete site and all local public imagery. The relative Vite base supports GitHub Pages repository paths. The interactions need no backend. Fonts are requested from Google Fonts with system fallbacks.

Publish `dist/` as a Pages artifact using GitHub Actions or an existing static Pages deployment process. No deployment, push or remote settings changes have been performed. `.local/` contains private local tooling and save backups and is excluded from Git and the production build.

## Analyse a gameplay recording locally

The optional capture scripts process an existing video without launching, controlling or reading the memory of the game. Video and analysis outputs belong in `.local/`; they are not published with the site. Requires FFmpeg/ffprobe on PATH, Python 3.10+, Pillow and NumPy. These tools are separate from the website's runtime dependencies.

Sample keyframes with their actual video timestamps, then rank the room geometry against the atlas:

```sh
python3 scripts/sample_capture.py \
  '.local/recordings/Screen Recording 2026-10-20 at 13.48.06.mov' \
  .local/capture-analysis/timed \
  --crop 112 132 2560 1408
python3 scripts/match_capture.py \
  --frames .local/capture-analysis/timed \
  --output .local/capture-analysis/timed-matching
python3 -m unittest discover -s tests -p 'test_capture_matching.py'
```

The crop is specific to the first 2784 × 1720 recording: X, Y, width, height. Recalibrate it when the game window or recording dimensions change. The sampler preserves the video, rejects existing output directories and records source timestamps in `capture.json`. Sampling keyframes is efficient but may miss briefly visited rooms.

`matches.json` retains the three highest-ranked candidates per sample, heuristic acceptance thresholds, uncertain samples and the strongest accepted sample per atlas cell. Contact sheets place the captured room beside its atlas candidate for review. Scores are not probabilities, accepted candidates still need inspection, and unmatched samples do not establish that rooms are missing from the atlas. Matching ignores bottom-corner HUD regions and the cursor position from this first recording; it does not remove anything from the exported images. Player, HUD, cursor and animated effects remain intact. No gameplay captures are automatically added to the public map.

The initial 88 candidates have been explicitly included as the optional gameplay version. Its self-contained lossless WebP is approximately 6.97 MB and uses the same 8,320 × 4,576 coordinate system as the normal atlas. Uncaptured cells are pixel-identical to the decoded normal source. `public/gameplay/20261020.json` records room timestamps, matching scores, source crop and the output checksum; the full recording and high-resolution working images remain private in `.local/`. Effects are captured in still frames, not animated. Player, cursor and HUD remain visible, and not every candidate placement has been manually verified.

After extracting full-resolution candidates into a `rooms/rooms.json` manifest, rebuild the public gameplay layer and its generated viewer descriptor with:

```sh
python3 scripts/build_gameplay_atlas.py .local/capture-analysis/rooms/rooms.json
```

## Image provenance and limitations

Atlas images: [cwithw/animal-well-old-maps](https://github.com/cwithw/animal-well-old-maps), source commit `2d187a1dda307dab714956bdddf0992c81b0fddc`. The [original viewer](https://cwithw.github.io/animal-well-old-maps/) explains that older layouts use newer textures. These are textured layouts rather than full-fidelity gameplay captures. Alternate dimensions, secrets, room states and parity with later game builds have not been independently verified. The newest atlas is dated 3 June 2024.

`public/maps.json` records original IDs, sizes, SHA-256 checksums and the pinned source commit. The retained importer explicitly refreshes that collection:

```sh
python3 scripts/import_maps.py
```

The repository's existing licence applies to this project's code; it does not grant rights to Animal Well imagery or third-party material. No image reuse licence was present in the inspected atlas source tree. Public redistribution permission for the atlas collection remains unverified. Attribution is included in the viewer and source manifest; it is not a substitute for permission.

Animal Well © Billy Basso / Shared Memory, published by BIGMODE. This is an independent educational project with no affiliation.
