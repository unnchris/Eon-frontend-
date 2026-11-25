import { useEffect, useRef } from 'react';

export type PresenceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'approval'
  | 'completed'
  | 'error';

interface EonPresenceProps {
  state?: PresenceState;
  pulseCount?: number;
  compact?: boolean;
  className?: string;
}

interface Palette {
  core: [number, number, number];
  accent: [number, number, number];
  rim: [number, number, number];
}

function getPalette(state: PresenceState): Palette {
  switch (state) {
    case 'approval':
      return {
        core: [255, 232, 194],
        accent: [245, 158, 11],
        rim: [251, 191, 36],
      };
    case 'error':
      return {
        core: [255, 212, 220],
        accent: [244, 63, 94],
        rim: [251, 113, 133],
      };
    case 'completed':
      return {
        core: [235, 250, 245],
        accent: [52, 211, 153],
        rim: [110, 231, 183],
      };
    case 'listening':
    case 'thinking':
    case 'executing':
      return {
        core: [243, 246, 255],
        accent: [91, 124, 250],
        rim: [165, 188, 255],
      };
    default:
      return {
        core: [238, 242, 252],
        accent: [91, 124, 250],
        rim: [155, 180, 255],
      };
  }
}

export function EonPresence({
  state = 'idle',
  pulseCount = 0,
  compact = false,
  className = '',
}: EonPresenceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<PresenceState>(state);
  const energyRef = useRef(0);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0.5,
    y: 0.5,
    active: false,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (pulseCount > 0) {
      energyRef.current = Math.min(1, energyRef.current + 0.35);
    }
  }, [pulseCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let width = 0;
    let height = 0;

    const particles = Array.from({ length: compact ? 24 : 44 }, (_, i) => ({
      angle: (i / (compact ? 24 : 44)) * Math.PI * 2,
      radiusScale: 0.45 + ((i * 37) % 100) / 140,
      speed: 0.002 + ((i * 19) % 10) * 0.00045,
      size: 0.8 + ((i * 13) % 10) * 0.11,
      phase: i * 0.7,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerRef.current = {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
        active: true,
      };
    };

    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });

    let t = 0;

    const drawFrame = () => {
      if (!width || !height) {
        if (!reducedMotion) rafId = requestAnimationFrame(drawFrame);
        return;
      }

      const currentState = stateRef.current;
      const palette = getPalette(currentState);
      energyRef.current *= 0.93;

      const speedMult =
        currentState === 'executing' || currentState === 'thinking'
          ? 2.1
          : currentState === 'listening'
          ? 2.6
          : currentState === 'approval'
          ? 0.9
          : 1.0;

      t += 0.012 * speedMult + energyRef.current * 0.015;

      ctx.clearRect(0, 0, width, height);

      const pOffsetX = pointerRef.current.active ? (pointerRef.current.x - 0.5) * 18 : 0;
      const pOffsetY = pointerRef.current.active ? (pointerRef.current.y - 0.5) * 12 : 0;

      const cx = width * 0.5 + pOffsetX * 0.45;
      const cy = height * 0.5 + pOffsetY * 0.45;
      const baseRadius = Math.min(width, height) * (compact ? 0.36 : 0.33);

      // 1. Deep atmospheric halo (subtle, controlled luminance)
      const haloGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.08, cx, cy, baseRadius * 1.9);
      haloGrad.addColorStop(0, `rgba(${palette.core.join(',')}, ${0.14 + energyRef.current * 0.1})`);
      haloGrad.addColorStop(0.38, `rgba(${palette.accent.join(',')}, ${0.12 + energyRef.current * 0.08})`);
      haloGrad.addColorStop(1, 'rgba(5, 6, 8, 0)');
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Organic harmonic manifold filaments (the living intelligence signature)
      const strandCount = compact ? 7 : 11;
      const pointsCount = compact ? 72 : 108;

      for (let s = 0; s < strandCount; s++) {
        const strandNorm = s / strandCount;
        const phaseShift = strandNorm * Math.PI * 2;
        const amplitudeBase =
          baseRadius *
          (0.11 +
            (currentState === 'listening' ? 0.1 : currentState === 'executing' ? 0.07 : 0.04) +
            energyRef.current * 0.08);

        ctx.beginPath();
        for (let i = 0; i <= pointsCount; i++) {
          const theta = (i / pointsCount) * Math.PI * 2;
          const harmonic1 = Math.sin(theta * 3 + t * 1.4 + phaseShift);
          const harmonic2 = Math.cos(theta * 2 - t * 0.9 + phaseShift * 1.5);
          const harmonic3 = Math.sin(theta * 5 + t * 2.1 - strandNorm * 3.1);

          const r =
            baseRadius * (0.76 + strandNorm * 0.34) +
            amplitudeBase * (0.55 * harmonic1 + 0.3 * harmonic2 + 0.15 * harmonic3);

          const tiltX = Math.cos(t * 0.35 + strandNorm) * 0.08;
          const x = cx + Math.cos(theta) * r * (1 + tiltX);
          const y = cy + Math.sin(theta) * r * (compact ? 0.88 : 0.94);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const alpha =
          s === 0
            ? 0.42
            : 0.07 + (1 - Math.abs(strandNorm - 0.5) * 1.6) * 0.14 + energyRef.current * 0.08;
        ctx.strokeStyle =
          s % 3 === 0
            ? `rgba(${palette.core.join(',')}, ${Math.min(0.55, alpha + 0.08)})`
            : `rgba(${palette.rim.join(',')}, ${Math.max(0.05, alpha)})`;
        ctx.lineWidth = s === 0 ? 1.25 : 0.85;
        ctx.stroke();
      }

      // 3. Inner luminous aperture
      const innerPulse = 1 + Math.sin(t * 1.6) * 0.05 + energyRef.current * 0.08;
      const coreRadius = baseRadius * 0.38 * innerPulse;
      const coreGrad = ctx.createRadialGradient(
        cx - coreRadius * 0.2,
        cy - coreRadius * 0.2,
        1,
        cx,
        cy,
        coreRadius * 1.35
      );
      coreGrad.addColorStop(0, `rgba(${palette.core.join(',')}, 0.55)`);
      coreGrad.addColorStop(0.5, `rgba(${palette.accent.join(',')}, 0.24)`);
      coreGrad.addColorStop(1, 'rgba(5, 6, 8, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // 4. Drifting orbital dust particles
      for (const p of particles) {
        p.angle += p.speed * speedMult;
        const drift = Math.sin(t + p.phase) * (baseRadius * 0.08);
        const pr = baseRadius * p.radiusScale * 1.25 + drift;
        const px = cx + Math.cos(p.angle) * pr;
        const py = cy + Math.sin(p.angle) * pr * 0.9;
        const pAlpha = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.phase));
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${palette.rim.join(',')}, ${pAlpha})`;
        ctx.fill();
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [compact]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block select-none pointer-events-none ${className}`}
    />
  );
}
