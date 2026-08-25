// Реестр спрайтов Мастерской: загрузка своих картинок + встроенный пак.
import { HEROES } from "./data";
import {
  paintAncient,
  paintCatapult,
  paintMelee,
  paintNeutral,
  paintRanged,
  paintTerrain,
  paintTower,
} from "./sprites";

export type SpriteSource = HTMLCanvasElement | HTMLImageElement;

const store = new Map<string, SpriteSource>();
const listeners = new Set<(key: string) => void>();

export function subscribeSprites(fn: (key: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(key: string) {
  listeners.forEach((l) => {
    try {
      l(key);
    } catch {
      /* один упавший подписчик не должен ломать остальных */
    }
  });
}

export const TERRAIN_KEY = "terrain";

export function getSprite(key: string): SpriteSource | null {
  return store.get(key) ?? null;
}

export function getSpriteURL(key: string): string | null {
  const s = store.get(key);
  if (!s) return null;
  if (s instanceof HTMLCanvasElement) return s.toDataURL();
  if (s instanceof HTMLImageElement) {
    // превращаем картинку в dataURL (blob-URL мог быть отозван)
    const w = s.naturalWidth || 96;
    const h = s.naturalHeight || 96;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d");
    if (!g) return null;
    g.drawImage(s, 0, 0);
    return cv.toDataURL();
  }
  return null;
}

export function setSprite(key: string, img: HTMLImageElement) {
  store.set(key, img);
  emit(key);
}

export function clearSprite(key: string) {
  store.delete(key);
  emit(key);
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("bad image"));
    };
    img.src = url;
  });
}

// ключи юнитов (для списка в Мастерской)
export const UNIT_KEYS: { key: string; label: string }[] = [
  ...HEROES.map((h) => ({ key: `hero:${h.id}`, label: h.name })),
  { key: "melee", label: "Крип-мечник" },
  { key: "ranged", label: "Крип-стрелок" },
  { key: "siege", label: "Катапульта" },
  { key: "neutral:wolf", label: "Нейтрал: волк" },
  { key: "neutral:bear", label: "Нейтрал: медведь" },
  { key: "neutral:golem", label: "Нейтрал: голем" },
  { key: "tower", label: "Вышка" },
  { key: "ancient", label: "Древний Трон" },
];

export function makeProcedural(key: string): HTMLCanvasElement | null {
  if (key.startsWith("hero:")) return null;
  switch (key) {
    case "melee":
      return paintMelee("radiant");
    case "ranged":
      return paintRanged("radiant");
    case "siege":
      return paintCatapult("radiant");
    case "neutral:wolf":
      return paintNeutral("wolf");
    case "neutral:bear":
      return paintNeutral("bear");
    case "neutral:golem":
      return paintNeutral("golem");
    case "tower":
      return paintTower("radiant");
    case "ancient":
      return paintAncient("radiant");
    default:
      return null;
  }
}

export function setProcedural(key: string): boolean {
  const cv = makeProcedural(key);
  if (!cv) return false;
  store.set(key, cv);
  emit(key);
  return true;
}

export const PRESETS: { name: string; apply: () => number }[] = [
  {
    name: "Пак «Разлом»: герои",
    apply: () => {
      let n = 0;
      HEROES.forEach((h, i) => {
        if (i < 2 && setProceduralHero(h.id)) n++;
      });
      return n;
    },
  },
  {
    name: "Пак «Разлом»: крипы и катапульта",
    apply: () => {
      let n = 0;
      for (const k of ["melee", "ranged", "siege"]) if (setProcedural(k)) n++;
      return n;
    },
  },
  {
    name: "Пак «Разлом»: нейтралы",
    apply: () => {
      let n = 0;
      for (const k of ["neutral:wolf", "neutral:bear", "neutral:golem"]) if (setProcedural(k)) n++;
      return n;
    },
  },
  {
    name: "Пак «Разлом»: здания",
    apply: () => {
      let n = 0;
      for (const k of ["tower", "ancient"]) if (setProcedural(k)) n++;
      return n;
    },
  },
];

function setProceduralHero(heroId: string): boolean {
  const size = 96;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const g = cv.getContext("2d")!;
  const hero = HEROES.find((h) => h.id === heroId);
  if (!hero) return false;
  const col = hero.color;
  const rg = g.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  rg.addColorStop(0, col);
  rg.addColorStop(1, "#0c120d");
  g.fillStyle = rg;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = col;
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = "rgba(8,12,9,0.85)";
  g.font = "900 52px 'Russo One', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(hero.name[0], size / 2, size / 2 + 3);
  store.set(`hero:${heroId}`, cv);
  emit(`hero:${heroId}`);
  return true;
}
