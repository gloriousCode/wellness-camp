export interface MapEntry { id: string; date: string; file: string; bytes: number; sha256: string }
export interface Manifest { source: string; commit: string; sourceViewer: string; textureNote: string; maps: MapEntry[] }
export interface Camera { x: number; y: number; scale: number }
export interface Size { width: number; height: number }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface AtlasHandle { zoom: (factor: number) => void; fit: () => void; native: () => void; locate: (x: number, y: number) => void }
