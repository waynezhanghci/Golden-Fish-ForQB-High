import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { Fish, Food, Ripple, Vector, KoiType, FishGeometry } from '../types';
import { PHYSICS, KOI_CONFIGS, COLORS } from '../constants';

// --- Zero-Allocation Math Helpers (Mutable) ---
const setVec = (target: Vector, x: number, y: number) => {
  target.x = x;
  target.y = y;
};

const subVec = (target: Vector, v1: Vector, v2: Vector) => {
  target.x = v1.x - v2.x;
  target.y = v1.y - v2.y;
};

const multVec = (target: Vector, n: number) => {
  target.x *= n;
  target.y *= n;
};

const distSq = (v1: Vector, v2: Vector) => {
  const dx = v1.x - v2.x;
  const dy = v1.y - v2.y;
  return dx * dx + dy * dy;
};

const magVec = (v: Vector) => Math.hypot(v.x, v.y);

const addVec = (target: Vector, v: Vector) => {
  target.x += v.x;
  target.y += v.y;
};

const getFishWidth = (t: number, size: number) => {
  if (t < 0.2) {
    const x = t / 0.2;
    return (0.45 + 0.55 * Math.sqrt(1 - Math.pow(x - 1, 2))) * size * 0.6;
  } else if (t < 0.7) {
    const p = (t - 0.2) / 0.5;
    return (1.0 - (1 - Math.cos(p * Math.PI / 2)) * 0.9) * size * 0.6;
  } else {
    const p = (t - 0.7) / 0.3;
    return (0.15 + (1 - Math.cos(p * Math.PI / 2)) * 1.5) * size * 0.6;
  }
};

const updateFishGeometry = (fish: Fish, waveAmplitude: number) => {
  const spinePoints = fish.spine;
  const n = spinePoints.length;
  const { angles, leftProfile, rightProfile } = fish.geo;

  // 1. Calculate Angles
  for (let i = 0; i < n; i++) {
    let dx = 0, dy = 0;
    if (i === 0) {
      dx = spinePoints[1].x - spinePoints[0].x;
      dy = spinePoints[1].y - spinePoints[0].y;
    } else if (i === n - 1) {
      dx = spinePoints[i].x - spinePoints[i - 1].x;
      dy = spinePoints[i].y - spinePoints[i - 1].y;
    } else {
      dx = spinePoints[i + 1].x - spinePoints[i - 1].x;
      dy = spinePoints[i + 1].y - spinePoints[i - 1].y;
    }
    angles[i] = Math.atan2(dy, dx);
  }

  // 2. Calculate Profile
  for (let i = 0; i < n; i++) {
    const p = spinePoints[i];
    const t = i / (n - 1);
    const wave = Math.sin(fish.tailPhase - i * 0.4) * waveAmplitude * (i / n) * 14;
    const perp = angles[i] + Math.PI / 2;
    const w = getFishWidth(t, fish.size);

    const wx = Math.cos(perp) * wave;
    const wy = Math.sin(perp) * wave;
    const cx = Math.cos(perp) * w;
    const cy = Math.sin(perp) * w;

    // Mutate existing vectors - No Allocation
    leftProfile[i].x = p.x + cx + wx;
    leftProfile[i].y = p.y + cy + wy;
    rightProfile[i].x = p.x - cx + wx;
    rightProfile[i].y = p.y - cy + wy;
  }
  
  // References - assign reference, no allocation
  fish.geo.headP = spinePoints[0];
  fish.geo.neckP = spinePoints[1];
  fish.geo.tailRoot = spinePoints[n - 7];
  
  // Update tailCenter in place - No Allocation
  const pN2 = spinePoints[n - 2];
  const pN3 = spinePoints[n - 3];
  fish.geo.tailCenter.x = (pN2.x + pN3.x) * 0.5;
  fish.geo.tailCenter.y = (pN2.y + pN3.y) * 0.5;
};

