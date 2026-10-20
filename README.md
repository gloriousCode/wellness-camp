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
- Click a screen to select it. Double-click, or choose it in the sidebar, to focus it. Shift + double-click zooms out.
- Search coordinates in column,row order, such as `08,12`. Bare numbers match either coordinate.
- Right-click a screen for focus/save actions. The selected-screen panel provides the same actions for touch and keyboard use.
- **Fit world** frames visible content; **1:1** displays one source pixel per CSS pixel.
- Click the minimap to relocate. Settings toggle screen boundaries and the minimap.
- Focus the main canvas for arrow-key panning, `+` / `-` zoom, `0` to fit, and Escape to clear selection.
- Use the header menu button to show or hide the screen browser. Drag its divider to resize it on desktop; focus the divider and use arrow keys for keyboard resizing. Historical atlases are selected with the date dropdown.
- **Save screen** exports the untouched 320 × 176 atlas slice. **Save visible map** exports visible source imagery at native resolution, without UI or highlight overlays.
- The URL automatically records `map`, `top`, `bottom`, `left`, `right` and optional `room`. **Share** copies it. Older `#map=...&x=...&y=...&z=...` links remain readable on initial load.

Screen cells are detected from populated 320 × 176 divisions of the flattened atlas. IDs follow the source-image origin and include its outer margins; they are not verified game room names. Detection is based on visible pixels and may include artefacts or omit visually empty cells. This does not establish completeness of all game areas. Canvas X increases rightwards and Y downwards, with no inversion or rotation. Downsampling is smoothed to avoid moiré; magnified pixels stay crisp.

## Compare the gameplay screenshot composite

**Compare capture** opens a separate pan/zoom panel beside the clean layout atlas. `?compare=1` opens it directly. The original 10,860 × 5,760 JPEG from [u/lazer-dream's Reddit post](https://www.reddit.com/r/animalWell/comments/1ri7dor/this_is_the_map_i_made_alongside_my_playthrough/) is retained unchanged in `public/references/lazer-dream-map.jpeg` with provenance and a checksum in the neighbouring JSON file. The creator describes 390 gameplay screenshots, about 20 annotation layers and an incomplete playthrough.

The panel provides reversible **Original**, **Invert RGB** and **Invert + hue correction** display modes, a contrast slider, fit and native-pixel zoom. These are CSS previews, not reconstructed image files. The two views pan and zoom independently; no registration or synchronised alignment has been applied. The reference image loads only when the comparison panel opens.

The posted image appears inverted/lightened, but the exact original Photoshop processing is unknown. An inversion cannot recover detail overwritten by annotations or recover missing rooms. No annotation removal, inpainting, fabricated lighting or automatic completeness claim has been applied. Obtaining the creator's original screenshot layers would preserve more real detail than reconstruction from the flattened JPEG.

## Check and build

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` contains the complete site and all local public imagery. The relative Vite base supports GitHub Pages repository paths. The interactions need no backend. Fonts are requested from Google Fonts with system fallbacks.

Publish `dist/` as a Pages artifact using GitHub Actions or an existing static Pages deployment process. No deployment, push or remote settings changes have been performed. `.local/` contains private local tooling and save backups and is excluded from Git and the production build.

## Image provenance and limitations

Atlas images: [cwithw/animal-well-old-maps](https://github.com/cwithw/animal-well-old-maps), source commit `2d187a1dda307dab714956bdddf0992c81b0fddc`. The [original viewer](https://cwithw.github.io/animal-well-old-maps/) explains that older layouts use newer textures. These are textured layouts rather than full-fidelity gameplay captures. Alternate dimensions, secrets, room states and parity with later game builds have not been independently verified. The newest atlas is dated 3 June 2024.

`public/maps.json` records original IDs, sizes, SHA-256 checksums and the pinned source commit. The retained importer explicitly refreshes that collection:

```sh
python3 scripts/import_maps.py
```

The repository's existing licence applies to this project's code; it does not grant rights to Animal Well imagery or third-party material. No image reuse licence was present in the inspected atlas source tree. Public redistribution permission for both the atlas collection and Reddit composite remains unverified. Attribution is included in the viewer and provenance records; it is not a substitute for permission.

Animal Well © Billy Basso / Shared Memory, published by BIGMODE. This is an independent educational project with no affiliation.
