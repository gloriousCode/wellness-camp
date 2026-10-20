import { useEffect, useState } from 'react';
import { imageBounds } from './camera';
import { detectScreens } from './screens';
import { GAMEPLAY_ATLAS } from './gameplay';
import type { AtlasContent, ImageryMode, MapEntry } from './types';

/** Load one local atlas and derive selectable cells without altering its source image. */
export function useAtlasContent(map: MapEntry, imagery: ImageryMode = 'normal') {
  const [content, setContent] = useState<AtlasContent | null>(null);
  const [status, setStatus] = useState('Loading atlas…');
  const gameplay = imagery === 'gameplay' && map.id === GAMEPLAY_ATLAS.mapId;
  const file = gameplay ? GAMEPLAY_ATLAS.file : map.file;
  useEffect(() => {
    let cancelled = false;
    const image = new Image(); image.decoding = 'async';
    setContent(null); setStatus('Loading atlas…');
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(image.naturalWidth / 8);
      canvas.height = Math.ceil(image.naturalHeight / 8);
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      setContent({ image, bounds: imageBounds(image), screens: detectScreens(pixels, canvas.width, canvas.height, image.naturalWidth, image.naturalHeight),
        gameplayScreens: gameplay ? new Set(GAMEPLAY_ATLAS.roomIds) : undefined,
        mergedScreens: gameplay ? new Set(GAMEPLAY_ATLAS.mergedRoomIds) : undefined });
      setStatus('');
    };
    image.onerror = () => { if (!cancelled) setStatus('Could not load this atlas. Choose another version or reload.'); };
    image.src = `${import.meta.env.BASE_URL}${file}`;
    return () => {
      cancelled = true; image.onload = null; image.onerror = null;
      // Keep loaded dimensions available while Atlas compares the old and new imagery.
      if (!image.complete) image.src = '';
    };
  }, [map.id, file, gameplay]);
  return { content, status };
}
