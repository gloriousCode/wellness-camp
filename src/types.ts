export interface MapEntry { id: string; date: string; file: string; bytes: number; sha256: string }
export interface Manifest { source: string; commit: string; sourceViewer: string; textureNote: string; maps: MapEntry[] }
export interface Camera { x: number; y: number; scale: number }
export interface Size { width: number; height: number }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface Screen extends Bounds { id: string; column: number; row: number }
export interface WorldView { top: number; bottom: number; left: number; right: number }
export type ImageryMode = 'normal' | 'gameplay' | 'map';
export interface AtlasContent { mapOverlay?: boolean; image: HTMLImageElement; bounds: Bounds; screens: Screen[]; gameplayScreens?: ReadonlySet<string>; mergedScreens?: ReadonlySet<string>; inferredScreens?: ReadonlySet<string>; repairedScreens?: ReadonlySet<string> }
export interface AtlasHandle {
  zoom: (factor: number) => void;
  fit: () => void;
  native: () => void;
  focus: (bounds: Bounds) => void;
  locate: (x: number, y: number) => void;
  setView: (view: WorldView) => void;
  save: (screen?: Screen) => void;
}
