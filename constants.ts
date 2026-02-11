import { KoiType } from './types';

export const COLORS = {
  // Background: Clean, slightly warm paper tone
  WATER_BG_TOP: '#f3f4f6', 
  WATER_BG_BOTTOM: '#e5e7eb',
  RIPPLE: 'rgba(150, 160, 170, 0.1)',
  FOOD: '#3e2723', 
  
  // Red Fish (Gongbi Style)
  RED_HEAD: 'rgba(215, 40, 40, 1.0)',
  RED_SCALE_LINE: 'rgba(140, 20, 20, 0.25)', 
  RED_BODY_BG: 'rgba(255, 245, 245, 1.0)',
  // Tail: Head color + 80% White
  RED_TAIL_LIGHT: 'rgba(247, 212, 212, 1.0)', 
  RED_TAIL_START: 'rgba(215, 50, 50, 1.0)', 
  RED_TAIL_WHITE: 'rgba(215, 50, 50, 0.0)', 
  RED_TAIL_END: 'rgba(215, 50, 50, 0.0)', 
  RED_SPINE: 'rgba(120, 20, 20, 0.4)',

  // Black Fish (Ink Style)
  INK_HEAD: 'rgba(15, 15, 20, 1.0)',
  INK_SPINE: 'rgba(15, 15, 20, 0.9)', 
  INK_SCALE_LINE: 'rgba(200, 200, 210, 0.15)', 
  INK_EDGE: 'rgba(20, 20, 25, 0.0)', 
  // Tail: Head color + 80% White (Silver/Grey)
  INK_TAIL_LIGHT: 'rgba(207, 207, 208, 1.0)',
  INK_TAIL_START: 'rgba(30, 30, 35, 1.0)',
  INK_TAIL_WHITE: 'rgba(30, 30, 35, 0.0)', 
  INK_TAIL_END: 'rgba(30, 30, 35, 0.0)',
  INK_SPINE_SHADOW: 'rgba(0, 0, 0, 0.6)',

  // Gold Fish
  GOLD_HEAD: 'rgba(230, 170, 20, 1.0)',
  GOLD_SCALE_LINE: 'rgba(164, 114, 0, 0.3)',
  // Tail: Head color + 80% White
  GOLD_TAIL_LIGHT: 'rgba(250, 238, 208, 1.0)',
  GOLD_TAIL_START: 'rgba(230, 170, 20, 1.0)',
  GOLD_TAIL_WHITE: 'rgba(230, 170, 20, 0.0)', 
  GOLD_TAIL_END: 'rgba(230, 170, 20, 0.0)',
  GOLD_SPINE: 'rgba(140, 100, 0, 0.4)',
};

export const PHYSICS = {
  MAX_SPEED: 1.2, // Increased base speed
  MAX_FORCE: 0.05, // Increased force for snappier acceleration
  TURN_SPEED: 0.008, 
  FRICTION: 0.98,
  SEPARATION_RADIUS: 250, 
  ALIGN_RADIUS: 150,
  COHESION_RADIUS: 150,
  FOOD_DETECTION_RADIUS: 700, // Increased detection range
  EAT_DISTANCE: 22, // Slightly larger eat hitbox for faster pace
  SPINE_SEGMENTS: 16, 
};

export const KOI_CONFIGS = [
  { type: KoiType.KOHAKU, size: 1.1 }, 
  { type: KoiType.UTSURI, size: 1.15 }, 
  { type: KoiType.YAMABUKI, size: 1.0 }, 
  { type: KoiType.KOHAKU, size: 0.95 }, 
  { type: KoiType.UTSURI, size: 1.2 },
  { type: KoiType.TAISHO, size: 1.05 },
];