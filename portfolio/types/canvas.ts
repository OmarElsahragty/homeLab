export interface Duck {
  x: number;
  y: number;
  baseY: number;
  size: number;
  vx: number;
  direction: 1 | -1;
  swimCycle: number;
  swimSpeed: number;
  bobPhase: number;
  layer: number;
  ripples: Array<{ r: number; maxR: number; op: number }>;
  rippleTimer: number;
}

export interface Cloud {
  x: number;
  y: number;
  speed: number;
  puffs: Array<{ dx: number; dy: number; r: number }>;
  opacity: number;
}

export interface WaveLayer {
  yBase: number;
  color: string;
  amps: number[];
  freqs: number[];
  speeds: number[];
  phases: number[];
}

export interface DuckCanvasProps {
  ducksCount?: number;
  isDark?: boolean;
}
