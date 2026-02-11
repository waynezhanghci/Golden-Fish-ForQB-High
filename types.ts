
export interface Vector {
  x: number;
  y: number;
}

export enum KoiType {
  KOHAKU = 'KOHAKU', // White with Red
  YAMABUKI = 'YAMABUKI', // Gold/Yellow
  ORENJI = 'ORENJI', // Deep Orange
  TAISHO = 'TAISHO', // White, Red, Black
  UTSURI = 'UTSURI', // Black with Orange
  TANCHO = 'TANCHO', // White with red dot on head
}

export interface FishGeometry {
  angles: number[];
  leftProfile: Vector[];
  rightProfile: Vector[];
  n: number;
  headP: Vector;
  neckP: Vector;
  tailRoot: Vector;   // Point where flare begins
  tailCenter: Vector; // Deepest point of the V-notch
}

export interface Fish {
  id: number;
  type: KoiType;
  pos: Vector;
  vel: Vector;
  acc: Vector;
  angle: number;
  spine: Vector[]; // The physical backbone of the fish
  targetAngle: number;
  speed: number;
  angularVelocity: number; 
  size: number;
  tailPhase: number; 
  finPhase: number;
  state: 'wandering' | 'seeking' | 'eating' | 'repositioning';
  repositionTimer: number; // Time remaining to swim away before trying again
  target: Vector | null;
  
  // Optimization: Cached geometry to avoid garbage collection
  geo: FishGeometry;

  // GRAPHICS CACHE: Prevents creating Gradient objects every frame (huge GC saver)
  cache: {
    lastType: KoiType | null;
    finGradient: CanvasGradient | null;
  };
}

export interface Food {
  id: number;
  pos: Vector;
  createdAt: number;
}

export interface Ripple {
  id: number;
  pos: Vector;
  radius: number;
  strength: number;
  createdAt: number;
}