// --- Physics Logic (Static, outside component) ---
const updateAllPhysics = (
    width: number, 
    height: number,
    fishes: Fish[],
    foods: Food[],
    ripples: Ripple[],
    settings: any,
    scratch: any
) => {
    const { vec1, vec2 } = scratch;

    // Ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += 1.0; 
      if (r.radius > 0) r.strength -= 0.005;
      if (r.strength <= 0) ripples.splice(i, 1);
    }

    // Food Floating & Expiration (Prevent memory leak)
    const nowSec = Date.now() * 0.001;
    const FOOD_LIFETIME = 30; // Seconds before food disappears
    
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      // Float animation
      f.pos.x += Math.cos(nowSec + f.id) * 0.15;
      f.pos.y += Math.sin(nowSec + f.id) * 0.15;
      
      // Garbage collection for uneaten food
      if (nowSec * 1000 - f.createdAt > FOOD_LIFETIME * 1000) {
          foods.splice(i, 1);
      }
    }

    // Fish
    const fishCount = fishes.length;
    const swimSpeed = settings.swimSpeed;
    const detectionSq = PHYSICS.FOOD_DETECTION_RADIUS * PHYSICS.FOOD_DETECTION_RADIUS;

    for(let i=0; i<fishCount; i++) {
      const fish = fishes[i];
      if (fish.repositionTimer === undefined) fish.repositionTimer = 0;

      // Reset desired velocity (vec1)
      setVec(vec1, 0, 0); 
      
      // Behavioral Logic
      if (fish.repositionTimer > 0) {
        fish.state = 'repositioning';
        fish.repositionTimer--;
        
        const change = 0.05; 
        fish.targetAngle += (Math.random() * 2 - 1) * change;
        
        const vLen = magVec(fish.vel);
        const vx = vLen > 0 ? fish.vel.x / vLen : 0;
        const vy = vLen > 0 ? fish.vel.y / vLen : 0;

        const wanderD = 100;
        const wanderR = 10;
        
        const cx = vx * wanderD;
        const cy = vy * wanderD;
        
        const offX = Math.cos(fish.targetAngle) * wanderR;
        const offY = Math.sin(fish.targetAngle) * wanderR;
        
        const targetX = cx + offX;
        const targetY = cy + offY;
        
        // limit
        const tLen = Math.hypot(targetX, targetY);
        const maxS = PHYSICS.MAX_SPEED * 1.2 * swimSpeed;
        if(tLen > maxS) {
            setVec(vec1, (targetX / tLen) * maxS, (targetY / tLen) * maxS);
        } else {
            setVec(vec1, targetX, targetY);
        }

      } else {
        let closestFood: Food | null = null;
        let closestDistSq = Infinity;
        
        // Optimization: Standard loop
        for (let k = 0; k < foods.length; k++) {
          const f = foods[k];
          const dSq = distSq(fish.pos, f.pos);
          if (dSq < detectionSq && dSq < closestDistSq) {
            closestDistSq = dSq;
            closestFood = f;
          }
        }

        if (closestFood) {
          fish.state = 'seeking';
          // vec2 = toFood
          subVec(vec2, closestFood.pos, fish.pos);
          const d = Math.sqrt(closestDistSq);

          const vLen = magVec(fish.vel);
          const headX = vLen > 0 ? fish.vel.x / vLen : 0;
          const headY = vLen > 0 ? fish.vel.y / vLen : 0;

          const fDist = magVec(vec2);
          const foodDirX = fDist > 0 ? vec2.x / fDist : 0;
          const foodDirY = fDist > 0 ? vec2.y / fDist : 0;

          const alignment = headX * foodDirX + headY * foodDirY;

          if (d < 50 && alignment < 0.2) {
             fish.repositionTimer = 90; 
          }

          let speed = PHYSICS.MAX_SPEED * 2.8 * swimSpeed; 
          const arrivalRadius = 120;
          
          if (d < arrivalRadius) {
            speed = speed * (d / arrivalRadius);
            speed = Math.max(speed, 0.5); 
          }

          setVec(vec1, foodDirX * speed, foodDirY * speed);
          
          if (d < PHYSICS.EAT_DISTANCE) {
            const idx = foods.indexOf(closestFood);
            if (idx > -1) {
              foods.splice(idx, 1);
              ripples.push({ id: Date.now(), pos: {x: fish.pos.x, y: fish.pos.y}, radius: 0, strength: 1.0, createdAt: Date.now() });
            }
          }
        } else {
          fish.state = 'wandering';
          const change = 0.003;
          fish.targetAngle += (Math.random() * 2 - 1) * change;
          
          const vLen = magVec(fish.vel);
          const vx = vLen > 0 ? fish.vel.x / vLen : 0;
          const vy = vLen > 0 ? fish.vel.y / vLen : 0;
          
          const wanderD = 1000;
          const wanderR = 10;
          
          const cx = vx * wanderD;
          const cy = vy * wanderD;
          
          const offX = Math.cos(fish.targetAngle) * wanderR;
          const offY = Math.sin(fish.targetAngle) * wanderR;
          
          const targetX = cx + offX;
          const targetY = cy + offY;

          const tLen = Math.hypot(targetX, targetY);
          const maxS = PHYSICS.MAX_SPEED * 0.8 * swimSpeed;
          
          if(tLen > maxS) {
            setVec(vec1, (targetX / tLen) * maxS, (targetY / tLen) * maxS);
          } else {
            setVec(vec1, targetX, targetY);
          }
        }
      }

      const margin = 150;
      const steerStr = 8.0; 
      if (fish.pos.x < margin) vec1.x += steerStr * Math.pow(1 - fish.pos.x / margin, 2);
      if (fish.pos.x > width - margin) vec1.x -= steerStr * Math.pow(1 - (width - fish.pos.x) / margin, 2);
      if (fish.pos.y < margin) vec1.y += steerStr * Math.pow(1 - fish.pos.y / margin, 2);
      if (fish.pos.y > height - margin) vec1.y -= steerStr * Math.pow(1 - (height - fish.pos.y) / margin, 2);
      
      const speedLimitMultiplier = fish.state === 'seeking' ? 2.8 : (fish.state === 'repositioning' ? 1.2 : 1.0);
      const maxSpd = PHYSICS.MAX_SPEED * speedLimitMultiplier * swimSpeed;
      
      const dvLen = magVec(vec1);
      if (dvLen > maxSpd) {
         // Normalize and scale in place
         multVec(vec1, maxSpd / dvLen);
      }

      const currentAngle = Math.atan2(fish.vel.y, fish.vel.x);
      const desiredAngle = Math.atan2(vec1.y, vec1.x);
      const currentSpeed = magVec(fish.vel);
      const targetSpeed = magVec(vec1);
      
      const isSeeking = fish.state === 'seeking';
      const isRepositioning = fish.state === 'repositioning';
      
      const accelRate = isSeeking || isRepositioning ? 0.2 : 0.04;
      const newSpeed = Math.max(PHYSICS.MAX_SPEED * 0.1, currentSpeed + (targetSpeed - currentSpeed) * accelRate);

      let deltaAngle = desiredAngle - currentAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      
      let turnMultiplier = 1.0;
      if (isSeeking) turnMultiplier = 6.0;
      if (isRepositioning) turnMultiplier = 4.0;
      
      const finalMaxTurn = 0.0025 * turnMultiplier * (newSpeed / PHYSICS.MAX_SPEED + 0.5); 
      
      deltaAngle = Math.max(-finalMaxTurn, Math.min(finalMaxTurn, deltaAngle));
      const newAngle = currentAngle + deltaAngle;

      fish.vel.x = Math.cos(newAngle) * newSpeed;
      fish.vel.y = Math.sin(newAngle) * newSpeed;
      
      addVec(fish.pos, fish.vel);

      // Robust Bounds Clamping
      const boundsMargin = 50;
      if (fish.pos.x < -boundsMargin) fish.pos.x = -boundsMargin;
      if (fish.pos.x > width + boundsMargin) fish.pos.x = width + boundsMargin;
      if (fish.pos.y < -boundsMargin) fish.pos.y = -boundsMargin;
      if (fish.pos.y > height + boundsMargin) fish.pos.y = height + boundsMargin;
      
      if (fish.pos.x < 0) fish.vel.x += 0.1;
      if (fish.pos.x > width) fish.vel.x -= 0.1;
      if (fish.pos.y < 0) fish.vel.y += 0.1;
      if (fish.pos.y > height) fish.vel.y -= 0.1;

      const rate = 0.02 + (newSpeed / PHYSICS.MAX_SPEED) * 0.08;
      fish.tailPhase += rate;
      fish.finPhase += rate * 1.1;
      fish.speed = newSpeed;

      // Spine IK
      const baseLen = fish.size * 6.5;
      const totalLen = baseLen * settings.bodyLength;
      const segLen = totalLen / (PHYSICS.SPINE_SEGMENTS - 1);

      fish.spine[0].x = fish.pos.x;
      fish.spine[0].y = fish.pos.y;
      
      for (let k = 1; k < fish.spine.length; k++) {
        const prev = fish.spine[k - 1];
        const curr = fish.spine[k];
        let dx = curr.x - prev.x;
        let dy = curr.y - prev.y;
        let cAngle = Math.atan2(dy, dx);
        
        if (k > 1) {
          const prev2 = fish.spine[k - 2];
          const pAngle = Math.atan2(prev.y - prev2.y, prev.x - prev2.x);
          let diff = cAngle - pAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const MAX_BEND = 0.18;
          if (Math.abs(diff) > MAX_BEND) cAngle = pAngle + (diff > 0 ? MAX_BEND : -MAX_BEND);
        }
        // Direct assignment, no allocation
        curr.x = prev.x + Math.cos(cAngle) * segLen;
        curr.y = prev.y + Math.sin(cAngle) * segLen;
      }

      updateFishGeometry(fish, settings.waveAmplitude);
    }
};

