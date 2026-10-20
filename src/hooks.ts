import { useEffect, useState } from 'react';
import { imageBounds } from './camera';
import { detectScreens } from './screens';
import type { AtlasContent, MapEntry } from './types';

/** Load one local atlas and derive selectable cells without altering its source image. */
export function useAtlasContent(map: MapEntry) {
  const [content, setContent] = useState<AtlasContent | null>(null);
  const [status, setStatus] = useState('Loading atlas…');
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
      setContent({ image, bounds: imageBounds(image), screens: detectScreens(pixels, canvas.width, canvas.height, image.naturalWidth, image.naturalHeight) });
      setStatus('');
    };
    image.onerror = () => { if (!cancelled) setStatus('Could not load this atlas. Choose another version or reload.'); };
    image.src = `${import.meta.env.BASE_URL}${map.file}`;
    return () => { cancelled = true; image.onload = null; image.onerror = null; image.src = ''; };
  }, [map.id, map.file]);
  return { content, status };
}
