export interface ParallaxStar {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  vx: number; // normalized drift/sec
  vy: number; // normalized drift/sec
  size: number;
  depth: number;
  layer: 0 | 1 | 2;
  alpha: number;
  tint: string;
  twinklePhase: number;
  twinkleSpeed: number;
  glint: boolean;
}

export interface NebulaCloud {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  vx: number; // normalized drift/sec
  vy: number; // normalized drift/sec
  width: number;
  height: number;
  depth: number;
  alpha: number;
  rotation: number;
  vRot: number;
  pulsePhase: number;
  pulseSpeed: number;
  sprite: HTMLCanvasElement | null;
}

export interface ClusterStar {
  dx: number;
  dy: number;
  size: number;
  alpha: number;
  tint: string;
  twinklePhase: number;
  twinkleSpeed: number;
  glint: boolean;
}

export interface StarCluster {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  vx: number; // normalized drift/sec
  vy: number; // normalized drift/sec
  depth: number;
  glowRadius: number;
  glowAlpha: number;
  glowSprite: HTMLCanvasElement | null;
  stars: ClusterStar[];
}

export interface ParallaxSpaceState {
  nebulae: NebulaCloud[];
  starClusters: StarCluster[];
  stars: ParallaxStar[];
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createGlowSprite(rgb: string): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const size = 64;
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const octx = offscreen.getContext("2d");
  if (!octx) return null;
  const half = size * 0.5;
  const grad = octx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${rgb}, 0.55)`);
  grad.addColorStop(0.45, `rgba(${rgb}, 0.18)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  octx.fillStyle = grad;
  octx.fillRect(0, 0, size, size);
  return offscreen;
}

