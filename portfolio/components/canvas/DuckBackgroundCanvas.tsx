'use client';

import { useEffect, useRef } from 'react';
import type { Duck, Cloud, WaveLayer, DuckCanvasProps } from '@/types/canvas';
import styles from './DuckBackgroundCanvas.module.scss';

/* ─── Factory helpers ─────────────────────────────────────────────────────── */

function makeDuck(width: number, height: number, layer: number): Duck {
  const horizon = height * 0.42;
  const depths = [0.08, 0.33, 0.64];
  const scales = [0.55, 0.82, 1.18];
  const waterH = height - horizon;
  const baseY = horizon + waterH * depths[layer];
  const speed = 0.3 + Math.random() * 0.5;
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  return {
    x: Math.random() * width,
    y: baseY,
    baseY,
    size: 38 * scales[layer],
    vx: speed * dir,
    direction: dir,
    swimCycle: Math.random() * Math.PI * 2,
    swimSpeed: 0.022 + Math.random() * 0.016,
    bobPhase: Math.random() * Math.PI * 2,
    layer,
    ripples: [],
    rippleTimer: Math.random() * 80,
  };
}

function makeCloud(width: number, height: number): Cloud {
  const numPuffs = 3 + Math.floor(Math.random() * 3);
  const baseR = 20 + Math.random() * 24;
  const puffs: Array<{ dx: number; dy: number; r: number }> = [{ dx: 0, dy: 0, r: baseR }];
  for (let i = 1; i < numPuffs; i++) {
    puffs.push({
      dx: (Math.random() * 1.8 - 0.4) * baseR * i * 0.55,
      dy: (Math.random() - 0.7) * baseR * 0.55,
      r: baseR * (0.5 + Math.random() * 0.55),
    });
  }
  return {
    x: Math.random() * (width + 400) - 200,
    y: height * (0.04 + Math.random() * 0.26),
    speed: 0.08 + Math.random() * 0.14,
    puffs,
    opacity: 0.6 + Math.random() * 0.28,
  };
}

function buildWaveLayers(_width: number, height: number, isDark: boolean): WaveLayer[] {
  const horizon = height * 0.42;
  const waterH = height - horizon;

  if (isDark) {
    return [
      {
        yBase: horizon + waterH * 0.04,
        color: 'rgba(18, 38, 80, 0.55)',
        amps: [3, 2, 1.5],
        freqs: [0.013, 0.024, 0.062],
        speeds: [0.38, 0.58, 0.95],
        phases: [0, 1.2, 2.4],
      },
      {
        yBase: horizon + waterH * 0.28,
        color: 'rgba(12, 26, 65, 0.72)',
        amps: [5, 3.5, 2.2],
        freqs: [0.01, 0.02, 0.048],
        speeds: [0.32, 0.52, 0.88],
        phases: [1.0, 0.5, 1.8],
      },
      {
        yBase: horizon + waterH * 0.6,
        color: 'rgba(8, 18, 52, 0.88)',
        amps: [7, 5, 3],
        freqs: [0.008, 0.018, 0.038],
        speeds: [0.24, 0.4, 0.72],
        phases: [2.0, 1.5, 0.8],
      },
      {
        yBase: horizon + waterH * 0.86,
        color: 'rgba(5, 12, 40, 0.97)',
        amps: [4.5, 3, 2],
        freqs: [0.007, 0.015, 0.032],
        speeds: [0.18, 0.33, 0.62],
        phases: [0.5, 2.2, 1.0],
      },
    ];
  }

  return [
    {
      yBase: horizon + waterH * 0.04,
      color: 'rgba(130, 190, 228, 0.45)',
      amps: [3, 2, 1.5],
      freqs: [0.013, 0.024, 0.062],
      speeds: [0.38, 0.58, 0.95],
      phases: [0, 1.2, 2.4],
    },
    {
      yBase: horizon + waterH * 0.28,
      color: 'rgba(65, 125, 195, 0.68)',
      amps: [5, 3.5, 2.2],
      freqs: [0.01, 0.02, 0.048],
      speeds: [0.32, 0.52, 0.88],
      phases: [1.0, 0.5, 1.8],
    },
    {
      yBase: horizon + waterH * 0.6,
      color: 'rgba(38, 88, 168, 0.86)',
      amps: [7, 5, 3],
      freqs: [0.008, 0.018, 0.038],
      speeds: [0.24, 0.4, 0.72],
      phases: [2.0, 1.5, 0.8],
    },
    {
      yBase: horizon + waterH * 0.86,
      color: 'rgba(22, 60, 145, 0.96)',
      amps: [4.5, 3, 2],
      freqs: [0.007, 0.015, 0.032],
      speeds: [0.18, 0.33, 0.62],
      phases: [0.5, 2.2, 1.0],
    },
  ];
}

