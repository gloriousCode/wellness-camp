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
- Use **Game view / Raw view / Map view** above the map to switch imagery while keeping your position, zoom and selected screen. The gameplay version uses reviewed room matches from the 20 October recording; its current capture count appears beside the toggle. Unmatched rooms use the normal image. The selected-screen preview identifies captures and fallback imagery. Map view overlays genuine in-game cartography on subdued gameplay. Historical layouts support Raw view only.
- Focus the main canvas for arrow-key panning, `+` / `-` zoom, `0` to fit, and Escape to clear selection.
- Use the header menu button to show or hide the screen browser. Drag its divider to resize it on desktop; focus the divider and use arrow keys for keyboard resizing. Historical atlases are selected with the date dropdown.
- **Save screen** exports the active 320 × 176 imagery slice. **Save visible map** exports visible source imagery at native resolution, without UI or highlight overlays.
- The URL automatically records `map`, `top`, `bottom`, `left`, `right`, optional `room` and `imagery=gameplay` or `imagery=map` when enabled. **Share** copies it. Older `#map=...&x=...&y=...&z=...` links remain readable on initial load.

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

The reviewed captures are included as the optional gameplay version. Its self-contained lossless WebP uses the same 8,320 × 4,576 coordinate system as the normal atlas. Uncaptured cells are pixel-identical to the decoded normal source. `public/gameplay/20261020.json` records room timestamps, matching scores, source crop and the output checksum; the full recording and high-resolution working images remain private in `.local/`. Effects are captured in still frames, not animated. Player, cursor and HUD remain visible, and not every candidate placement has been manually verified.

After extracting full-resolution candidates into a `rooms/rooms.json` manifest, rebuild the public gameplay layer and its generated viewer descriptor with:

```sh
python3 scripts/build_gameplay_atlas.py .local/capture-analysis/rooms/rooms.json
```

### Combine clouded and revealed areas

Captured cells with substantial, repeatedly supported gains combine revealed areas from multiple frames. The selected-screen preview labels these **Combined in-game captures**. Other captured cells retain their original images. This can improve visibility where lighting or cloud cover changes during traversal; unseen areas stay dark, and lighting seams or persistent objects can remain.

`scripts/merge_capture.py` considers only accepted room matches with structural agreement, and copies a clearer 16 × 16 patch only when another temporally separate frame supports it. It copies sampled RGB pixels exactly, rather than taking each pixel's maximum brightness or generating missing detail. The bottom HUD strip and fixed cursor area remain from the base frame. Source-index maps and timestamped patch provenance make each change traceable. Synthetic tests cover complementary reveals, transient bright outliers and insufficient samples.

To repeat the denser analysis, use a new output directory for each step:

```sh
python3 scripts/sample_capture.py \
  '.local/recordings/Screen Recording 2026-10-20 at 13.48.06.mov' \
  .local/capture-analysis/dense --crop 112 132 2560 1408 \
  --all-frames --interval 0.5
python3 scripts/match_capture.py --frames .local/capture-analysis/dense \
  --output .local/capture-analysis/dense-matching
python3 scripts/merge_capture.py \
  --matches .local/capture-analysis/dense-matching/matches.json \
  --capture .local/capture-analysis/dense/capture.json \
  --existing-rooms .local/capture-analysis/rooms/rooms.json \
  --output .local/capture-analysis/merge-study
python3 scripts/build_gameplay_atlas.py .local/capture-analysis/merge-study/layer/rooms.json
python3 -m unittest discover -s tests -p 'test_capture_*.py'
```

The existing-room filter keeps coverage fixed for a merge-only pass. The expanded workflow below explicitly reviews and adds new placements. Building from the original `rooms/rooms.json` instead restores the initial single-frame gameplay version.

## Image provenance and limitations

