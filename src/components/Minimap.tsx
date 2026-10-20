import { useEffect, useRef } from 'react';
import type { Bounds, Camera, Size } from '../types';

interface Props { image: HTMLImageElement; bounds: Bounds; camera: Camera; size: Size; onLocate: (x: number, y: number) => void }
export function Minimap({ image, bounds, camera, size, onLocate }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = 208, height = Math.round(width * bounds.height / bounds.width);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#070c10'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, width, height);
    const sx = width / bounds.width, sy = height / bounds.height;
    const x = (-camera.x / camera.scale - bounds.x) * sx;
    const y = (-camera.y / camera.scale - bounds.y) * sy;
    ctx.fillStyle = '#caed8928';
    ctx.fillRect(x, y, size.width / camera.scale * sx, size.height / camera.scale * sy);
    ctx.strokeStyle = '#d8f6a5'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, size.width / camera.scale * sx, size.height / camera.scale * sy);
  }, [image, bounds, camera, size, height]);
  return <div className="minimap"><div className="eyebrow">WORLD POSITION <span>↗</span></div>
    <canvas ref={ref} width={width} height={height} tabIndex={0} role="button"
      aria-label="World overview. Click to move the main view; press Enter to centre it."
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onLocate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); } }}
      onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); onLocate(bounds.x + (event.clientX - rect.left) / rect.width * bounds.width, bounds.y + (event.clientY - rect.top) / rect.height * bounds.height); }} />
  </div>;
}