function createProceduralNebulaSprite(
  seed: number,
  primaryRgb: string,
  secondaryRgb: string,
  highlightRgb: string,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const width = 340;
  const height = 260;
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const octx = offscreen.getContext("2d");
  if (!octx) return null;

  const rng = createSeededRng(seed);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const baseAngle = rng() * Math.PI * 2;

  // 1. Multi-lobe ionized gas clouds arranged along a curved organic spine
  octx.globalCompositeOperation = "lighter";
  const lobeCount = 11;
  for (let i = 0; i < lobeCount; i++) {
    const t = i / (lobeCount - 1) - 0.5;
    const curveOffset = Math.sin(t * Math.PI * 1.4 + seed) * 24;
    const lx =
      cx +
      Math.cos(baseAngle) * t * 140 -
      Math.sin(baseAngle) * curveOffset +
      (rng() - 0.5) * 32;
    const ly =
      cy +
      Math.sin(baseAngle) * t * 110 +
      Math.cos(baseAngle) * curveOffset +
      (rng() - 0.5) * 28;
    const radius = 56 + rng() * 64;
    const rgb = i % 3 === 0 ? secondaryRgb : primaryRgb;
    const peakAlpha = 0.09 + rng() * 0.08;

    const grad = octx.createRadialGradient(lx, ly, 0, lx, ly, radius);
    grad.addColorStop(0, `rgba(${rgb}, ${peakAlpha.toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(${rgb}, ${(peakAlpha * 0.42).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    octx.fillStyle = grad;
    octx.beginPath();
    octx.arc(lx, ly, radius, 0, Math.PI * 2);
    octx.fill();
  }

  // 2. Luminous core knots
  for (let i = 0; i < 3; i++) {
    const kx = cx + (rng() - 0.5) * 76;
    const ky = cy + (rng() - 0.5) * 56;
    const radius = 34 + rng() * 28;
    const grad = octx.createRadialGradient(kx, ky, 0, kx, ky, radius);
    grad.addColorStop(0, `rgba(${highlightRgb}, 0.14)`);
    grad.addColorStop(0.55, `rgba(${highlightRgb}, 0.045)`);
    grad.addColorStop(1, `rgba(${highlightRgb}, 0)`);
    octx.fillStyle = grad;
    octx.beginPath();
    octx.arc(kx, ky, radius, 0, Math.PI * 2);
    octx.fill();
  }

  // 3. Delicate curved gas filaments
  for (let i = 0; i < 4; i++) {
    const startX = cx + (rng() - 0.5) * 140;
    const startY = cy + (rng() - 0.5) * 90;
    const ctrlX = cx + (rng() - 0.5) * 80;
    const ctrlY = cy + (rng() - 0.5) * 70;
    const endX = cx + (rng() - 0.5) * 150;
    const endY = cy + (rng() - 0.5) * 95;
    octx.strokeStyle = `rgba(${i % 2 === 0 ? highlightRgb : primaryRgb}, 0.075)`;
    octx.lineWidth = 4 + rng() * 7;
    octx.lineCap = "round";
    octx.beginPath();
    octx.moveTo(startX, startY);
    octx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    octx.stroke();
  }

  // 4. Carve subtle dark-dust rifts for natural volumetric contrast
  octx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 3; i++) {
    const dx = cx + (rng() - 0.5) * 110;
    const dy = cy + (rng() - 0.5) * 80;
    const radius = 28 + rng() * 26;
    const cutGrad = octx.createRadialGradient(dx, dy, 0, dx, dy, radius);
    cutGrad.addColorStop(0, "rgba(0, 0, 0, 0.28)");
    cutGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.1)");
    cutGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    octx.fillStyle = cutGrad;
    octx.beginPath();
    octx.arc(dx, dy, radius, 0, Math.PI * 2);
    octx.fill();
  }

  octx.globalCompositeOperation = "source-over";
  return offscreen;
}

export function createParallaxSpaceState(): ParallaxSpaceState {
  const nebulae: NebulaCloud[] = [];
  const starClusters: StarCluster[] = [];
  const stars: ParallaxStar[] = [];

  // Layer 0: Procedural deep-space nebulae
  const nebulaPalettes: [string, string, string][] = [
    ["56, 189, 248", "99, 102, 241", "125, 211, 252"],
    ["129, 140, 248", "56, 189, 248", "245, 158, 11"],
    ["45, 212, 191", "56, 189, 248", "167, 243, 208"],
    ["99, 102, 241", "245, 158, 11", "186, 230, 253"],
    ["56, 189, 248", "45, 212, 191", "224, 242, 254"],
  ];

  for (let i = 0; i < 5; i++) {
    const [primary, secondary, highlight] =
      nebulaPalettes[i % nebulaPalettes.length];
    const sprite = createProceduralNebulaSprite(
      1047 + i * 313,
      primary,
      secondary,
      highlight,
    );
    const scale = 0.95 + (i % 3) * 0.28;
    const drift = 0.0022 + (i % 2) * 0.0012;
    nebulae.push({
      x: (i * 0.23 + 0.11) % 1,
      y: (i * 0.37 + 0.18) % 1,
      vx: -drift * (0.85 + (i % 3) * 0.15),
      vy: drift * 0.42,
      width: 420 * scale,
      height: 320 * scale,
      depth: 0.14 + (i % 3) * 0.045,
      alpha: 0.56 + (i % 2) * 0.14,
      rotation: i * 1.15,
      vRot: (i % 2 === 0 ? 1 : -1) * 0.012,
      pulsePhase: i * 1.3,
      pulseSpeed: 0.28 + i * 0.06,
      sprite,
    });
  }

  // Layer 1: Procedural distant star clusters
  const clusterTints = [
    "226, 232, 240",
    "186, 230, 253",
    "253, 230, 138",
    "199, 210, 254",
  ];
  const clusterGlowColors = ["129, 140, 248", "56, 189, 248", "245, 158, 11"];

  for (let c = 0; c < 6; c++) {
    const rng = createSeededRng(4099 + c * 577);
    const glowRadius = 58 + rng() * 34;
    const starCount = 18 + Math.floor(rng() * 14);
    const clusterStars: ClusterStar[] = [];

    for (let s = 0; s < starCount; s++) {
      const ang = rng() * Math.PI * 2;
      const dist = Math.pow(rng(), 1.65) * glowRadius * 0.95;
      const isAnchor = s < 3;
      clusterStars.push({
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist * (0.68 + rng() * 0.32),
        size: isAnchor ? 1.8 + rng() * 0.9 : 0.8 + rng() * 1.1,
        alpha: isAnchor ? 0.58 + rng() * 0.25 : 0.22 + rng() * 0.38,
        tint: clusterTints[Math.floor(rng() * clusterTints.length)],
        twinklePhase: rng() * Math.PI * 2,
        twinkleSpeed: 0.9 + rng() * 1.6,
        glint: isAnchor && rng() > 0.35,
      });
    }

    const drift = 0.0042 + rng() * 0.0024;
    starClusters.push({
      x: (c * 0.29 + 0.09 + rng() * 0.08) % 1,
      y: (c * 0.41 + 0.14 + rng() * 0.08) % 1,
      vx: -drift,
      vy: drift * 0.38,
      depth: 0.3 + c * 0.025,
      glowRadius,
      glowAlpha: 0.16 + rng() * 0.09,
      glowSprite: createGlowSprite(
        clusterGlowColors[c % clusterGlowColors.length],
      ),
      stars: clusterStars,
    });
  }

  // Layer 2: Multi-tier parallax starfield
  const starTints = [
    "226, 232, 240",
    "226, 232, 240",
    "186, 230, 253",
    "199, 210, 254",
    "253, 230, 138",
  ];
  for (let i = 0; i < 150; i++) {
    const layer: 0 | 1 | 2 = i < 72 ? 0 : i < 126 ? 1 : 2;
    const depth =
      layer === 0
        ? 0.18 + Math.random() * 0.12
        : layer === 1
          ? 0.42 + Math.random() * 0.18
          : 0.76 + Math.random() * 0.2;
    const drift = layer === 0 ? 0.0025 : layer === 1 ? 0.0052 : 0.0092;
    const size =
      layer === 0
        ? 0.8 + Math.random() * 0.8
        : layer === 1
          ? 1.1 + Math.random() * 1.1
          : 1.5 + Math.random() * 1.2;
    const alpha =
      layer === 0
        ? 0.18 + Math.random() * 0.26
        : layer === 1
          ? 0.32 + Math.random() * 0.34
          : 0.52 + Math.random() * 0.34;

    stars.push({
      x: Math.random(),
      y: Math.random(),
      vx: -drift * (0.85 + Math.random() * 0.3),
      vy: drift * (0.34 + Math.random() * 0.2),
      size,
      depth,
      layer,
      alpha,
      tint: starTints[i % starTints.length],
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.7 + Math.random() * 1.9,
      glint: layer === 2 && i % 3 === 0,
    });
  }

  return { nebulae, starClusters, stars };
}

export function updateParallaxSpaceState(
  state: ParallaxSpaceState,
  dt: number,
  reducedMotion: boolean,
): void {
  const step = dt * (reducedMotion ? 0.25 : 1);

  for (const n of state.nebulae) {
    n.x = (n.x + n.vx * step + 1) % 1;
    n.y = (n.y + n.vy * step + 1) % 1;
    n.rotation += n.vRot * step;
    n.pulsePhase += n.pulseSpeed * step;
  }

  for (const c of state.starClusters) {
    c.x = (c.x + c.vx * step + 1) % 1;
    c.y = (c.y + c.vy * step + 1) % 1;
    for (const s of c.stars) {
      s.twinklePhase += s.twinkleSpeed * step;
    }
  }

  for (const s of state.stars) {
    s.x = (s.x + s.vx * step + 1) % 1;
    s.y = (s.y + s.vy * step + 1) % 1;
    s.twinklePhase += s.twinkleSpeed * step;
  }
}

export function renderParallaxSpaceState(
  ctx: CanvasRenderingContext2D,
  state: ParallaxSpaceState,
  w: number,
  h: number,
  px: number,
  py: number,
): void {
  // Layer 0: Slow-moving procedural nebulae
  const nebPad = 240;
  const nebSpanW = w + nebPad * 2;
  const nebSpanH = h + nebPad * 2;
  for (const n of state.nebulae) {
    if (!n.sprite) continue;
    const nx =
      ((((n.x * nebSpanW - px * n.depth) % nebSpanW) + nebSpanW) % nebSpanW) -
      nebPad;
    const ny =
      ((((n.y * nebSpanH - py * n.depth) % nebSpanH) + nebSpanH) % nebSpanH) -
      nebPad;
    const pulse = 0.88 + Math.sin(n.pulsePhase) * 0.12;

    ctx.save();
    ctx.globalAlpha = n.alpha * pulse;
    ctx.translate(nx, ny);
    ctx.rotate(n.rotation);
    ctx.drawImage(n.sprite, -n.width * 0.5, -n.height * 0.5, n.width, n.height);
    ctx.restore();
  }

  // Layer 1: Distant procedural star clusters
  const cluPad = 140;
  const cluSpanW = w + cluPad * 2;
  const cluSpanH = h + cluPad * 2;
  for (const c of state.starClusters) {
    const cx =
      ((((c.x * cluSpanW - px * c.depth) % cluSpanW) + cluSpanW) % cluSpanW) -
      cluPad;
    const cy =
      ((((c.y * cluSpanH - py * c.depth) % cluSpanH) + cluSpanH) % cluSpanH) -
      cluPad;

    if (c.glowSprite) {
      ctx.globalAlpha = c.glowAlpha;
      const diam = c.glowRadius * 2;
      ctx.drawImage(
        c.glowSprite,
        cx - c.glowRadius,
        cy - c.glowRadius,
        diam,
        diam,
      );
    }

    ctx.globalAlpha = 1;
    for (const s of c.stars) {
      const twinkle = 0.72 + Math.sin(s.twinklePhase) * 0.28;
      const sx = cx + s.dx;
      const sy = cy + s.dy;
      ctx.fillStyle = `rgba(${s.tint}, ${(s.alpha * twinkle).toFixed(3)})`;
      ctx.fillRect(sx - s.size * 0.5, sy - s.size * 0.5, s.size, s.size);

      if (s.glint) {
        const arm = s.size * 2.4;
        ctx.fillStyle = `rgba(${s.tint}, ${(s.alpha * twinkle * 0.42).toFixed(3)})`;
        ctx.fillRect(sx - arm, sy - 0.45, arm * 2, 0.9);
        ctx.fillRect(sx - 0.45, sy - arm, 0.9, arm * 2);
      }
    }
  }

  // Layer 2: Multi-tier parallax starfield
  const starPad = 70;
  const starSpanW = w + starPad * 2;
  const starSpanH = h + starPad * 2;
  for (const s of state.stars) {
    const sx =
      ((((s.x * starSpanW - px * s.depth) % starSpanW) + starSpanW) %
        starSpanW) -
      starPad;
    const sy =
      ((((s.y * starSpanH - py * s.depth) % starSpanH) + starSpanH) %
        starSpanH) -
      starPad;
    const twinkle = 0.78 + Math.sin(s.twinklePhase) * 0.22;
    const a = (s.alpha * twinkle).toFixed(3);

    ctx.fillStyle = `rgba(${s.tint}, ${a})`;
    ctx.fillRect(sx - s.size * 0.5, sy - s.size * 0.5, s.size, s.size);

    if (s.glint) {
      const arm = s.size * 2.2;
      ctx.fillStyle = `rgba(${s.tint}, ${(s.alpha * twinkle * 0.35).toFixed(3)})`;
      ctx.fillRect(sx - arm, sy - 0.5, arm * 2, 1);
      ctx.fillRect(sx - 0.5, sy - arm, 1, arm * 2);
    }
  }

  ctx.globalAlpha = 1;
}
