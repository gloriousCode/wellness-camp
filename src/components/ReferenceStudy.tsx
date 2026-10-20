import { useEffect, useRef, useState } from 'react';
import { fitBounds, zoomAt } from '../camera';
import type { Camera } from '../types';

/** A reversible display transform for evaluating the annotated screenshot composite. */
export function ReferenceStudy() {
  const pane = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState('invert-hue');
  const [contrast, setContrast] = useState(1);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.04 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const dimensions = { width: 10860, height: 5760 };
  const fit = () => { const rect = pane.current!.getBoundingClientRect(); setCamera(fitBounds({ x: 0, y: 0, ...dimensions }, rect)); };
  useEffect(() => {
    const element = pane.current!;
    const observer = new ResizeObserver(() => { const rect = element.getBoundingClientRect(); setCamera(fitBounds({ x: 0, y: 0, width: 10860, height: 5760 }, rect)); });
    observer.observe(element);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const rect = element.getBoundingClientRect();
      setCamera(c => zoomAt(c, Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * 0.004), event.clientX - rect.left, event.clientY - rect.top));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener('wheel', wheel); };
  }, []);
  const filter = `${mode === 'invert' ? 'invert(1)' : mode === 'invert-hue' ? 'invert(1) hue-rotate(180deg)' : ''} contrast(${contrast})`;
  return <section className="reference-panel" aria-label="Screenshot reference study">
    <header><div><strong>Gameplay screenshot composite</strong><small>lazer-dream · annotations remain · incomplete</small></div><a href="https://www.reddit.com/r/animalWell/comments/1ri7dor/this_is_the_map_i_made_alongside_my_playthrough/" target="_blank" rel="noreferrer">Source ↗</a></header>
    <div className="reference-toolbar"><label>Display <select aria-label="Reference colour transform" value={mode} onChange={event => setMode(event.target.value)}><option value="original">Original</option><option value="invert">Invert RGB</option><option value="invert-hue">Invert + hue correction</option></select></label><button onClick={fit}>Fit</button><button onClick={() => { const r = pane.current!.getBoundingClientRect(); setCamera(c => zoomAt(c, 1 / c.scale, r.width / 2, r.height / 2)); }}>1:1</button><label className="contrast-control">Contrast <input aria-label="Reference contrast" type="range" min="0.5" max="3" step="0.05" value={contrast} onChange={event => setContrast(Number(event.target.value))} /></label></div>
    <div className="reference-canvas" ref={pane} tabIndex={0} aria-label="Screenshot reference. Drag to pan, scroll to zoom. Plus and minus zoom; zero fits the image."
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
      onPointerMove={event => { const previous = drag.current; if (!previous || previous.id !== event.pointerId) return; setCamera(c => ({ ...c, x: c.x + event.clientX - previous.x, y: c.y + event.clientY - previous.y })); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => { if (event.key === '0') { event.preventDefault(); fit(); } else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); const r = pane.current!.getBoundingClientRect(); setCamera(c => zoomAt(c, event.key === '-' ? 1 / 1.5 : 1.5, r.width / 2, r.height / 2)); } }}>
      <img src={`${import.meta.env.BASE_URL}references/lazer-dream-map.jpeg`} alt="Annotated composite of Animal Well gameplay screenshots" draggable={false} onLoad={() => { setLoaded(true); fit(); }} onError={() => setError(true)} style={{ width: dimensions.width, height: dimensions.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`, filter, imageRendering: camera.scale >= 1 ? 'pixelated' : 'auto' }} />
      {!loaded && <div className="load-status" role="status">{error ? 'Reference image could not be loaded.' : 'Loading original screenshot composite…'}</div>}
    </div><footer>Display preview only. No annotation removal, alignment or reconstruction has been applied. The original file is preserved.</footer>
  </section>;
}
