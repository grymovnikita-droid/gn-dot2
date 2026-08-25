// Процедурные спрайты "пакета Древнего Разлома" — рисуются на canvas один раз.

function mk(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  return [cv, cv.getContext("2d")!];
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export function paintMelee(team: "radiant" | "dire"): HTMLCanvasElement {
  const [cv, g] = mk(64);
  const main = team === "radiant" ? "#4f8a5c" : "#8a4f4f";
  const trim = team === "radiant" ? "#8fd98a" : "#e08a8a";
  circle(g, 32, 44, 16, "rgba(0,0,0,0.4)");
  circle(g, 32, 34, 17, shade(main, 0.7));
  circle(g, 32, 30, 14, main);
  g.fillStyle = shade(main, 1.25);
  g.fillRect(24, 20, 16, 5);
  circle(g, 27, 30, 2.6, "#ffd27a");
  circle(g, 37, 30, 2.6, "#ffd27a");
  g.strokeStyle = "#c9c9d4";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(46, 40);
  g.lineTo(56, 22);
  g.stroke();
  g.strokeStyle = trim;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(44, 42);
  g.lineTo(50, 44);
  g.stroke();
  return cv;
}

export function paintRanged(team: "radiant" | "dire"): HTMLCanvasElement {
  const [cv, g] = mk(64);
  const main = team === "radiant" ? "#5c7a8a" : "#7a5c8a";
  const trim = team === "radiant" ? "#8fd9e8" : "#c98ae8";
  circle(g, 32, 44, 14, "rgba(0,0,0,0.4)");
  circle(g, 32, 32, 13, shade(main, 0.75));
  g.fillStyle = main;
  g.beginPath();
  g.moveTo(32, 10);
  g.lineTo(44, 34);
  g.lineTo(20, 34);
  g.closePath();
  g.fill();
  circle(g, 32, 38, 9, main);
  circle(g, 32, 37, 3.4, trim);
  g.strokeStyle = "#b89a6b";
  g.lineWidth = 3.4;
  g.beginPath();
  g.arc(46, 32, 12, -1.1, 1.1);
  g.stroke();
  return cv;
}

export function paintCatapult(team: "radiant" | "dire"): HTMLCanvasElement {
  const [cv, g] = mk(80);
  const wood = "#7a5c3a";
  const metal = team === "radiant" ? "#57d98a" : "#e05252";
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.beginPath();
  g.ellipse(40, 62, 30, 9, 0, 0, Math.PI * 2);
  g.fill();
  circle(g, 22, 56, 10, "#3a2f22");
  circle(g, 54, 56, 10, "#3a2f22");
  circle(g, 22, 56, 5, "#6b5a42");
  circle(g, 54, 56, 5, "#6b5a42");
  g.fillStyle = wood;
  g.fillRect(14, 40, 50, 10);
  g.strokeStyle = shade(wood, 1.3);
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(28, 44);
  g.lineTo(62, 12);
  g.stroke();
  circle(g, 62, 12, 6, "#4a4038");
  g.fillStyle = metal;
  g.fillRect(18, 34, 22, 8);
  circle(g, 20, 30, 5, "#4a4038");
  return cv;
}

export function paintNeutral(kind: "wolf" | "bear" | "golem"): HTMLCanvasElement {
  const [cv, g] = mk(64);
  circle(g, 32, 46, 17, "rgba(0,0,0,0.4)");
  if (kind === "wolf") {
    g.fillStyle = "#6b6b78";
    g.beginPath();
    g.ellipse(32, 38, 17, 12, 0, 0, Math.PI * 2);
    g.fill();
    circle(g, 32, 26, 10, "#7a7a8a");
    g.beginPath();
    g.moveTo(24, 20);
    g.lineTo(27, 10);
    g.lineTo(31, 19);
    g.moveTo(40, 20);
    g.lineTo(37, 10);
    g.lineTo(33, 19);
    g.fillStyle = "#7a7a8a";
    g.fill();
    circle(g, 28, 26, 2.2, "#ffd27a");
    circle(g, 36, 26, 2.2, "#ffd27a");
    g.fillStyle = "#5a5a68";
    g.beginPath();
    g.moveTo(32, 30);
    g.lineTo(29, 34);
    g.lineTo(35, 34);
    g.closePath();
    g.fill();
  } else if (kind === "bear") {
    g.fillStyle = "#6b4a32";
    g.beginPath();
    g.ellipse(32, 38, 19, 15, 0, 0, Math.PI * 2);
    g.fill();
    circle(g, 21, 20, 6, "#5a3d28");
    circle(g, 43, 20, 6, "#5a3d28");
    circle(g, 32, 28, 12, "#7a553a");
    circle(g, 28, 26, 2.4, "#2a1a10");
    circle(g, 36, 26, 2.4, "#2a1a10");
    circle(g, 32, 33, 4.4, "#8a6a4a");
    g.strokeStyle = "#e8e0d0";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(26, 38);
    g.lineTo(24, 43);
    g.moveTo(38, 38);
    g.lineTo(40, 43);
    g.stroke();
  } else {
    g.fillStyle = "#5a5f66";
    g.beginPath();
    g.moveTo(16, 50);
    g.lineTo(22, 22);
    g.lineTo(42, 22);
    g.lineTo(48, 50);
    g.closePath();
    g.fill();
    circle(g, 32, 20, 11, "#6a7078");
    g.fillStyle = "#3a3f46";
    g.fillRect(20, 30, 24, 3);
    g.fillRect(24, 38, 16, 3);
    circle(g, 27, 20, 3, "#8fd9f0");
    circle(g, 37, 20, 3, "#8fd9f0");
    g.fillStyle = "#4a5058";
    g.fillRect(10, 30, 6, 16);
    g.fillRect(48, 30, 6, 16);
  }
  return cv;
}

export function paintTower(team: "radiant" | "dire"): HTMLCanvasElement {
  const [cv, g] = mk(96);
  const stone = team === "radiant" ? "#5a6b5c" : "#6b5a5a";
  const glow = team === "radiant" ? "#57d98a" : "#e05252";
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.beginPath();
  g.ellipse(48, 84, 30, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = shade(stone, 0.75);
  g.fillRect(28, 30, 40, 56);
  g.fillStyle = stone;
  g.fillRect(32, 26, 32, 56);
  g.strokeStyle = shade(stone, 0.6);
  g.lineWidth = 2;
  for (let y = 36; y < 80; y += 11) {
    g.beginPath();
    g.moveTo(32, y);
    g.lineTo(64, y);
    g.stroke();
    const off = (y / 11) % 2 === 0 ? 8 : 16;
    g.beginPath();
    g.moveTo(32 + off, y);
    g.lineTo(32 + off, y + 11);
    g.stroke();
  }
  g.fillStyle = shade(stone, 1.15);
  g.fillRect(26, 18, 44, 10);
  for (let i = 0; i < 4; i++) g.fillRect(27 + i * 12, 10, 7, 9);
  circle(g, 48, 48, 8, glow);
  circle(g, 48, 48, 4, "#ffffff");
  return cv;
}

export function paintAncient(team: "radiant" | "dire"): HTMLCanvasElement {
  const [cv, g] = mk(128);
  const glow = team === "radiant" ? "#57d98a" : "#e05252";
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.beginPath();
  g.ellipse(64, 106, 42, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#4a4f46";
  g.beginPath();
  g.moveTo(30, 104);
  g.lineTo(42, 40);
  g.lineTo(86, 40);
  g.lineTo(98, 104);
  g.closePath();
  g.fill();
  g.fillStyle = "#5a6052";
  g.beginPath();
  g.moveTo(40, 40);
  g.lineTo(64, 14);
  g.lineTo(88, 40);
  g.closePath();
  g.fill();
  circle(g, 64, 62, 16, glow);
  circle(g, 64, 62, 9, "#ffffff");
  g.strokeStyle = glow;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 62, 24, 0.4, 2.2);
  g.stroke();
  g.beginPath();
  g.arc(64, 62, 24, Math.PI + 0.4, Math.PI + 2.2);
  g.stroke();
  return cv;
}

// базовая карта для пользовательского ландшафта
export function paintTerrain(): HTMLCanvasElement {
  const S = 768;
  const [cv, g] = mk(S);
  const lg = g.createLinearGradient(0, S, S, 0);
  lg.addColorStop(0, "#3d6b3f");
  lg.addColorStop(0.42, "#37503a");
  lg.addColorStop(0.58, "#4a3f3a");
  lg.addColorStop(1, "#4a3232");
  g.fillStyle = lg;
  g.fillRect(0, 0, S, S);
  const rng = (() => {
    let s = 42;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rng() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
    g.fillRect(rng() * S, rng() * S, 2 + rng() * 5, 2 + rng() * 5);
  }
  g.strokeStyle = "rgba(70,120,130,0.8)";
  g.lineWidth = 26;
  g.beginPath();
  g.moveTo(-10, -10);
  g.lineTo(S + 10, S + 10);
  g.stroke();
  g.strokeStyle = "rgba(110,160,170,0.5)";
  g.lineWidth = 10;
  g.stroke();
  for (let i = 0; i < 60; i++) {
    const t = rng() * S;
    const x = t + (rng() - 0.5) * 20;
    const y = t - (rng() - 0.5) * 20;
    const r = 8 + rng() * 16;
    circle(g, x + (y < x ? 0 : 0), y, r, y < x ? "#2b2322" : "#1c3a24");
  }
  return cv;
}
