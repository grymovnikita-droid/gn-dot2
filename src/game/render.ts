import type { Team, Unit, Vec } from "./types";
import { CAMPS, LANES, RADIANT_BASE, DIRE_BASE, SHORTCUTS, TEAM_COLOR, WORLD, heroById } from "./data";
import type { GameEngine } from "./engine";
import { getSprite, TERRAIN_KEY } from "./assets";
import type { SpriteSource } from "./assets";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEAM_TINT: Record<Team, string> = { radiant: "#8fe8b0", dire: "#f0a0a0" };

function d2p(p: Vec, pts: Vec[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
    if (d < best) best = d;
  }
  return best;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cv: HTMLCanvasElement;
  private terrain: HTMLCanvasElement;
  viewW = 0;
  viewH = 0;
  targeting: { kind: "point" | "target"; radius: number; range: number } | null = null;
  tpMode = false;
  mouseWorld: Vec = { x: 0, y: 0 };

  constructor(private engine: GameEngine, canvas: HTMLCanvasElement) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.terrain = this.bakeTerrain();
  }

  resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.cv.width = this.viewW * dpr;
    this.cv.height = this.viewH * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  screenToWorld(sx: number, sy: number): Vec {
    const z = this.engine.zoom;
    return {
      x: (sx - this.viewW / 2) / z + this.engine.camera.x,
      y: (sy - this.viewH / 2) / z + this.engine.camera.y,
    };
  }

  // ---------- ландшафт ----------

  private bakeTerrain(): HTMLCanvasElement {
    const S = 1024;
    const cv = document.createElement("canvas");
    cv.width = S;
    cv.height = S;
    const g = cv.getContext("2d")!;
    g.scale(S / WORLD, S / WORLD);
    const rng = mulberry32(1337);

    const custom = getSprite(TERRAIN_KEY);
    if (custom) {
      try {
        g.imageSmoothingEnabled = true;
        g.drawImage(custom as CanvasImageSource, 0, 0, WORLD, WORLD);
        this.bakeOverlays(g);
        return cv;
      } catch {
        // битая картинка — рисуем стандартный ландшафт
      }
    }

    const lg = g.createLinearGradient(0, WORLD, WORLD, 0);
    lg.addColorStop(0, "#3d6b3f");
    lg.addColorStop(0.38, "#35523a");
    lg.addColorStop(0.62, "#4a3f38");
    lg.addColorStop(1, "#4a3232");
    g.fillStyle = lg;
    g.fillRect(0, 0, WORLD, WORLD);

    for (let i = 0; i < 420; i++) {
      const x = rng() * WORLD;
      const y = rng() * WORLD;
      const r = 60 + rng() * 240;
      const light = y > x;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, light ? "rgba(255,240,190,0.05)" : "rgba(0,0,0,0.07)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    // река
    const river = (w: number, c: string) => {
      g.strokeStyle = c;
      g.lineWidth = w;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-100, -100);
      g.lineTo(WORLD + 100, WORLD + 100);
      g.stroke();
    };
    river(210, "rgba(23,42,48,0.9)");
    river(150, "#24444e");
    river(104, "#2c5460");
    river(40, "rgba(96,150,160,0.5)");
    for (let i = 0; i < 120; i++) {
      const t = rng() * WORLD;
      const off = (rng() - 0.5) * 90;
      const x = t + off * 0.7071;
      const y = t - off * 0.7071;
      g.fillStyle = "rgba(150,200,205,0.14)";
      g.fillRect(x, y, 8 + rng() * 22, 3);
    }

    // кирпичные линии
    for (const pts of LANES) this.brickLane(g, pts, 118);
    for (const pts of SHORTCUTS) this.dirtTrail(g, pts);

    // площадки баз
    for (const [b, light] of [
      [RADIANT_BASE, true],
      [DIRE_BASE, false],
    ] as [Vec, boolean][]) {
      const rg = g.createRadialGradient(b.x, b.y, 60, b.x, b.y, 560);
      rg.addColorStop(0, light ? "#4c4f42" : "#47403c");
      rg.addColorStop(0.75, light ? "#41463a" : "#3c3531");
      rg.addColorStop(1, "rgba(40,40,34,0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(b.x, b.y, 560, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = light ? "rgba(87,217,138,0.28)" : "rgba(224,82,82,0.28)";
      g.lineWidth = 5;
      g.beginPath();
      g.arc(b.x, b.y, 470, 0, Math.PI * 2);
      g.stroke();
    }

    // поляны нейтралов с подсветкой и декором
    for (let i = 0; i < CAMPS.length; i++) {
      const c = CAMPS[i];
      const rg = g.createRadialGradient(c.x, c.y, 30, c.x, c.y, 175);
      rg.addColorStop(0, "rgba(120,105,70,0.4)");
      rg.addColorStop(1, "rgba(120,105,70,0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(c.x, c.y, 175, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(212,168,63,0.22)";
      g.lineWidth = 4;
      g.setLineDash([18, 14]);
      g.beginPath();
      g.arc(c.x, c.y, 165, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      if (c.kind === "wolves") {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + 0.3;
          const rr = 128 + rng() * 30;
          const x = c.x + Math.cos(a) * rr;
          const y = c.y + Math.sin(a) * rr;
          const r = 24 + rng() * 14;
          g.fillStyle = "rgba(8,14,10,0.4)";
          g.beginPath();
          g.arc(x + 5, y + 7, r, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#1e4028";
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "rgba(110,170,110,0.2)";
          g.beginPath();
          g.arc(x - r * 0.3, y - r * 0.35, r * 0.5, 0, Math.PI * 2);
          g.fill();
        }
      } else if (c.kind === "bears") {
        g.strokeStyle = "rgba(90,82,70,0.85)";
        g.lineWidth = 14;
        g.beginPath();
        g.arc(c.x - 55, c.y - 40, 46, 0.6, 2.6);
        g.stroke();
        g.lineWidth = 10;
        g.beginPath();
        g.arc(c.x + 60, c.y + 30, 34, 3.4, 5.2);
        g.stroke();
        g.fillStyle = "rgba(80,72,60,0.9)";
        g.fillRect(c.x + 30, c.y - 60, 26, 12);
        g.fillRect(c.x - 70, c.y + 34, 20, 10);
        g.beginPath();
        g.arc(c.x + 8, c.y + 55, 12, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = "rgba(70,64,58,0.9)";
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          const x = c.x + Math.cos(a) * 105;
          const y = c.y + Math.sin(a) * 105;
          g.beginPath();
          g.arc(x, y, 16 + rng() * 10, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "rgba(110,100,90,0.7)";
        g.beginPath();
        g.arc(c.x, c.y, 20, 0, Math.PI * 2);
        g.fill();
      }
    }

    // густой лес
    for (let i = 0; i < 1500; i++) {
      const x = rng() * WORLD;
      const y = rng() * WORLD;
      let ok = Math.abs(y - x) > 190;
      if (ok) for (const pts of LANES) if (d2p({ x, y }, pts) < 175) ok = false;
      if (ok) for (const pts of SHORTCUTS) if (d2p({ x, y }, pts) < 95) ok = false;
      if (ok && Math.hypot(x - RADIANT_BASE.x, y - RADIANT_BASE.y) < 620) ok = false;
      if (ok && Math.hypot(x - DIRE_BASE.x, y - DIRE_BASE.y) < 620) ok = false;
      for (const c of CAMPS) if (ok && Math.hypot(x - c.x, y - c.y) < 240) ok = false;
      if (!ok) continue;
      const dire = y < x;
      const r = 22 + rng() * 30;
      g.fillStyle = "rgba(8,14,10,0.35)";
      g.beginPath();
      g.arc(x + 6, y + 8, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dire ? "#2b2322" : "#1c3a24";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dire ? "rgba(120,90,80,0.16)" : "rgba(110,170,110,0.18)";
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.35, r * 0.55, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = 0; i < 60; i++) {
      const x = rng() * WORLD;
      const y = rng() * WORLD * (x / WORLD);
      g.fillStyle = "rgba(90,82,80,0.5)";
      g.beginPath();
      g.arc(x, y, 8 + rng() * 18, 0, Math.PI * 2);
      g.fill();
    }

    g.globalAlpha = 0.05;
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rng() > 0.5 ? "#ffffff" : "#000000";
      g.fillRect(rng() * WORLD, rng() * WORLD, 3, 3);
    }
    g.globalAlpha = 1;
    return cv;
  }

  private brickLane(g: CanvasRenderingContext2D, pts: Vec[], width: number) {
    g.lineCap = "round";
    g.lineJoin = "round";
    const stroke = (w: number, c: string) => {
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokeStyle = c;
      g.lineWidth = w;
      g.stroke();
    };
    stroke(width + 22, "#241d12");
    stroke(width, "#3b3122");

    const segs: { x: number; y: number; a: number }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const n = Math.ceil(len / 34);
      for (let k = 0; k < n; k++) {
        segs.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n, a: ang });
      }
    }
    const bricks: { x: number; y: number; a: number; col: string }[] = [];
    const rng = mulberry32(777);
    const palette = ["#57492f", "#615134", "#4d4129", "#6a583a", "#5c4d31"];
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      const nx = Math.cos(seg.a + Math.PI / 2);
      const ny = Math.sin(seg.a + Math.PI / 2);
      const rows = 3;
      const rowH = width / rows;
      const off = (s % 2) * 17;
      for (let r = 0; r < rows; r++) {
        const cx = seg.x + nx * ((r - (rows - 1) / 2) * rowH);
        const cy = seg.y + ny * ((r - (rows - 1) / 2) * rowH);
        bricks.push({ x: cx, y: cy, a: seg.a + off * 0.001, col: palette[Math.floor(rng() * palette.length)] });
      }
    }
    const buckets = new Map<string, { x: number; y: number; a: number }[]>();
    for (const b of bricks) {
      const arr = buckets.get(b.col) ?? [];
      arr.push(b);
      buckets.set(b.col, arr);
    }
    buckets.forEach((arr, col) => {
      g.fillStyle = col;
      g.beginPath();
      for (const b of arr) {
        const ca = Math.cos(b.a);
        const sa = Math.sin(b.a);
        const hw = 16;
        const hh = width / 6 - 2;
        g.moveTo(b.x + ca * hw - sa * hh, b.y + sa * hw + ca * hh);
        g.lineTo(b.x - ca * hw - sa * hh, b.y - sa * hw + ca * hh);
        g.lineTo(b.x - ca * hw + sa * hh, b.y - sa * hw - ca * hh);
        g.lineTo(b.x + ca * hw + sa * hh, b.y + sa * hw - ca * hh);
        g.closePath();
      }
      g.fill();
    });

    stroke(width * 0.16, "rgba(20,15,8,0.5)");
    for (let i = 0; i < segs.length; i += 2) {
      if (rng() < 0.3) {
        const s = segs[i];
        g.fillStyle = "rgba(30,24,14,0.4)";
        g.beginPath();
        g.ellipse(s.x, s.y, 12 + rng() * 10, 5 + rng() * 4, s.a, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  private dirtTrail(g: CanvasRenderingContext2D, pts: Vec[]) {
    g.lineCap = "round";
    g.lineJoin = "round";
    const stroke = (w: number, c: string) => {
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokeStyle = c;
      g.lineWidth = w;
      g.stroke();
    };
    stroke(66, "rgba(43,36,23,0.8)");
    stroke(44, "rgba(96,82,54,0.55)");
    stroke(18, "rgba(130,112,74,0.3)");
  }

  private bakeOverlays(g: CanvasRenderingContext2D) {
    for (const pts of LANES) {
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.strokeStyle = "rgba(40,32,20,0.55)";
      g.lineWidth = 118;
      g.stroke();
      g.strokeStyle = "rgba(120,104,70,0.4)";
      g.lineWidth = 50;
      g.stroke();
    }
    for (const [b, light] of [
      [RADIANT_BASE, true],
      [DIRE_BASE, false],
    ] as [Vec, boolean][]) {
      const rg = g.createRadialGradient(b.x, b.y, 60, b.x, b.y, 560);
      rg.addColorStop(0, light ? "rgba(76,79,66,0.8)" : "rgba(71,64,60,0.8)");
      rg.addColorStop(1, "rgba(40,40,34,0)");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(b.x, b.y, 560, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = light ? "rgba(87,217,138,0.3)" : "rgba(224,82,82,0.3)";
      g.lineWidth = 5;
      g.beginPath();
      g.arc(b.x, b.y, 470, 0, Math.PI * 2);
      g.stroke();
    }
    for (const c of CAMPS) {
      g.fillStyle = "rgba(74,66,50,0.4)";
      g.beginPath();
      g.arc(c.x, c.y, 150, 0, Math.PI * 2);
      g.fill();
    }
  }

  rebakeTerrain() {
    this.terrain = this.bakeTerrain();
  }

  // ---------- спрайты ----------

  private spriteKey(u: Unit): string | null {
    if (u.kind === "hero") return `hero:${u.hero}`;
    if (u.kind === "melee") return `melee:${u.team}`;
    if (u.kind === "ranged") return `ranged:${u.team}`;
    if (u.kind === "siege") return `siege:${u.team}`;
    if (u.kind === "neutral") {
      const camp = CAMPS[Math.max(0, u.camp)] ?? CAMPS[0];
      return `neutral:${camp ? camp.kind.slice(0, -1) : "wolf"}`;
    }
    if (u.kind === "tower" || u.kind === "ancient") return `${u.kind}:${u.team}`;
    return null;
  }

  private spriteFor(u: Unit): SpriteSource | null {
    const key = this.spriteKey(u);
    if (!key) return null;
    let s = getSprite(key);
    if (s) return s;
    const base = key.split(":")[0];
    const team = key.includes("dire") ? "dire" : "radiant";
    let src: SpriteSource | null = null;
    if (base === "melee") src = this.teamSprite("melee", team);
    else if (base === "ranged") src = this.teamSprite("ranged", team);
    else if (base === "siege") src = this.teamSprite("siege", team);
    else if (base === "neutral") src = getSprite(`neutral:${key.split(":")[1]}`);
    else if (base === "tower") src = this.teamSprite("tower", team);
    else if (base === "ancient") src = this.teamSprite("ancient", team);
    return src;
  }

  private teamCache = new Map<string, SpriteSource>();
  private teamSprite(kind: string, team: Team): SpriteSource | null {
    const ck = `${kind}:${team}`;
    if (this.teamCache.has(ck)) return this.teamCache.get(ck)!;
    const base = getSprite(kind);
    if (!base) return null;
    const size = (base as HTMLCanvasElement).width || 64;
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const g = cv.getContext("2d")!;
    g.drawImage(base as CanvasImageSource, 0, 0);
    if (team === "dire") {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(224,82,82,0.38)";
      g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = "source-over";
    } else {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(87,217,138,0.16)";
      g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = "source-over";
    }
    this.teamCache.set(ck, cv);
    return cv;
  }

  private drawSprite(u: Unit, src: SpriteSource, size: number, withShadow: boolean) {
    const ctx = this.ctx;
    const p = u.pos;
    if (withShadow) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + u.radius * 0.75, u.radius * 0.9, u.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.hitFlash > 0) {
      ctx.save();
      ctx.filter = "brightness(2.2)";
      ctx.drawImage(src as CanvasImageSource, p.x - size / 2, p.y - size / 2 - u.radius * 0.4, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(src as CanvasImageSource, p.x - size / 2, p.y - size / 2 - u.radius * 0.4, size, size);
    }
  }

  // ---------- отрисовка ----------

  draw() {
    const e = this.engine;
    const ctx = this.ctx;
    const { viewW: vw, viewH: vh } = this;
    if (vw === 0) return;
    const zoom = e.zoom;
    const shx = e.shake > 0 ? (Math.random() - 0.5) * e.shake : 0;
    const shy = e.shake > 0 ? (Math.random() - 0.5) * e.shake : 0;

    ctx.fillStyle = "#0b100d";
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-e.camera.x + shx, -e.camera.y + shy);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrain, 0, 0, WORLD, WORLD);

    const halfW = vw / 2 / zoom + 200;
    const halfH = vh / 2 / zoom + 200;
    const inView = (p: Vec, m = 0) =>
      Math.abs(p.x - e.camera.x) < halfW + m && Math.abs(p.y - e.camera.y) < halfH + m;

    // индикатор каста
    if (this.targeting && !e.player.dead) {
      const p = e.player.pos;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.targeting.range > 0 ? this.targeting.range : this.targeting.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240,210,122,0.05)";
      ctx.fill();
      ctx.strokeStyle = "rgba(240,210,122,0.4)";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([14, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.targeting.kind === "point") {
        ctx.beginPath();
        ctx.arc(this.mouseWorld.x, this.mouseWorld.y, this.targeting.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(240,120,90,0.10)";
        ctx.fill();
        ctx.strokeStyle = "rgba(240,160,90,0.75)";
        ctx.lineWidth = 2.5 / zoom;
        ctx.stroke();
      }
    }

    // цели телепорта
    if (this.tpMode && !e.player.dead) {
      const hovered = e.pickStructureAt(this.mouseWorld, e.player.team);
      for (const u of e.units) {
        if (u.team !== e.player.team || u.dead) continue;
        if (u.kind !== "tower" && u.kind !== "ancient") continue;
        const isHov = hovered?.id === u.id;
        const rr = u.radius + (isHov ? 26 : 14);
        ctx.beginPath();
        ctx.arc(u.pos.x, u.pos.y, rr, 0, Math.PI * 2);
        if (isHov) {
          ctx.fillStyle = "rgba(201,160,240,0.18)";
          ctx.fill();
        }
        ctx.strokeStyle = isHov ? "#e0c8ff" : "rgba(201,160,240,0.65)";
        ctx.lineWidth = (isHov ? 4 : 2.5) / zoom;
        ctx.setLineDash([16, 10]);
        ctx.lineDashOffset = -e.time * 30;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    }

    // маркер движения
    const pm = e.player.moveTarget;
    if (pm && !e.player.dead) {
      const pulse = 1 + Math.sin(e.time * 8) * 0.12;
      ctx.save();
      ctx.translate(pm.x, pm.y);
      ctx.rotate(e.time * 2);
      ctx.strokeStyle = "rgba(240,210,122,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.moveTo(Math.cos(a) * 16 * pulse, Math.sin(a) * 16 * pulse);
        ctx.lineTo(Math.cos(a) * 24 * pulse, Math.sin(a) * 24 * pulse);
      }
      ctx.stroke();
      ctx.rotate(-e.time * 2);
      ctx.strokeStyle = "rgba(240,210,122,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // кольцо на цели атаки
    const at = e.player.attackTargetId != null ? e.units.find((u) => u.id === e.player.attackTargetId) : undefined;
    if (at && !at.dead && at.team !== e.player.team) {
      ctx.strokeStyle = "rgba(224,82,82,0.9)";
      ctx.lineWidth = 2.5 / zoom;
      ctx.beginPath();
      ctx.arc(at.pos.x, at.pos.y, at.radius + 9 + Math.sin(e.time * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // кольцо канала телепорта
    if (e.playerChannel && !e.player.dead) {
      const prog = 1 - e.playerChannel.t / e.playerChannel.dur;
      const p = e.player.pos;
      ctx.strokeStyle = "rgba(201,160,240,0.35)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#e0c8ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.stroke();
    }

    // юниты по y
    const list = e.units.filter((u) => inView(u.pos, 200)).sort((a, b) => a.pos.y - b.pos.y);
    for (const u of list) this.drawUnit(u);

    // снаряды
    for (const p of e.projectiles) {
      if (!inView(p.pos, 60)) continue;
      const r = p.kind === "attack" ? 5 : p.kind === "heal" ? 7 : 8;
      const rg = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, r * 2.6);
      rg.addColorStop(0, "#ffffff");
      rg.addColorStop(0.35, p.tint);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // эффекты
    for (const f of e.effects) {
      if (!inView(f, 100)) continue;
      const k = Math.max(0, f.ttl / f.maxTtl);
      if (f.kind === "text") {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.font = `800 ${f.size}px Manrope, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.strokeText(f.text ?? "", f.x, f.y);
        ctx.fillStyle = f.tint;
        ctx.fillText(f.text ?? "", f.x, f.y);
        ctx.globalAlpha = 1;
      } else if (f.kind === "ring") {
        const prog = 1 - k;
        const radius = f.size * (0.2 + prog * 0.8);
        // Внешнее свечение
        ctx.globalAlpha = k * 0.4;
        ctx.strokeStyle = f.tint;
        ctx.lineWidth = 8 + k * 6;
        ctx.beginPath();
        ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        // Основное кольцо
        ctx.globalAlpha = k * 0.9;
        ctx.lineWidth = 3 + k * 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        // Внутреннее яркое кольцо
        ctx.globalAlpha = k * 0.6;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, radius * 0.95, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.kind === "spark") {
        ctx.globalAlpha = k;
        // Свечение вокруг частицы
        const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 2);
        glow.addColorStop(0, f.tint);
        glow.addColorStop(0.4, f.tint + "88");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 2, 0, Math.PI * 2);
        ctx.fill();
        // Ядро частицы
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = k;
        ctx.strokeStyle = f.tint;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.x - f.size / 2, f.y + f.size / 3);
        ctx.lineTo(f.x + f.size / 2, f.y - f.size / 3);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    this.drawAnnouncement();
    this.drawMinimap();
  }

  private bar(u: Unit, yOff: number, w: number, h: number, frac: number, tint: string) {
    const ctx = this.ctx;
    const x = u.pos.x - w / 2;
    const y = u.pos.y + yOff;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "#241f18";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  private lighten(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.35));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  private darken(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const f = (v: number) => Math.round(v * 0.55);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  private drawUnit(u: Unit) {
    const ctx = this.ctx;
    const p = u.pos;
    const team = u.team;
    const tc = TEAM_TINT[team];
    const flash = u.hitFlash > 0;
    const e = this.engine;

    if (u.kind === "fountain") {
      const pulse = 0.9 + Math.sin(e.time * 2 + p.x) * 0.1;
      const rg = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 130 * pulse);
      rg.addColorStop(0, team === "radiant" ? "rgba(120,240,170,0.35)" : "rgba(240,120,120,0.35)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 130 * pulse, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (u.dead) {
      if (u.kind === "hero") {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#3a3a3a";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, u.radius, u.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#5a5a5a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 8, p.y - 6);
        ctx.lineTo(p.x + 8, p.y + 6);
        ctx.moveTo(p.x + 8, p.y - 6);
        ctx.lineTo(p.x - 8, p.y + 6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      return;
    }

    if (u.kind === "ancient") {
      const pulse = 1 + Math.sin(e.time * 2.2) * 0.04;
      const rg = ctx.createRadialGradient(p.x, p.y, 20, p.x, p.y, 150);
      rg.addColorStop(0, team === "radiant" ? "rgba(87,217,138,0.35)" : "rgba(224,82,82,0.35)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 150, 0, Math.PI * 2);
      ctx.fill();
      const aspr = this.spriteFor(u);
      if (aspr) {
        this.drawSprite(u, aspr, 132 * pulse, false);
        ctx.strokeStyle = tc;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 56 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        const s = 52 * pulse;
        ctx.fillStyle = flash ? "#ffffff" : team === "radiant" ? "#2f7a4e" : "#7a2f2f";
        ctx.strokeStyle = tc;
        ctx.lineWidth = 4;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = tc;
        const s2 = s * 0.5;
        ctx.fillRect(-s2 / 2, -s2 / 2, s2, s2);
        ctx.restore();
      }
      this.bar(u, -86, 110, 8, u.hp / u.maxHp, tc);
      ctx.font = "16px 'Russo One', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = tc;
      ctx.fillText("ДРЕВНИЙ ТРОН", p.x, p.y - 96);
      return;
    }

    if (u.kind === "tower") {
      const tspr = this.spriteFor(u);
      if (tspr) {
        this.drawSprite(u, tspr, u.radius * 2.8, false);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + u.radius * 0.6, u.radius, u.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flash ? "#ffffff" : team === "radiant" ? "#3f5a46" : "#5a3f3f";
        ctx.strokeStyle = tc;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - u.radius * 0.8, p.y + u.radius * 0.6);
        ctx.lineTo(p.x - u.radius * 0.45, p.y - u.radius);
        ctx.lineTo(p.x + u.radius * 0.45, p.y - u.radius);
        ctx.lineTo(p.x + u.radius * 0.8, p.y + u.radius * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const glow = 0.6 + Math.sin(e.time * 3) * 0.3;
        ctx.fillStyle = tc;
        ctx.globalAlpha = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y - u.radius * 0.35, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      this.bar(u, -u.radius - 22, 56, 6, u.hp / u.maxHp, tc);
      ctx.font = "14px 'Russo One', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(240,225,180,0.95)";
      ctx.fillText(["", "I", "II", "III", "IV"][u.tier] ?? "", p.x, p.y + 5);
      return;
    }

    if (u.kind === "hero") {
      const def = heroById(u.hero ?? "akasha");
      if (e.selectedId === u.id) {
        ctx.strokeStyle = "rgba(240,210,122,0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -e.time * 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, u.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
      if (u.buffs.length > 0) {
        ctx.strokeStyle = u.buffs[0].tint;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, u.radius + 5 + Math.sin(e.time * 6) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const hspr = this.spriteFor(u);
      if (hspr) {
        this.drawSprite(u, hspr, u.radius * 2.4, true);
        ctx.strokeStyle = tc;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, u.radius * 1.12, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const rg = ctx.createRadialGradient(p.x - 6, p.y - 8, 3, p.x, p.y, u.radius + 2);
        rg.addColorStop(0, flash ? "#ffffff" : this.lighten(def.color));
        rg.addColorStop(1, flash ? "#ffffff" : this.darken(def.color));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = tc;
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.font = "800 17px Manrope, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(8,12,9,0.9)";
        ctx.fillText(def.name[0], p.x, p.y + 1);
        ctx.textBaseline = "alphabetic";
      }
      this.bar(u, -u.radius - 16, 52, 6, u.hp / u.maxHp, tc);
      this.bar(u, -u.radius - 8, 52, 4, u.mana / u.maxMana, "#5b8fd9");
      ctx.font = "700 13px Manrope, sans-serif";
      ctx.fillStyle = "rgba(240,235,215,0.95)";
      ctx.fillText(String(u.level), p.x + 34, p.y - u.radius - 10);
      return;
    }

    if (u.kind === "neutral") {
      const nspr = this.spriteFor(u);
      if (nspr) {
        this.drawSprite(u, nspr, u.radius * 2.4, true);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + u.radius * 0.7, u.radius, u.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flash ? "#ffffff" : u.radius > 20 ? "#6e7480" : "#8a7a60";
        ctx.beginPath();
        ctx.arc(p.x, p.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(30,26,20,0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffd27a";
        ctx.beginPath();
        ctx.arc(p.x - u.radius * 0.3, p.y - u.radius * 0.2, 2.2, 0, Math.PI * 2);
        ctx.arc(p.x + u.radius * 0.3, p.y - u.radius * 0.2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      this.bar(u, -u.radius - 12, 40, 5, u.hp / u.maxHp, "#c9b878");
      return;
    }

    // крипы
    const cspr = this.spriteFor(u);
    if (cspr) {
      this.drawSprite(u, cspr, u.radius * 2.3, true);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + u.radius * 0.7, u.radius * 0.9, u.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      const base = team === "radiant" ? "#5f9e6b" : "#9e5f5f";
      ctx.fillStyle = flash ? "#ffffff" : u.kind === "siege" ? (team === "radiant" ? "#4f8a5c" : "#8a4f4f") : base;
      if (u.kind === "siege") {
        ctx.fillRect(p.x - u.radius, p.y - u.radius * 0.8, u.radius * 2, u.radius * 1.5);
        ctx.fillStyle = "#3a3f2f";
        ctx.beginPath();
        ctx.arc(p.x - u.radius * 0.55, p.y + u.radius * 0.7, u.radius * 0.4, 0, Math.PI * 2);
        ctx.arc(p.x + u.radius * 0.55, p.y + u.radius * 0.7, u.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c9b878";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - u.radius * 0.4, p.y - u.radius * 0.6);
        ctx.lineTo(p.x + u.radius * 0.9, p.y - u.radius * 1.5);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(20,26,20,0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (u.kind === "ranged") {
          ctx.strokeStyle = "#c9b878";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x + u.radius * 0.5, p.y, u.radius * 0.75, -1.2, 1.2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = "#d9d9e8";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(p.x + u.radius * 0.4, p.y + u.radius * 0.2);
          ctx.lineTo(p.x + u.radius * 1.2, p.y - u.radius * 0.7);
          ctx.stroke();
        }
      }
    }
    this.bar(u, -u.radius - 11, 30, 4, u.hp / u.maxHp, tc);
  }

  private drawAnnouncement() {
    const a = this.engine.announcement;
    if (!a) return;
    const ctx = this.ctx;
    const k = Math.min(1, a.ttl / 0.4, (a.maxTtl - a.ttl) / 0.3 + 0.001);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    ctx.textAlign = "center";
    ctx.font = "50px 'Russo One', sans-serif";
    const y = this.viewH * 0.24;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(a.text, this.viewW / 2, y);
    ctx.fillStyle = a.tint;
    ctx.shadowColor = a.tint;
    ctx.shadowBlur = 30;
    ctx.fillText(a.text, this.viewW / 2, y);
    ctx.shadowBlur = 0;
    if (a.sub) {
      ctx.font = "700 18px Manrope, sans-serif";
      ctx.lineWidth = 5;
      ctx.strokeText(a.sub, this.viewW / 2, y + 34);
      ctx.fillStyle = "#e8e4d8";
      ctx.fillText(a.sub, this.viewW / 2, y + 34);
    }
    ctx.restore();
  }

  private drawMinimap() {
    const e = this.engine;
    const ctx = this.ctx;
    const size = Math.min(210, this.viewW * 0.18);
    const x = 14;
    const y = this.viewH - size - 14;
    const k = size / WORLD;

    ctx.fillStyle = "rgba(8,12,9,0.92)";
    ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
    ctx.strokeStyle = "rgba(212,168,63,0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 4, y - 4, size + 8, size + 8);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.drawImage(this.terrain, x, y, size, size);

    ctx.strokeStyle = "rgba(150,132,92,0.7)";
    ctx.lineWidth = 2;
    for (const pts of LANES) {
      ctx.beginPath();
      ctx.moveTo(x + pts[0].x * k, y + pts[0].y * k);
      for (let i = 1; i < pts.length; i += 2) ctx.lineTo(x + pts[i].x * k, y + pts[i].y * k);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(120,105,70,0.45)";
    ctx.lineWidth = 1;
    for (const pts of SHORTCUTS) {
      ctx.beginPath();
      ctx.moveTo(x + pts[0].x * k, y + pts[0].y * k);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(x + pts[i].x * k, y + pts[i].y * k);
      ctx.stroke();
    }
    for (let i = 0; i < CAMPS.length; i++) {
      const c = CAMPS[i];
      ctx.fillStyle = e.campAlive[i] ? "rgba(200,175,110,0.85)" : "rgba(200,175,110,0.25)";
      ctx.beginPath();
      ctx.arc(x + c.x * k, y + c.y * k, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const u of e.units) {
      if (u.dead || u.kind === "fountain") continue;
      const ux = x + u.pos.x * k;
      const uy = y + u.pos.y * k;
      if (u.kind === "tower") {
        ctx.fillStyle = TEAM_COLOR[u.team];
        ctx.fillRect(ux - 2.5, uy - 2.5, 5, 5);
      } else if (u.kind === "ancient") {
        ctx.fillStyle = TEAM_COLOR[u.team];
        ctx.save();
        ctx.translate(ux, uy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      } else if (u.kind === "hero") {
        ctx.fillStyle = u.isPlayer ? "#f0d27a" : TEAM_COLOR[u.team];
        ctx.beginPath();
        ctx.arc(ux, uy, u.isPlayer ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (u.isPlayer) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      } else if (u.kind === "neutral") {
        ctx.fillStyle = "#c9b878";
        ctx.fillRect(ux - 1.5, uy - 1.5, 3, 3);
      } else {
        ctx.fillStyle = TEAM_COLOR[u.team];
        ctx.globalAlpha = 0.8;
        ctx.fillRect(ux - 1.5, uy - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }
    }

    // рамка камеры
    const zw = this.viewW / e.zoom;
    const zh = this.viewH / e.zoom;
    ctx.strokeStyle = "rgba(240,240,240,0.75)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + (e.camera.x - zw / 2) * k, y + (e.camera.y - zh / 2) * k, zw * k, zh * k);
    ctx.restore();
  }
}