/* ─── Drawing functions ───────────────────────────────────────────────────── */

function drawDuck(ctx: CanvasRenderingContext2D, duck: Duck) {
  const { x, y, direction, swimCycle } = duck;
  const s = duck.size / 38;

  ctx.save();
  ctx.translate(x, y);
  if (direction === -1) ctx.scale(-1, 1);
  ctx.rotate(Math.sin(swimCycle) * 0.07);

  // ── Water shadow
  ctx.save();
  ctx.scale(1, 0.28);
  ctx.beginPath();
  ctx.ellipse(0, 38 * s * 0.78, 38 * s * 0.55, 38 * s * 0.13, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 50, 120, 0.13)';
  ctx.fill();
  ctx.restore();

  // ── Body
  const bg = ctx.createRadialGradient(
    -38 * s * 0.08,
    -38 * s * 0.12,
    38 * s * 0.05,
    38 * s * 0.05,
    38 * s * 0.05,
    38 * s * 0.52
  );
  bg.addColorStop(0, '#FFFFF2');
  bg.addColorStop(0.22, '#FFE840');
  bg.addColorStop(0.58, '#FFD700');
  bg.addColorStop(0.84, '#E8A000');
  bg.addColorStop(1, '#B87000');

  ctx.beginPath();
  ctx.ellipse(0, 0, 38 * s * 0.5, 38 * s * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 100, 0, 0.22)';
  ctx.lineWidth = 0.8 * s;
  ctx.stroke();

  // ── Tail
  ctx.save();
  ctx.translate(-38 * s * 0.4, -38 * s * 0.08);
  ctx.rotate(-0.42 + Math.sin(swimCycle * 0.7) * 0.12);
  ctx.beginPath();
  ctx.ellipse(0, -38 * s * 0.04, 38 * s * 0.16, 38 * s * 0.1, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#E8A800';
  ctx.fill();
  ctx.restore();

  // ── Neck
  const headX = 38 * s * 0.37;
  const headY = -38 * s * 0.47;
  const headR = 38 * s * 0.22;

  ctx.beginPath();
  ctx.moveTo(38 * s * 0.18, -38 * s * 0.16);
  ctx.bezierCurveTo(
    38 * s * 0.3,
    -38 * s * 0.18,
    headX - headR * 0.1,
    headY + headR * 0.65,
    headX,
    headY + headR * 0.22
  );
  ctx.strokeStyle = '#F0BE00';
  ctx.lineWidth = 38 * s * 0.22;
  ctx.lineCap = 'round';
  ctx.stroke();

  // ── Head
  const hg = ctx.createRadialGradient(
    headX - headR * 0.28,
    headY - headR * 0.28,
    headR * 0.04,
    headX,
    headY,
    headR
  );
  hg.addColorStop(0, '#FFFFF5');
  hg.addColorStop(0.28, '#FFE840');
  hg.addColorStop(0.68, '#FFD700');
  hg.addColorStop(1, '#CC9000');

  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 100, 0, 0.18)';
  ctx.lineWidth = 0.8 * s;
  ctx.stroke();

  // ── Beak
  const mouthOpen = Math.max(0, Math.sin(swimCycle * 1.8)) * 0.09;
  ctx.save();
  ctx.translate(headX + headR * 0.9, headY + headR * 0.04);

  const beakGrad = ctx.createLinearGradient(0, 0, 0, headR * 0.22);
  beakGrad.addColorStop(0, '#FFA020');
  beakGrad.addColorStop(1, '#D05000');

  ctx.beginPath();
  ctx.moveTo(0, -headR * 0.18);
  ctx.lineTo(headR * 0.68, headR * 0.06);
  ctx.lineTo(0, headR * 0.22);
  ctx.closePath();
  ctx.fillStyle = beakGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 80, 0, 0.35)';
  ctx.lineWidth = 0.6 * s;
  ctx.stroke();

  if (mouthOpen > 0.01) {
    ctx.beginPath();
    ctx.moveTo(0, headR * 0.22);
    ctx.lineTo(headR * 0.52, headR * (0.22 + mouthOpen * 2.2));
    ctx.lineTo(0, headR * (0.22 + mouthOpen * 3.2));
    ctx.closePath();
    ctx.fillStyle = '#D86010';
    ctx.fill();
  }
  ctx.restore();

  // ── Eye
  ctx.beginPath();
  ctx.arc(headX + headR * 0.32, headY - headR * 0.18, headR * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = '#0C0C2A';
  ctx.fill();

  // Eye highlight
  ctx.beginPath();
  ctx.arc(headX + headR * 0.36, headY - headR * 0.23, headR * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();

  // ── Wing detail (feather suggestion)
  ctx.beginPath();
  ctx.ellipse(
    -38 * s * 0.04,
    38 * s * 0.04,
    38 * s * 0.3,
    38 * s * 0.18,
    0.08,
    0.08,
    Math.PI * 0.82
  );
  ctx.strokeStyle = 'rgba(190, 140, 0, 0.28)';
  ctx.lineWidth = 1.2 * s;
  ctx.stroke();

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud) {
  ctx.save();
  ctx.globalAlpha = cloud.opacity;
  for (const p of cloud.puffs) {
    const grad = ctx.createRadialGradient(
      cloud.x + p.dx,
      cloud.y + p.dy - p.r * 0.18,
      p.r * 0.08,
      cloud.x + p.dx,
      cloud.y + p.dy,
      p.r
    );
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.55, 'rgba(238,248,255,0.82)');
    grad.addColorStop(1, 'rgba(200,228,255,0.0)');
    ctx.beginPath();
    ctx.arc(cloud.x + p.dx, cloud.y + p.dy, p.r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

function drawWaveLayer(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  layer: WaveLayer,
  t: number
) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let px = 0; px <= W; px += 3) {
    let yy = layer.yBase;
    for (let j = 0; j < layer.amps.length; j++) {
      yy += Math.sin(px * layer.freqs[j] + t * layer.speeds[j] + layer.phases[j]) * layer.amps[j];
    }
    ctx.lineTo(px, yy);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = layer.color;
  ctx.fill();
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function DuckBackgroundCanvas({ ducksCount = 7, isDark = false }: DuckCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let t = 0;
    let ducks: Duck[] = [];
    const clouds: Cloud[] = [];

    const init = () => {
      const W = canvas.width;
      const H = canvas.height;

      ducks = [];
      const perLayer = Math.ceil(ducksCount / 3);
      for (let l = 0; l < 3; l++) {
        for (let i = 0; i < perLayer && ducks.length < ducksCount; i++) {
          ducks.push(makeDuck(W, H, l));
        }
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Respawn clouds at new dimensions
      clouds.length = 0;
      for (let i = 0; i < 5; i++) clouds.push(makeCloud(canvas.width, canvas.height));
      init();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    /* Shimmer positions seeded once so they don't jump on resize */
    const shimmerSeeds = Array.from({ length: 22 }, (_, i) => ({
      xSeed: (i * 137.5081) % 1,
      ySeed: (i * 97.3123) % 1,
    }));

    /* Star positions seeded once for dark mode */
    const starSeeds = Array.from({ length: 55 }, (_, i) => ({
      xSeed: (i * 173.2341 + 0.3) % 1,
      ySeed: (i * 89.4523 + 0.15) % 1,
      r: 0.6 + ((i * 53.117) % 1) * 1.4,
      twinkleOffset: (i * 61.831) % (Math.PI * 2),
    }));

    const frame = () => {
      const W = canvas.width;
      const H = canvas.height;
      const horizon = H * 0.42;
      const waveLayers = buildWaveLayers(W, H, isDark);

      ctx.clearRect(0, 0, W, H);

      if (isDark) {
        /* ── Night sky ── */
        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, '#030812');
        sky.addColorStop(0.38, '#080E22');
        sky.addColorStop(0.72, '#0D1530');
        sky.addColorStop(1.0, '#121C3A');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, horizon);

        /* ── Night ocean base ── */
        const ocean = ctx.createLinearGradient(0, horizon, 0, H);
        ocean.addColorStop(0, '#0D1E3A');
        ocean.addColorStop(0.24, '#091428');
        ocean.addColorStop(0.58, '#060E1E');
        ocean.addColorStop(0.86, '#040A16');
        ocean.addColorStop(1.0, '#020710');
        ctx.fillStyle = ocean;
        ctx.fillRect(0, horizon, W, H - horizon);

        /* ── Horizon glow (moonlight) ── */
        const hg = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 22);
        hg.addColorStop(0, 'rgba(160,200,255,0)');
        hg.addColorStop(0.5, 'rgba(160,200,255,0.10)');
        hg.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, horizon - 20, W, 42);

        /* ── Stars ── */
        const skyH = horizon;
        for (const s of starSeeds) {
          const sx = s.xSeed * W;
          const sy = s.ySeed * skyH * 0.95;
          const alpha = 0.45 + Math.sin(t * 0.8 + s.twinkleOffset) * 0.3;
          ctx.beginPath();
          ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 235, 255, ${Math.max(0, alpha)})`;
          ctx.fill();
        }

        /* ── Moon ── */
        const moonX = W * 0.82;
        const moonY = H * 0.11;
        const moonR = 26;

        const moonGlow = ctx.createRadialGradient(
          moonX,
          moonY,
          moonR * 0.4,
          moonX,
          moonY,
          moonR * 3.5
        );
        moonGlow.addColorStop(0, 'rgba(200,220,255,0.28)');
        moonGlow.addColorStop(0.4, 'rgba(180,200,255,0.10)');
        moonGlow.addColorStop(1, 'rgba(160,190,255,0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI * 2);
        ctx.fill();

        const moonDisk = ctx.createRadialGradient(moonX - 6, moonY - 6, 2, moonX, moonY, moonR);
        moonDisk.addColorStop(0, '#F5F8FF');
        moonDisk.addColorStop(0.55, '#D8E6FF');
        moonDisk.addColorStop(1, '#B8CCEE');
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fillStyle = moonDisk;
        ctx.fill();

        /* crescent shadow */
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.beginPath();
        ctx.arc(moonX + moonR * 0.4, moonY - moonR * 0.1, moonR * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8, 14, 32, 0.75)';
        ctx.fill();
        ctx.restore();

        /* ── Moonlight reflection on water ── */
        ctx.save();
        ctx.globalAlpha = 0.18;
        const refGrad = ctx.createLinearGradient(moonX, horizon, moonX * 0.7, H);
        refGrad.addColorStop(0, 'rgba(180,210,255,0.7)');
        refGrad.addColorStop(1, 'rgba(180,210,255,0)');
        ctx.beginPath();
        ctx.moveTo(moonX - 14, horizon);
        ctx.lineTo(moonX - 55, H);
        ctx.lineTo(moonX + 55, H);
        ctx.lineTo(moonX + 14, horizon);
        ctx.closePath();
        ctx.fillStyle = refGrad;
        ctx.fill();
        ctx.restore();

        /* ── Water shimmer (moonlight) ── */
        ctx.save();
        for (let i = 0; i < shimmerSeeds.length; i++) {
          const { xSeed, ySeed } = shimmerSeeds[i];
          const sx = (xSeed * W + t * 18) % W;
          const sy = horizon + ySeed * (H - horizon) * 0.65;
          const alpha = (Math.sin(t * 1.8 + i * 0.75) + 1) * 0.5 * 0.18;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 10 + (i % 5), 1.8, (t * 0.3 + i * 0.31) % Math.PI, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,210,255,${alpha})`;
          ctx.fill();
        }
        ctx.restore();
      } else {
        /* ── Day sky ── */
        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, '#4AAEE0');
        sky.addColorStop(0.4, '#79C0E8');
        sky.addColorStop(0.78, '#B0D9F0');
        sky.addColorStop(1.0, '#D2EDF8');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, horizon);

        /* ── Ocean base ── */
        const ocean = ctx.createLinearGradient(0, horizon, 0, H);
        ocean.addColorStop(0, '#78BBDF');
        ocean.addColorStop(0.22, '#56A0CE');
        ocean.addColorStop(0.58, '#3A7AB8');
        ocean.addColorStop(0.86, '#255898');
        ocean.addColorStop(1.0, '#1A3E78');
        ctx.fillStyle = ocean;
        ctx.fillRect(0, horizon, W, H - horizon);

        /* ── Horizon glow ── */
        const hg = ctx.createLinearGradient(0, horizon - 28, 0, horizon + 28);
        hg.addColorStop(0, 'rgba(220,242,255,0)');
        hg.addColorStop(0.5, 'rgba(220,242,255,0.22)');
        hg.addColorStop(1, 'rgba(180,222,255,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, horizon - 28, W, 56);

        /* ── Sun ── */
        const sunX = W * 0.82;
        const sunY = H * 0.11;
        const sunR = 36;

        const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 3.8);
        sunGlow.addColorStop(0, 'rgba(255,240,140,0.42)');
        sunGlow.addColorStop(1, 'rgba(255,240,140,0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR * 3.8, 0, Math.PI * 2);
        ctx.fill();

        const sunDisk = ctx.createRadialGradient(sunX - 8, sunY - 8, 2, sunX, sunY, sunR);
        sunDisk.addColorStop(0, '#FFFCE0');
        sunDisk.addColorStop(0.55, '#FFE840');
        sunDisk.addColorStop(1, '#FFD000');
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
        ctx.fillStyle = sunDisk;
        ctx.fill();

        /* ── Sun ray reflection on water ── */
        ctx.save();
        ctx.globalAlpha = 0.12;
        const refGrad = ctx.createLinearGradient(sunX, horizon, sunX * 0.65, H);
        refGrad.addColorStop(0, 'rgba(255,240,180,0.8)');
        refGrad.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.beginPath();
        ctx.moveTo(sunX - 30, horizon);
        ctx.lineTo(sunX - 80, H);
        ctx.lineTo(sunX + 80, H);
        ctx.lineTo(sunX + 30, horizon);
        ctx.closePath();
        ctx.fillStyle = refGrad;
        ctx.fill();
        ctx.restore();

        /* ── Clouds ── */
        for (const cloud of clouds) {
          drawCloud(ctx, cloud);
          cloud.x += cloud.speed;
          if (cloud.x - 300 > W) cloud.x = -300;
        }

        /* ── Water shimmer (sunlight) ── */
        ctx.save();
        for (let i = 0; i < shimmerSeeds.length; i++) {
          const { xSeed, ySeed } = shimmerSeeds[i];
          const sx = (xSeed * W + t * 28) % W;
          const sy = horizon + ySeed * (H - horizon) * 0.65;
          const alpha = (Math.sin(t * 2.8 + i * 0.75) + 1) * 0.5 * 0.32;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 11 + (i % 6), 2.2, (t * 0.45 + i * 0.31) % Math.PI, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
        ctx.restore();
      }

      /* ── Wave layers + ducks interleaved for depth ── */
      drawWaveLayer(ctx, W, H, waveLayers[0], t);

      for (const d of ducks.filter((d) => d.layer === 0)) {
        drawDuck(ctx, d);
        for (const rip of d.ripples) {
          ctx.save();
          ctx.globalAlpha = rip.op;
          ctx.strokeStyle = isDark ? 'rgba(70,110,180,0.55)' : 'rgba(140,190,240,0.65)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y + 6, rip.r, rip.r * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      drawWaveLayer(ctx, W, H, waveLayers[1], t);

      for (const d of ducks.filter((d) => d.layer === 1)) {
        drawDuck(ctx, d);
        for (const rip of d.ripples) {
          ctx.save();
          ctx.globalAlpha = rip.op;
          ctx.strokeStyle = isDark ? 'rgba(55,90,160,0.52)' : 'rgba(120,175,230,0.60)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y + 6, rip.r, rip.r * 0.32, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      drawWaveLayer(ctx, W, H, waveLayers[2], t);

      for (const d of ducks.filter((d) => d.layer === 2)) {
        drawDuck(ctx, d);
        for (const rip of d.ripples) {
          ctx.save();
          ctx.globalAlpha = rip.op;
          ctx.strokeStyle = isDark ? 'rgba(40,70,140,0.48)' : 'rgba(100,160,220,0.55)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y + 8, rip.r, rip.r * 0.34, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      drawWaveLayer(ctx, W, H, waveLayers[3], t);

      /* ── Update ducks ── */
      for (const duck of ducks) {
        duck.swimCycle += duck.swimSpeed;
        duck.x += duck.vx;
        duck.y = duck.baseY + Math.sin(duck.swimCycle + duck.bobPhase) * (2 + duck.layer * 1.6);
        duck.direction = duck.vx > 0 ? 1 : -1;

        if (duck.vx > 0 && duck.x > W + duck.size * 2.2) duck.x = -duck.size * 2.2;
        if (duck.vx < 0 && duck.x < -duck.size * 2.2) duck.x = W + duck.size * 2.2;

        duck.rippleTimer++;
        if (duck.rippleTimer > 45 + Math.random() * 35) {
          duck.rippleTimer = 0;
          duck.ripples.push({ r: 4, maxR: 22 + duck.size * 0.28, op: 0.65 });
        }
        for (let i = duck.ripples.length - 1; i >= 0; i--) {
          duck.ripples[i].r += 0.38;
          duck.ripples[i].op -= 0.011;
          if (duck.ripples[i].op <= 0) duck.ripples.splice(i, 1);
        }
      }

      t += 0.016;
      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [ducksCount, isDark]);

  return <canvas ref={canvasRef} aria-hidden="true" className={styles.canvas} />;
}