// --- Rendering Logic (Static, outside component) ---

const drawUnifiedFishPath = (ctx: CanvasRenderingContext2D, geo: FishGeometry) => {
    ctx.moveTo(geo.rightProfile[0].x, geo.rightProfile[0].y);
    for (let i = 1; i < geo.n; i++) {
      const p0 = geo.rightProfile[i - 1];
      const p1 = geo.rightProfile[i];
      ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    }
    const tipL = geo.leftProfile[geo.n - 1];
    const center = geo.tailCenter;
    
    ctx.lineTo(center.x, center.y);
    ctx.lineTo(tipL.x, tipL.y);
    
    for (let i = geo.n - 1; i > 0; i--) {
      const p0 = geo.leftProfile[i];
      const p1 = geo.leftProfile[i - 1];
      ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    }
    
    const bodyAngle = Math.atan2(geo.headP.y - geo.neckP.y, geo.headP.x - geo.neckP.x);
    const dx = geo.leftProfile[0].x - geo.rightProfile[0].x;
    const dy = geo.leftProfile[0].y - geo.rightProfile[0].y;
    const headW = Math.sqrt(dx*dx + dy*dy) * 0.75;
    
    ctx.bezierCurveTo(
      geo.leftProfile[0].x + Math.cos(bodyAngle) * headW, geo.leftProfile[0].y + Math.sin(bodyAngle) * headW,
      geo.rightProfile[0].x + Math.cos(bodyAngle) * headW, geo.rightProfile[0].y + Math.sin(bodyAngle) * headW,
      geo.rightProfile[0].x, geo.rightProfile[0].y
    );
    ctx.closePath();
};

