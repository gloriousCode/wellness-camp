import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cameraForView, fitBounds, zoomAt } from '../camera';
import { screenAt } from '../screens';
import { cameraView, readView } from '../viewUrl';
import type { AtlasContent, AtlasHandle, Bounds, Camera, Screen, Size } from '../types';
import { Minimap } from './Minimap';

interface Props {
  content: AtlasContent | null; status: string; mapId: string; grid: boolean; minimap: boolean;
  selected?: Screen; onSelect: (screen?: Screen) => void;
  onCamera: (camera: Camera, size: Size) => void; onPixel: (x: number, y: number) => void; onError: (message: string) => void;
}
export const Atlas = forwardRef<AtlasHandle, Props>(function Atlas({ content, status, mapId, grid, minimap, selected, onSelect, onCamera, onPixel, onError }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.1 });
  const cameraRef = useRef(camera); cameraRef.current = camera;
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const sizeRef = useRef(size); sizeRef.current = size;
  const [hover, setHover] = useState<Screen>();
  const [menu, setMenu] = useState<{ x: number; y: number; screen: Screen }>();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const clickStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const initialised = useRef(false);
  const previousContent = useRef<AtlasContent | null>(null);
  const fit = useCallback(() => { if (content) setCamera(fitBounds(content.bounds, sizeRef.current)); }, [content]);
  const focus = useCallback((bounds: Bounds) => setCamera(fitBounds(bounds, sizeRef.current)), []);
  const zoom = useCallback((factor: number) => setCamera(c => zoomAt(c, factor, sizeRef.current.width / 2, sizeRef.current.height / 2)), []);
  const locate = useCallback((x: number, y: number) => setCamera(c => ({ ...c, x: sizeRef.current.width / 2 - x * c.scale, y: sizeRef.current.height / 2 - y * c.scale })), []);
  const save = useCallback((screen?: Screen) => {
    if (!content) return;
    const view = cameraView(cameraRef.current, sizeRef.current);
    const left = Math.floor(Math.max(content.bounds.x, view.left));
    const top = Math.floor(Math.max(content.bounds.y, view.top));
    const right = Math.ceil(Math.min(content.bounds.x + content.bounds.width, view.right));
    const bottom = Math.ceil(Math.min(content.bounds.y + content.bounds.height, view.bottom));
    const bounds = screen || { x: left, y: top, width: right - left, height: bottom - top };
    if (bounds.width <= 0 || bounds.height <= 0) { onError('No map imagery is visible. Use Whole world first.'); return; }
    const canvas = document.createElement('canvas'); canvas.width = bounds.width; canvas.height = bounds.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(content.image, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    canvas.toBlob(blob => {
      if (!blob) { onError('This browser could not export the image.'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `animal-well-${mapId}-${content.gameplayScreens ? 'gameplay-' : ''}${screen ? `screen-${screen.id.replace(',', '-')}` : 'view'}.png`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }, [content, mapId, onError]);
  useImperativeHandle(ref, () => ({ zoom, fit, focus, locate, save,
    setView: view => setCamera(cameraForView(view, sizeRef.current)),
    native: () => setCamera(c => zoomAt(c, 1 / c.scale, sizeRef.current.width / 2, sizeRef.current.height / 2))
  }), [zoom, fit, focus, locate, save]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      const old = sizeRef.current;
      if (old.width > 1) setCamera(c => ({ ...c, x: c.x + (next.width - old.width) / 2, y: c.y + (next.height - old.height) / 2 }));
      setSize(next);
    });
    observer.observe(wrapRef.current!); return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!content || size.width <= 1 || previousContent.current === content) return;
    setHover(undefined); setMenu(undefined); pointers.current.clear();
    if (!initialised.current) {
      const params = new URLSearchParams(location.search);
      const view = readView(params);
      const room = params.get('room');
      const screen = content.screens.find(entry => entry.id === room);
      if (view) setCamera(cameraForView(view, size));
      else if (screen) focus(screen);
      else {
        const legacy = new URLSearchParams(location.hash.slice(1));
        const x = Number(legacy.get('x')), y = Number(legacy.get('y')), scale = Number(legacy.get('z'));
        if (legacy.has('x') && legacy.has('y') && scale >= 0.025 && scale <= 12 && Number.isFinite(x) && Number.isFinite(y)) setCamera({ scale, x: size.width / 2 - x * scale, y: size.height / 2 - y * scale });
        else setCamera(fitBounds(content.bounds, size));
      }
      if (screen) onSelect(screen);
      initialised.current = true;
    } else if (previousContent.current && (previousContent.current.image.naturalWidth !== content.image.naturalWidth || previousContent.current.image.naturalHeight !== content.image.naturalHeight)) setCamera(fitBounds(content.bounds, size));
    previousContent.current = content;
  }, [content, size, focus, onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * dpr); canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr); ctx.fillStyle = '#070b19'; ctx.fillRect(0, 0, size.width, size.height);
    if (content) {
      // Smooth downsampling prevents moiré; magnification retains exact pixel edges.
      ctx.imageSmoothingEnabled = camera.scale < 1; ctx.imageSmoothingQuality = 'high';
      for (const screen of content.screens) {
        const x = camera.x + screen.x * camera.scale, y = camera.y + screen.y * camera.scale;
        const width = screen.width * camera.scale, height = screen.height * camera.scale;
        if (x > size.width || y > size.height || x + width < 0 || y + height < 0) continue;
        ctx.drawImage(content.image, screen.x, screen.y, screen.width, screen.height, x, y, width, height);
        if (grid) { ctx.strokeStyle = '#adb8ec3d'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height); }
      }
      for (const [screen, colour] of [[hover, '#c9c1ffa0'], [selected, '#6de0dd']] as const) {
        if (!screen) continue;
        const x = camera.x + screen.x * camera.scale, y = camera.y + screen.y * camera.scale;
        ctx.fillStyle = screen === selected ? '#6de0dd16' : '#b59aff0c';
        ctx.fillRect(x, y, screen.width * camera.scale, screen.height * camera.scale);
        ctx.strokeStyle = colour; ctx.lineWidth = screen === selected ? 2 : 1;
        ctx.strokeRect(x, y, screen.width * camera.scale, screen.height * camera.scale);
      }
    }
    onCamera(camera, size);
  }, [content, camera, size, grid, selected, hover, onCamera]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); setMenu(undefined);
      const rect = canvas.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? sizeRef.current.height : 1);
      setCamera(c => zoomAt(c, Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.004), event.clientX - rect.left, event.clientY - rect.top));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, []);
  const point = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect(), c = cameraRef.current;
    return { x: (clientX - rect.left - c.x) / c.scale, y: (clientY - rect.top - c.y) / c.scale };
  };
  return <div className="atlas-wrap" ref={wrapRef}>
    <canvas className="atlas" ref={canvasRef} tabIndex={0} aria-label="Interactive Animal Well atlas. Drag to pan, scroll or pinch to zoom. Click a screen to select and focus it. Arrow keys pan, plus and minus zoom, zero fits the world."
      onPointerDown={event => {
        if (event.button !== 0) return;
        setMenu(undefined); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        clickStart.current = { x: event.clientX, y: event.clientY, moved: pointers.current.size > 1 };
      }}
      onPointerMove={event => {
        const p = point(event.clientX, event.clientY); onPixel(Math.floor(p.x), Math.floor(p.y));
        setHover(content ? screenAt(content.screens, p.x, p.y) : undefined);
        const previous = pointers.current.get(event.pointerId); if (!previous) return;
        if (clickStart.current && Math.hypot(event.clientX - clickStart.current.x, event.clientY - clickStart.current.y) > 4) clickStart.current.moved = true;
        const rect = event.currentTarget.getBoundingClientRect();
        const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (other) {
          if (clickStart.current) clickStart.current.moved = true;
          const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y), distance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
          if (oldDistance > 0) setCamera(current => zoomAt({ ...current, x: current.x + (event.clientX - previous.x) / 2, y: current.y + (event.clientY - previous.y) / 2 }, distance / oldDistance, (event.clientX + other.x) / 2 - rect.left, (event.clientY + other.y) / 2 - rect.top));
        } else setCamera(current => ({ ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }));
      }}
      onPointerUp={event => {
        if (content && pointers.current.has(event.pointerId) && clickStart.current && !clickStart.current.moved) {
          const p = point(event.clientX, event.clientY), screen = screenAt(content.screens, p.x, p.y);
          onSelect(screen);
          if (screen && !event.shiftKey) focus(screen);
        }
        pointers.current.delete(event.pointerId); clickStart.current = null;
      }}
      onPointerCancel={event => { pointers.current.delete(event.pointerId); clickStart.current = null; }} onLostPointerCapture={event => pointers.current.delete(event.pointerId)} onPointerLeave={() => setHover(undefined)}
      onDoubleClick={event => {
        const p = point(event.clientX, event.clientY), screen = content && screenAt(content.screens, p.x, p.y);
        if (screen && !event.shiftKey) { onSelect(screen); focus(screen); }
        else { const rect = event.currentTarget.getBoundingClientRect(); setCamera(c => zoomAt(c, event.shiftKey ? 0.5 : 2, event.clientX - rect.left, event.clientY - rect.top)); }
      }}
      onContextMenu={event => {
        event.preventDefault(); if (!content) return;
        const p = point(event.clientX, event.clientY), screen = screenAt(content.screens, p.x, p.y);
        if (screen) { const rect = event.currentTarget.getBoundingClientRect(); onSelect(screen); setMenu({ x: Math.max(0, Math.min(size.width - 170, event.clientX - rect.left)), y: Math.max(0, Math.min(size.height - 110, event.clientY - rect.top)), screen }); }
      }}
      onKeyDown={event => {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.3); }
        else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.3); }
        else if (event.key === '0') { event.preventDefault(); fit(); }
        else if (event.key === 'Escape') { setMenu(undefined); onSelect(undefined); }
        else if (event.key.startsWith('Arrow')) { event.preventDefault(); setCamera(c => ({ ...c, x: c.x + (event.key === 'ArrowLeft' ? 80 : event.key === 'ArrowRight' ? -80 : 0), y: c.y + (event.key === 'ArrowUp' ? 80 : event.key === 'ArrowDown' ? -80 : 0) })); }
      }} />
    {status && <div className="load-status" role="status"><span className="status-orb" />{status}</div>}
    {content && <><div className="canvas-caption">{hover ? `SCREEN ${hover.id}` : 'DRAG TO PAN · SCROLL TO ZOOM'} <span>/</span> {content.screens.length} SCREEN CELLS</div>
      {minimap && <Minimap image={content.image} bounds={content.bounds} camera={camera} size={size} onLocate={locate} />}</>}
    {menu && <div className="screen-menu" style={{ left: menu.x, top: menu.y }}><strong>Screen {menu.screen.id}</strong><button onClick={() => { focus(menu.screen); setMenu(undefined); }}>Focus screen</button><button onClick={() => { save(menu.screen); setMenu(undefined); }}>Save screen</button></div>}
  </div>;
});
