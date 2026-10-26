import { useEffect, useRef } from 'react';
import type { AtlasContent, Screen } from '../types';
interface Props { content: AtlasContent; screen: Screen; onFocus: () => void; onSave: () => void; onClear: () => void }
export function ScreenPreview({ content, screen, onFocus, onSave, onClear }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current!.getContext('2d')!;
    context.clearRect(0, 0, screen.width, screen.height);
    context.drawImage(content.image, screen.x, screen.y, screen.width, screen.height, 0, 0, screen.width, screen.height);
  }, [content, screen]);
  return <section className="screen-preview" aria-label="Selected screen">
    <div className="preview-heading"><strong>Screen {screen.id}</strong><button onClick={onClear} aria-label="Clear selected screen">×</button></div>
    <canvas ref={ref} width={screen.width} height={screen.height} aria-label={`Preview of screen ${screen.id}`} />
    {content.space && <p className="preview-source">Community space capture · HUD and stitching artefacts may remain</p>}
    {content.mapOverlay && <p className="preview-source">In-game map over subdued gameplay</p>}
    {content.gameplayScreens && <p className="preview-source">{content.mergedScreens?.has(screen.id) ? 'Combined in-game captures' : content.gameplayScreens.has(screen.id) ? 'In-game capture · candidate match' : 'Normal image · not captured yet'}</p>}
    {content.inferredScreens?.has(screen.id) && <p className="preview-source">Location inferred from neighbouring rooms.</p>}
    {content.repairedScreens?.has(screen.id) && <p className="preview-source">Includes local pixel repairs.</p>}
    <div className="screen-meta"><span>{screen.width} × {screen.height} px</span><span>X {screen.x} · Y {screen.y}</span></div>
    <div className="preview-actions"><button onClick={onFocus}>Focus screen</button><button onClick={onSave}>Save screen ↧</button></div>
  </section>;
}