const drawSingleFin = (ctx: CanvasRenderingContext2D, fish: Fish, p: Vector, angle: number, side: number, isShadow: boolean) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    const w = fish.size * 0.6; 
    ctx.translate(0, side * w * 0.65);
    ctx.rotate(side * (Math.PI * 0.22 - 0.15));
    const fl = (fish.size * 3.2) * 0.5;
    const fw = (fish.size * 0.75) * 1.1;
    const curveY = side * fw * 0.8;
    
    if (!isShadow) ctx.beginPath();

    if (side === 1) {
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(fl * 0.35, 0, fl, 0);
        ctx.quadraticCurveTo(fl * 0.25, curveY, 0, 0);
    } else {
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(fl * 0.25, curveY, fl, 0);
        ctx.quadraticCurveTo(fl * 0.35, 0, 0, 0);
    }

    ctx.closePath();

    if (!isShadow && fish.cache.finGradient) {
        ctx.fillStyle = fish.cache.finGradient;
        ctx.fill();

        ctx.save();
        ctx.clip(); 
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; 
        ctx.lineWidth = 0.5;
        const rayCount = 7; 
        for (let j = 1; j <= rayCount; j++) {
            const t = j / 8;
            const tx = fl * (0.5 + t * 0.5); 
            const ty = curveY * t * 0.9;
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(fl * 0.2, curveY * t * 0.5, tx, ty);
        }
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

const drawFins = (ctx: CanvasRenderingContext2D, fish: Fish, isShadow: boolean) => {
    const geo = fish.geo;
    const finIdx = 3;
    const p = fish.spine[finIdx];
    if (!p) return;
    const angle = geo.angles[finIdx];
    
    drawSingleFin(ctx, fish, p, angle, 1, isShadow);
    drawSingleFin(ctx, fish, p, angle, -1, isShadow);
};

const THEMES = [
  { 
    id: 'RED', 
    type: KoiType.KOHAKU, 
    label: 'Pure Red', 
    color: 'linear-gradient(135deg, #d72828 0%, #fbcfe8 100%)', 
  },
  { 
    id: 'GOLD', 
    type: KoiType.YAMABUKI, 
    label: 'Gold', 
    color: 'linear-gradient(135deg, #e6aa14 0%, #fff9c4 100%)', 
  },
  { 
    id: 'ORANGE_GOLD', 
    type: KoiType.UTSURI, 
    label: 'Orange-Gold', 
    color: 'linear-gradient(135deg, #ea580c 0%, #facc15 100%)', 
  },
];

const KoiPond: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use a ref to store size to avoid checking DOM in loop
  const sizeRef = useRef({ width: 0, height: 0 });
  const bgGradientRef = useRef<CanvasGradient | null>(null);

  const settings = useRef({
    fishCount: 1, 
    bodyLength: 1.0,
    waveAmplitude: 1.0,
    swimSpeed: 1.0,
    shadowAngle: 45,
    shadowHeight: 50,
  });

  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);

  const fishes = useRef<Fish[]>([]);
  const foods = useRef<Food[]>([]);
  const ripples = useRef<Ripple[]>([]);
  
  const scratch = useRef({
    vec1: { x: 0, y: 0 },
    vec2: { x: 0, y: 0 },
    vec3: { x: 0, y: 0 },
    vec4: { x: 0, y: 0 },
  });

  const animationFrameId = useRef<number>(0);

  // ResizeObserver to handle layout changes without polling in render loop
  useLayoutEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const updateSize = (w: number, h: number) => {
        const iw = Math.floor(w);
        const ih = Math.floor(h);
        
        if (sizeRef.current.width !== iw || sizeRef.current.height !== ih) {
            sizeRef.current = { width: iw, height: ih };
            if (canvasRef.current) {
                canvasRef.current.width = iw;
                canvasRef.current.height = ih;
                // Invalidate gradient on resize
                bgGradientRef.current = null;
            }
        }
    };

    // Initial size set
    const rect = containerRef.current.getBoundingClientRect();
    updateSize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
            // Use contentRect for precise content box size
            updateSize(entry.contentRect.width, entry.contentRect.height);
        }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Theme Sync
  useEffect(() => {
    fishes.current.forEach(fish => {
      fish.type = selectedTheme.type;
    });
  }, [selectedTheme]);

  // Initial Spawn Logic
  useEffect(() => {
    const targetCount = settings.current.fishCount;
    fishes.current = []; 

    for (let i = 0; i < targetCount; i++) {
        const config = KOI_CONFIGS[0];
        const padding = 200;
        // Fallback to window size if ref is empty initially
        const startW = sizeRef.current.width || window.innerWidth;
        const startH = sizeRef.current.height || window.innerHeight;
        
        const pos = {
          x: padding + Math.random() * (startW - padding * 2),
          y: padding + Math.random() * (startH - padding * 2)
        };
        const angle = Math.random() * Math.PI * 2;
        const spine: Vector[] = [];
        for (let j = 0; j < PHYSICS.SPINE_SEGMENTS; j++) {
        spine.push({
            x: pos.x - Math.cos(angle) * j * 5,
            y: pos.y - Math.sin(angle) * j * 5
        });
        }

        const geo: FishGeometry = {
          angles: new Array(PHYSICS.SPINE_SEGMENTS).fill(0),
          leftProfile: Array.from({ length: PHYSICS.SPINE_SEGMENTS }, () => ({ x: 0, y: 0 })),
          rightProfile: Array.from({ length: PHYSICS.SPINE_SEGMENTS }, () => ({ x: 0, y: 0 })),
          n: PHYSICS.SPINE_SEGMENTS,
          headP: spine[0],
          neckP: spine[1],
          tailRoot: spine[PHYSICS.SPINE_SEGMENTS - 7],
          tailCenter: { x: spine[PHYSICS.SPINE_SEGMENTS - 3].x, y: spine[PHYSICS.SPINE_SEGMENTS - 3].y },
        };

        fishes.current.push({
          id: Date.now() + i,
          type: selectedTheme.type, 
          pos: pos,
          vel: { x: Math.cos(angle) * 0.5, y: Math.sin(angle) * 0.5 },
          acc: { x: 0, y: 0 },
          angle: angle,
          spine: spine,
          targetAngle: angle,
          speed: 0.5,
          angularVelocity: 0,
          size: config.size * 50,
          tailPhase: Math.random() * Math.PI * 2,
          finPhase: Math.random() * Math.PI * 2,
          state: 'wandering',
          repositionTimer: 0,
          target: null,
          geo: geo,
          cache: { lastType: null, finGradient: null }
        });
    }
  }, []); 

  const renderFrame = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { alpha: false });
    if (!ctx) return;

    const width = sizeRef.current.width;
    const height = sizeRef.current.height;

    // Safety check if size is invalid
    if (width === 0 || height === 0) {
        animationFrameId.current = requestAnimationFrame(renderFrame);
        return;
    }

    // 1. Physics Update (Static call)
    updateAllPhysics(width, height, fishes.current, foods.current, ripples.current, settings.current, scratch.current);

    // 2. Rendering
    
    // Background (Cached Gradient)
    if (!bgGradientRef.current) {
        const bg = ctx.createLinearGradient(0, height, 0, 0);
        bg.addColorStop(0, '#f3e7e9');
        bg.addColorStop(0.99, '#e3eeff');
        bg.addColorStop(1, '#e3eeff');
        bgGradientRef.current = bg;
    }
    ctx.fillStyle = bgGradientRef.current;
    ctx.fillRect(0, 0, width, height);

    // Ripples
    const rList = ripples.current;
    for (let i = 0; i < rList.length; i++) {
      const r = rList[i];
      if (r.radius > 0) {
        ctx.beginPath();
        ctx.arc(r.pos.x, r.pos.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(140, 150, 160, ${r.strength * 0.25})`; 
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }

    const angleRad = settings.current.shadowAngle * (Math.PI / 180);
    const shadowX = Math.cos(angleRad) * settings.current.shadowHeight;
    const shadowY = Math.sin(angleRad) * settings.current.shadowHeight;

    // Shadows
    ctx.save();
    ctx.translate(shadowX, shadowY);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)'; 
    
    const fList = foods.current;
    for (let i = 0; i < fList.length; i++) {
      const f = fList[i];
      ctx.beginPath();
      ctx.arc(f.pos.x, f.pos.y, 6, 0, Math.PI * 2); 
      ctx.fill();
    }
    
    const fishList = fishes.current;
    for(let i=0; i<fishList.length; i++) {
      const fish = fishList[i];
      
      // Update Gradient Cache if Dirty
      if (fish.cache.lastType !== fish.type) {
         const fl = (fish.size * 3.2) * 0.5;
         const fGrad = ctx.createLinearGradient(0, 0, fl, 0);
         let baseColor = COLORS.RED_HEAD;
         switch(fish.type) {
             case KoiType.YAMABUKI: baseColor = COLORS.GOLD_HEAD; break;
             case KoiType.UTSURI: baseColor = '#ea580c'; break;
             case KoiType.TAISHO: baseColor = '#ED824A'; break;
             case KoiType.ORENJI: baseColor = '#CC423A'; break;
         }
         
         fGrad.addColorStop(0, baseColor);
         if (fish.type === KoiType.ORENJI) {
             fGrad.addColorStop(1, 'rgba(226, 177, 86, 0.4)'); 
         } else if (fish.type === KoiType.TAISHO) {
             fGrad.addColorStop(1, 'rgba(88, 143, 198, 0.4)'); 
         } else {
             fGrad.addColorStop(1, 'rgba(255,255,255,0)');
         }
         fish.cache.finGradient = fGrad;
         fish.cache.lastType = fish.type;
      }

      ctx.beginPath(); 
      drawUnifiedFishPath(ctx, fish.geo);
      drawFins(ctx, fish, true); 
      ctx.fill();
    }
    ctx.restore();

    // Food
    for (let i = 0; i < fList.length; i++) {
      const f = fList[i];
      ctx.beginPath();
      ctx.arc(f.pos.x, f.pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#8B5A2B'; 
      ctx.fill();
      
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = '#3e2723'; 
      ctx.stroke();

      const seed = f.id; 
      ctx.fillStyle = '#5C3A1E'; 
      for(let j=0; j<4; j++) { 
         const r = ((seed + j) % 3); 
         const theta = ((seed * j) % 6.28);
         const sx = f.pos.x + Math.cos(theta) * r;
         const sy = f.pos.y + Math.sin(theta) * r;
         ctx.beginPath();
         ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
         ctx.fill();
      }
    }

    // Fish Bodies
    for(let i=0; i<fishList.length; i++) {
      const fish = fishList[i];
      const geo = fish.geo;
      
      drawFins(ctx, fish, false);
      
      const bodyAngle = Math.atan2(geo.headP.y - geo.neckP.y, geo.headP.x - geo.neckP.x);
      const gradLen = fish.size * 8.5;
      const gradEndX = geo.headP.x - Math.cos(bodyAngle) * gradLen;
      const gradEndY = geo.headP.y - Math.sin(bodyAngle) * gradLen;
      const grad = ctx.createLinearGradient(geo.headP.x, geo.headP.y, gradEndX, gradEndY);

      if (fish.type === KoiType.YAMABUKI) {
        grad.addColorStop(0, COLORS.GOLD_HEAD);
        grad.addColorStop(1.0, COLORS.GOLD_TAIL_LIGHT);
      } else if (fish.type === KoiType.UTSURI) {
        grad.addColorStop(0, '#ea580c'); 
        grad.addColorStop(1.0, '#facc15'); 
      } else if (fish.type === KoiType.TAISHO) {
        grad.addColorStop(0, '#ED824A'); 
        grad.addColorStop(1.0, '#588FC6'); 
      } else if (fish.type === KoiType.ORENJI) {
        grad.addColorStop(0, '#CC423A'); 
        grad.addColorStop(1.0, '#E2B156'); 
      } else {
        grad.addColorStop(0, COLORS.RED_HEAD);
        grad.addColorStop(1.0, COLORS.RED_TAIL_LIGHT);
      }
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      drawUnifiedFishPath(ctx, geo);
      ctx.fill();

      // Spine Shadow
      const spineLen = geo.n - 4; 
      if (spineLen > 2) {
        ctx.save();
        ctx.beginPath();
        for (let k = 0; k < spineLen; k++) {
            const p = fish.spine[k];
            const angle = geo.angles[k] + 1.57; 
            const t = k / spineLen;
            const w = (1 - t) * (fish.size * 0.22); 
            const dx = Math.cos(angle) * w;
            const dy = Math.sin(angle) * w;
            if (k === 0) ctx.moveTo(p.x + dx, p.y + dy);
            else ctx.lineTo(p.x + dx, p.y + dy);
        }
        for (let k = spineLen - 1; k >= 0; k--) {
            const p = fish.spine[k];
            const angle = geo.angles[k] + 1.57;
            const t = k / spineLen;
            const w = (1 - t) * (fish.size * 0.22);
            const dx = Math.cos(angle) * w;
            const dy = Math.sin(angle) * w;
            ctx.lineTo(p.x - dx, p.y - dy);
        }
        ctx.closePath();

        ctx.filter = `blur(${fish.size * 0.12}px)`; 
        ctx.globalCompositeOperation = 'multiply'; 

        const sGrad = ctx.createLinearGradient(geo.headP.x, geo.headP.y, fish.spine[spineLen].x, fish.spine[spineLen].y);
        let spineColor = COLORS.RED_SPINE;
        if (fish.type === KoiType.YAMABUKI) spineColor = COLORS.GOLD_SPINE;
        else if (fish.type === KoiType.UTSURI) spineColor = 'rgba(234, 88, 12, 0.3)';
        else if (fish.type === KoiType.TAISHO) spineColor = 'rgba(237, 130, 74, 0.3)';
        else if (fish.type === KoiType.ORENJI) spineColor = 'rgba(204, 66, 58, 0.3)';

        sGrad.addColorStop(0, spineColor);
        sGrad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = sGrad;
        ctx.fill();
        ctx.restore();
      }

      // Dorsal Fin
      const dStart = 4;
      const dEnd = geo.n - 8; 
      if (dEnd > dStart) {
         ctx.save();
         ctx.beginPath();
         const finSway = Math.sin(fish.finPhase * 1.5) * 1.5;
         const sizeFactor = fish.size / 50;
         
         for(let k = dStart; k <= dEnd; k++) {
             const t = (k - dStart) / (dEnd - dStart);
             const p = fish.spine[k];
             const angle = geo.angles[k] - 1.57;
             const widthFactor = (Math.sin(t * 3.14) * 0.8 + 0.2) * sizeFactor;
             const swayOffset = finSway * Math.sin(t * 3.14);
             
             const cosA = Math.cos(angle);
             const sinA = Math.sin(angle);
             const cosA90 = -sinA; 
             const sinA90 = cosA;
             
             const dx = cosA * widthFactor + cosA90 * swayOffset;
             const dy = sinA * widthFactor + sinA90 * swayOffset;
             
             if (k === dStart) ctx.moveTo(p.x + dx, p.y + dy);
             else ctx.lineTo(p.x + dx, p.y + dy);
         }
         for(let k = dEnd; k >= dStart; k--) {
             const t = (k - dStart) / (dEnd - dStart);
             const p = fish.spine[k];
             const angle = geo.angles[k] - 1.57;
             const widthFactor = (Math.sin(t * 3.14) * 0.8 + 0.2) * sizeFactor;
             const swayOffset = finSway * Math.sin(t * 3.14);
             
             const cosA = Math.cos(angle);
             const sinA = Math.sin(angle);
             const cosA90 = -sinA; 
             const sinA90 = cosA;
             
             const dx = cosA * widthFactor + cosA90 * swayOffset;
             const dy = sinA * widthFactor + sinA90 * swayOffset;
             
             ctx.lineTo(p.x - dx, p.y - dy);
         }
         ctx.closePath();
         const pStart = fish.spine[dStart];
         const pEnd = fish.spine[dEnd];
         const dGrad = ctx.createLinearGradient(pStart.x, pStart.y, pEnd.x, pEnd.y);
         dGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
         dGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.3)');
         dGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
         ctx.fillStyle = dGrad;
         ctx.fill();
         ctx.restore();
      }
    }

    animationFrameId.current = requestAnimationFrame(renderFrame);
  };

  useEffect(() => {
    // Start loop
    renderFrame();

    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const id = Date.now();
      foods.current.push({
        id,
        pos: { x, y },
        createdAt: Date.now(),
      });
      ripples.current.push({
        id,
        pos: { x, y },
        radius: 0,
        strength: 1.0,
        createdAt: Date.now(),
      });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#f3f4f6]">
      <canvas ref={canvasRef} onClick={handleClick} className="block w-full h-full cursor-pointer" />
      
      {/* Color Theme Picker - Bottom Left */}
      <div className="absolute bottom-6 left-6 flex gap-3 z-10">
        {THEMES.map(theme => (
            <button
                key={theme.id}
                onClick={(e) => { e.stopPropagation(); setSelectedTheme(theme); }}
                className={`w-11 h-11 rounded-full shadow-lg transition-transform hover:scale-110 border-none p-0 cursor-pointer ${selectedTheme.id === theme.id ? 'scale-125' : 'scale-100'}`}
                style={{
                  background: theme.color,
                  border: 'none',
                  outline: 'none'
                }}
                title={theme.label}
                aria-label={theme.label}
            />
        ))}
      </div>
    </div>
  );
};

export default KoiPond;