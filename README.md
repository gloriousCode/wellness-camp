# Wellness Camp

A free, unofficial Animal Well atlas for studying level design. Built with React, TypeScript and Vite; the production output is a static website suitable for GitHub Pages.

The default map is **20240603_4757794989373292024**. All 94 map images from cwithw's collection are included locally, but the browser loads only the selected image. The default image is 8,320 × 4,576 pixels and approximately 1.77 MB; the complete archive is 157,515,760 bytes.

## Run locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No game, MAXWELL, account or API key is needed.

## Controls

- Drag to pan; scroll or pinch to zoom around the pointer.
- Double-click to zoom in; Shift + double-click to zoom out.
- Use the on-screen zoom buttons, **Fit world**, or **1:1** for native pixel scale.
- Click the minimap to move around the world.
- Focus the main canvas to use arrow keys to pan, `+` / `-` to zoom and `0` to fit.
- Enable **Room grid** in the sidebar; on smaller screens open settings using the menu button.
- Expand **Historical layouts** to select another capture. Camera position is retained between images with the same dimensions.
- **Share view** creates a URL containing the capture ID, centre position and zoom. A local link remains local; public sharing requires hosting first.

Grid divisions are 320 × 176 pixels and start at the source image origin, including its black margins. They are image coordinates, not verified in-game room identifiers. Fit world detects visible image content to avoid wasting space on the black margins. The minimap shows those same content bounds; the original image remains unmodified.

## Check and build

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` contains the complete site. The Vite base is relative, so files work beneath a GitHub Pages repository path. Browser-local interactions require no backend. Fonts are requested from Google Fonts with system fallbacks; map imagery and application assets are local.

To host on GitHub Pages, publish the contents of `dist/` as a Pages artifact using GitHub Actions, or use an existing static Pages deployment process. No deployment, push or remote settings changes have been performed by this project setup. `.local/` contains private local tooling and save backups and is excluded from both Git and the production build.

## Image provenance and limitations

Map images: [cwithw/animal-well-old-maps](https://github.com/cwithw/animal-well-old-maps), from source commit `2d187a1dda307dab714956bdddf0992c81b0fddc`. The [original viewer](https://cwithw.github.io/animal-well-old-maps/) explains that older layouts use newer textures. These images show textured room layouts; they are not full-fidelity gameplay captures, and completeness across alternate dimensions, secrets or room states has not been independently verified. The newest image in this collection is dated 3 June 2024, which does not establish parity with every later game build.

`public/maps.json` records the source commit, original IDs, sizes and SHA-256 checksums. The retained importer can refresh the collection explicitly:

```sh
python3 scripts/import_maps.py
```

The repository's existing licence applies to this project's code; it does not grant rights to Animal Well imagery or third-party material. No image reuse licence was present in the inspected source tree. Public redistribution permission remains unverified. Attribution is included in the viewer; it is not a substitute for permission.

Animal Well © Billy Basso / Shared Memory, published by BIGMODE. This is an independent educational project with no affiliation.