Atlas images: [cwithw/animal-well-old-maps](https://github.com/cwithw/animal-well-old-maps), source commit `2d187a1dda307dab714956bdddf0992c81b0fddc`. The [original viewer](https://cwithw.github.io/animal-well-old-maps/) explains that older layouts use newer textures. These are textured layouts rather than full-fidelity gameplay captures. Alternate dimensions, secrets, room states and parity with later game builds have not been independently verified. The newest atlas is dated 3 June 2024.

`public/maps.json` records original IDs, sizes, SHA-256 checksums and the pinned source commit. The retained importer explicitly refreshes that collection:

```sh
python3 scripts/import_maps.py
```

The repository's existing licence applies to this project's code; it does not grant rights to Animal Well imagery or third-party material. No image reuse licence was present in the inspected atlas source tree. Public redistribution permission for the atlas collection remains unverified. Attribution is included in the viewer and source manifest; it is not a substitute for permission.

Animal Well © Billy Basso / Shared Memory, published by BIGMODE. This is an independent educational project with no affiliation.

### Expand coverage across matching passes

The additional pass samples the complete recording at a minimum 0.125-second interval (3,027 actual samples). Global matching is followed by a stricter partial-room check: three distinctive spatial regions must agree without conflicting region votes, and independent frames must corroborate the placement. Remaining candidates require visual geometry review. Brightened review copies help inspect dark frames; they are never used as published imagery.

`collate_captures.py` combines accepted samples from several passes, preserves source timestamps and rejects conflicting assignments for the same frame. The default cell bounds restrict this atlas to the main 16 × 16 grid, excluding peripheral export artefacts. `coverage` in the public metadata lists unresolved cells; an unresolved cell does not establish that the recording omitted a visit. Alternate game layers and completeness beyond this source atlas remain unverified.

The retained workflow is:

```sh
python3 scripts/sample_capture.py \
  '.local/recordings/Screen Recording 2026-10-20 at 13.48.06.mov' \
  .local/capture-analysis/pass3 --crop 112 132 2560 1408 \
  --all-frames --interval 0.125
python3 scripts/match_capture.py --frames .local/capture-analysis/pass3 \
  --output .local/capture-analysis/pass3-matching
python3 scripts/refine_capture.py \
  --matches .local/capture-analysis/pass3-matching/matches.json \
  --output .local/capture-analysis/pass3-refined
```

After reviewing the additional placements, collate the keyframe, dense, refined and manually confirmed reports with their matching capture manifests. Use a new output directory:

```sh
python3 scripts/collate_captures.py \
  --matches .local/capture-analysis/timed-matching/matches.json \
    .local/capture-analysis/dense-matching/matches.json \
    .local/capture-analysis/pass3-refined/matches.json \
    .local/capture-analysis/coverage-audit/manual-recoveries.json \
    .local/capture-analysis/final-targeted/extra-matches.json \
  --captures .local/capture-analysis/timed/capture.json \
    .local/capture-analysis/dense/capture.json .local/capture-analysis/pass3/capture.json \
  --output .local/capture-analysis/final-union
python3 scripts/merge_capture.py \
  --matches .local/capture-analysis/final-union/matches.json \
  --capture .local/capture-analysis/final-union/capture.json \
  --existing-rooms .local/capture-analysis/final-union/source-rooms/rooms.json \
  --minimum-changed-pixels 500 --output .local/capture-analysis/final-merges
python3 scripts/build_gameplay_atlas.py .local/capture-analysis/final-merges/layer/rooms.json
```

The 500-pixel minimum avoids publishing tiny changes dominated by animation. It is a heuristic, not a guarantee against lighting seams. All input recordings, sampled frames and audit sheets remain private in `.local/`; only the assembled gameplay atlas and its sanitised provenance are included in the repository.

### Temporal placement and local repairs

The gameplay layer now places footage in all 256 main-map cells. Twenty-six previously unresolved cells were corroborated using visible shape plus the surrounding traversal sequence. Locations `11,13` and `11,17` are explicitly inferred from unique one-cell gaps between identified neighbours; their backgrounds remain heavily obscured. The preview labels inferred locations. This establishes placement coverage for this main atlas, rather than complete visible geometry or coverage of alternate layers.

`scripts/temporal_capture.py` identifies candidate intervals between known rooms. Contrast/gamma-adjusted copies are used only for review; original lighting is retained in published captures. Reviewed temporal matches and the separate inferred completion are collated with the earlier reports before rebuilding the layer.

All 256 cursor footprints have approximate local repairs. The measured cursor mask is only 23 pixels at native room resolution; four weakened detections were visually confirmed and repaired with `--assume-fixed`. Player cleanup repaired 54 rooms: 26 use corroborated backgrounds from other frames of the same room, and 28 use marked nearby-pixel approximations. Undetected player poses may remain. HUD and other animations remain outside the small repair masks.

```sh
python3 scripts/repair_player.py \
  --rooms .local/capture-analysis/temporal-merges/layer/rooms.json \
  --matches .local/capture-analysis/temporal-union/matches.json \
  --template-frame .local/capture-analysis/pass3/frame-0113.png \
  --extra-template .local/native15.png 71 86 81 96 \
  --output .local/capture-analysis/complete-player-cleaned
python3 scripts/repair_cursor.py \
  --rooms .local/capture-analysis/complete-player-cleaned/rooms.json \
  --assume-fixed --output .local/capture-analysis/complete-cleaned-fixed
python3 scripts/build_gameplay_atlas.py .local/capture-analysis/complete-cleaned-fixed/rooms.json
```

Repairs are derivatives: original videos, samples and room exports remain intact. Cleaned copies of all 88 original full-resolution room exports are in `.local/capture-analysis/saved-room-exports-cleaned/`; the six original examples have cleaned siblings in `.local/capture-analysis/examples-cleaned/`. Exact changed-pixel masks and private provenance accompany the derivatives. The public metadata retains sanitised repair methods, rectangles and approximation flags, and the preview identifies locally repaired imagery. Approximate repairs may have tiny colour seams and must not be treated as recovered evidence of hidden level geometry.

### In-game map overlay

The local `public/map/in-game-map.png` comes from [Silverfeelin/AnimalWell-Helper](https://github.com/Silverfeelin/AnimalWell-Helper/blob/81432337b6a95ddbb951e6efcf5d256c2f82e517/src/assets/game/map.png). ANIMAL WELL © 2024 Shared Memory LLC; game assets are explicitly excluded from that repository’s MIT licence. The source author describes educational fair-use intent, which is not a redistribution licence.

Run `python3 scripts/build_map_overlay.py` with Pillow and NumPy to rebuild the local overlay. The 640 × 352 map has 40 × 22 pixels per room; nearest-neighbour scaling by eight places it at atlas coordinates (640, 704), covering rooms 02,04 through 17,19. The source’s coloured pixels overlay a dimmed gameplay atlas. Pixel edges remain crisp at high zoom; vector tracing would add no real detail. `public/map/overlay.json` records the pinned source, checksum and exact transform. The ordinary map omits some hidden or cheat-only details; the overlay does not establish complete geometry in those places.
