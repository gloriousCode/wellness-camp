import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fitBounds, imageBounds, zoomAt } from '../camera';
import type { AtlasHandle, Bounds, Camera, MapEntry, Size } from '../types';
import { Minimap } from './Minimap';

interface Props { map: MapEntry; grid: boolean; onCamera: (camera: Camera, size: Size) => void; onPixel: (x: number, y: number) => void }
export const Atlas = forwardRef<AtlasHandle, Props>(function Atlas({ map, grid, onCamera, onPixel }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [bounds, setBounds] = useState<Bounds>({ x: 0, y: 0, width: 8320, height: 4576 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.1 });
  const cameraRef = useRef(camera); cameraRef.current = camera;
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const sizeRef = useRef(size); sizeRef.current = size;
  const [status, setStatus] = useState('Loading room imagery…');
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const fitted = useRef(false);
  const initialised = useRef(false);
  const previousDimensions = useRef('');

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      const old = sizeRef.current;
      if (old.width > 1) setCamera(c => ({ ...c, x: c.x + (next.width - old.width) / 2, y: c.y + (next.height - old.height) / 2 }));
      setSize(next);
    });
    observer.observe(wrapRef.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setImage(null); setStatus('Loading room imagery…');
    pointers.current.clear();
    const next = new Image(); next.decoding = 'async';
    next.onload = () => {
      if (cancelled) return;
      const nextBounds = imageBounds(next);
      const dimensions = `${next.naturalWidth}:${next.naturalHeight}`;
      const shouldFit = !initialised.current || dimensions !== previousDimensions.current;
      previousDimensions.current = dimensions;
      setBounds(nextBounds); setImage(next); setStatus('');
      if (shouldFit) {
        const params = new URLSearchParams(location.hash.slice(1));
        const x = Number(params.get('x')), y = Number(params.get('y')), scale = Number(params.get('z'));
        if (!initialised.current && params.has('x') && params.has('y') && params.has('z') && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(scale) && scale >= 0.025 && scale <= 12) {
          setCamera({ scale, x: sizeRef.current.width / 2 - x * scale, y: sizeRef.current.height / 2 - y * scale });
        } else setCamera(fitBounds(nextBounds, sizeRef.current));
        fitted.current = sizeRef.current.width > 1;
      }
      initialised.current = true;
    };
    next.onerror = () => { if (!cancelled) setStatus('Could not load this map. Try another version or reload the page.'); };
    next.src = `${import.meta.env.BASE_URL}${map.file}`;
    return () => { cancelled = true; next.onload = null; next.onerror = null; next.src = ''; };
  }, [map.id, map.file]);

  useEffect(() => {
    if (image && !fitted.current && size.width > 1) { setCamera(fitBounds(bounds, size)); fitted.current = true; }
  }, [image, bounds, size]);

  const zoom = useCallback((factor: number) => setCamera(c => zoomAt(c, factor, sizeRef.current.width / 2, sizeRef.current.height / 2)), []);
  const fit = useCallback(() => setCamera(fitBounds(bounds, sizeRef.current)), [bounds]);
  const locate = useCallback((x: number, y: number) => setCamera(c => ({ ...c, x: sizeRef.current.width / 2 - x * c.scale, y: sizeRef.current.height / 2 - y * c.scale })), []);
  useImperativeHandle(ref, () => ({ zoom, fit, locate, native: () => setCamera(c => zoomAt(c, 1 / c.scale, sizeRef.current.width / 2, sizeRef.current.height / 2)) }), [zoom, fit, locate]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * dpr); canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr); ctx.fillStyle = '#070c10'; ctx.fillRect(0, 0, size.width, size.height);
    if (image) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, camera.x, camera.y, image.naturalWidth * camera.scale, image.naturalHeight * camera.scale);
      if (grid) {
        const stepX = 320 * camera.scale, stepY = 176 * camera.scale;
        ctx.strokeStyle = '#c7eaa45c'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = camera.x + Math.max(0, Math.floor(-camera.x / stepX)) * stepX; x <= Math.min(size.width, camera.x + image.naturalWidth * camera.scale); x += stepX) { ctx.moveTo(x, Math.max(0, camera.y)); ctx.lineTo(x, Math.min(size.height, camera.y + image.naturalHeight * camera.scale)); }
        for (let y = camera.y + Math.max(0, Math.floor(-camera.y / stepY)) * stepY; y <= Math.min(size.height, camera.y + image.naturalHeight * camera.scale); y += stepY) { ctx.moveTo(Math.max(0, camera.x), y); ctx.lineTo(Math.min(size.width, camera.x + image.naturalWidth * camera.scale), y); }
        ctx.stroke();
      }
    }
    onCamera(camera, size);
  }, [image, camera, size, grid, onCamera]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? sizeRef.current.height : 1);
      setCamera(c => zoomAt(c, Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.004), event.clientX - rect.left, event.clientY - rect.top));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, []);

  return <div className="atlas-wrap" ref={wrapRef}>
    <canvas className="atlas" ref={canvasRef} tabIndex={0} aria-label="Interactive Animal Well atlas. Drag to pan, scroll or pinch to zoom. Arrow keys pan, plus and minus zoom, zero fits the world."
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); }}
      onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const c = cameraRef.current;
        onPixel(Math.floor((event.clientX - rect.left - c.x) / c.scale), Math.floor((event.clientY - rect.top - c.y) / c.scale));
        const previous = pointers.current.get(event.pointerId);
        if (!previous) return;
        const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (other) {
          const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
          const distance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
          if (oldDistance > 0) setCamera(current => { const shifted = { ...current, x: current.x + (event.clientX - previous.x) / 2, y: current.y + (event.clientY - previous.y) / 2 }; return zoomAt(shifted, distance / oldDistance, (event.clientX + other.x) / 2 - rect.left, (event.clientY + other.y) / 2 - rect.top); });
        } else setCamera(current => ({ ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }));
      }}
      onPointerUp={event => pointers.current.delete(event.pointerId)} onPointerCancel={event => pointers.current.delete(event.pointerId)} onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
      onDoubleClick={event => { const r = event.currentTarget.getBoundingClientRect(); setCamera(c => zoomAt(c, event.shiftKey ? 0.5 : 2, event.clientX - r.left, event.clientY - r.top)); }}
      onKeyDown={event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.3); }
        else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.3); }
        else if (event.key === '0') { event.preventDefault(); fit(); }
        else if (event.key.startsWith('Arrow')) { event.preventDefault(); setCamera(c => ({ ...c, x: c.x + (event.key === 'ArrowLeft' ? 80 : event.key === 'ArrowRight' ? -80 : 0), y: c.y + (event.key === 'ArrowUp' ? 80 : event.key === 'ArrowDown' ? -80 : 0) })); }
      }} />
    {status && <div className="load-status" role="status"><span className="status-orb" />{status}</div>}
    {image && <><div className="canvas-caption"><span className="live-dot" /> ORIGINAL ROOM TEXTURES <span className="caption-divider">/</span> {image.naturalWidth.toLocaleString()} × {image.naturalHeight.toLocaleString()} PX</div>
      <Minimap image={image} bounds={bounds} camera={camera} size={size} onLocate={locate} /></>}
  </div>;
});
