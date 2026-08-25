import type { CampDef, HeroDef, ItemDef, NetMode, Team, Vec } from "./types";

export const WORLD = 6000;
export const RADIANT_BASE: Vec = { x: 950, y: 5050 };
export const DIRE_BASE: Vec = { x: 5050, y: 950 };
export const RADIANT_FOUNTAIN: Vec = { x: 640, y: 5360 };
export const DIRE_FOUNTAIN: Vec = { x: 5360, y: 640 };
export const RADIANT_ANCIENT: Vec = { x: 1130, y: 4870 };
export const DIRE_ANCIENT: Vec = { x: 4870, y: 1130 };

export const opposite = (t: Team): Team => (t === "radiant" ? "dire" : "radiant");

export const LANES: Vec[][] = [
  // TOP
  [
    { x: 950, y: 5050 },
    { x: 760, y: 4860 },
    { x: 600, y: 4200 },
    { x: 560, y: 2600 },
    { x: 580, y: 1250 },
    { x: 700, y: 800 },
    { x: 1250, y: 580 },
    { x: 2600, y: 560 },
    { x: 4200, y: 560 },
    { x: 4860, y: 760 },
    { x: 5050, y: 950 },
  ],
  // MID
  [
    { x: 950, y: 5050 },
    { x: 1500, y: 4500 },
    { x: 2200, y: 3800 },
    { x: 3000, y: 3000 },
    { x: 3800, y: 2200 },
    { x: 4500, y: 1500 },
    { x: 5050, y: 950 },
  ],
  // BOT
  [
    { x: 950, y: 5050 },
    { x: 1140, y: 5240 },
    { x: 1800, y: 5400 },
    { x: 3000, y: 5440 },
    { x: 4200, y: 5440 },
    { x: 4800, y: 5300 },
    { x: 5300, y: 4800 },
    { x: 5440, y: 4200 },
    { x: 5440, y: 2600 },
    { x: 5400, y: 1800 },
    { x: 5240, y: 1140 },
    { x: 5050, y: 950 },
  ],
];

// короткие тропинки-срезы: мид -> топ и мид -> бот
export const SHORTCUTS: Vec[][] = [
  [
    { x: 1720, y: 4290 },
    { x: 1310, y: 3870 },
    { x: 1030, y: 3350 },
    { x: 920, y: 2760 },
    { x: 830, y: 2150 },
    { x: 745, y: 1560 },
  ],
  [
    { x: 4290, y: 1720 },
    { x: 3870, y: 1310 },
    { x: 3350, y: 1030 },
    { x: 2760, y: 920 },
    { x: 2150, y: 830 },
    { x: 1560, y: 745 },
  ],
];

export function polyLength(pts: Vec[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

export function pointAlong(pts: Vec[], t: number): Vec {
  const total = polyLength(pts);
  let need = t * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (need <= seg) {
      const k = need / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k,
      };
    }
    need -= seg;
  }
  return pts[pts.length - 1];
}

// точка на полилинии + направление сегмента (для вышек сбоку от дороги)
export function pointAlongDir(pts: Vec[], t: number): { p: Vec; dir: Vec } {
  const total = polyLength(pts);
  let need = t * total;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const seg = Math.hypot(dx, dy);
    if (need <= seg) {
      const k = need / seg;
      return {
        p: { x: pts[i - 1].x + dx * k, y: pts[i - 1].y + dy * k },
        dir: { x: dx / (seg || 1), y: dy / (seg || 1) },
      };
    }
    need -= seg;
  }
  const a = pts[pts.length - 2] ?? pts[pts.length - 1];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const seg = Math.hypot(dx, dy) || 1;
  return { p: { ...b }, dir: { x: dx / seg, y: dy / seg } };
}

export interface TowerSpot {
  team: Team;
  lane: number;
  tier: number;
  pos: Vec;
}

export const TOWER_SPOTS: TowerSpot[] = (() => {
  const arr: TowerSpot[] = [];
  // доли пути от СВОЕЙ базы: Т1 — крайняя (у реки), Т2 — середина, Т3 — внутренняя (у базы)
  const fr = [0.78, 0.56, 0.34];
  for (const team of ["radiant", "dire"] as Team[]) {
    // направление "к своему углу" — туда откладываем вышку от дороги
    const side: Vec = team === "radiant" ? { x: -1, y: 1 } : { x: 1, y: -1 };
    for (let lane = 0; lane < 3; lane++) {
      const pts = team === "radiant" ? LANES[lane] : [...LANES[lane]].reverse();
      fr.forEach((t, i) => {
        const { p, dir } = pointAlongDir(pts, t);
        // перпендикуляр к дороге, развёрнутый в сторону своей базы
        let px = -dir.y;
        let py = dir.x;
        if (px * side.x + py * side.y < 0) {
          px = -px;
          py = -py;
        }
        arr.push({
          team,
          lane,
          tier: i + 1,
          pos: { x: p.x + px * 125, y: p.y + py * 125 },
        });
      });
    }
  }
  return arr;
})();

export const BASE_TOWERS: { team: Team; pos: Vec }[] = [
  { team: "radiant", pos: { x: RADIANT_ANCIENT.x - 210, y: RADIANT_ANCIENT.y + 130 } },
  { team: "radiant", pos: { x: RADIANT_ANCIENT.x + 130, y: RADIANT_ANCIENT.y - 210 } },
  { team: "dire", pos: { x: DIRE_ANCIENT.x + 210, y: DIRE_ANCIENT.y - 130 } },
  { team: "dire", pos: { x: DIRE_ANCIENT.x - 130, y: DIRE_ANCIENT.y + 210 } },
];

export const CAMPS: CampDef[] = [
  { x: 2000, y: 4350, kind: "wolves" },
  { x: 2750, y: 4650, kind: "bears" },
  { x: 1550, y: 3100, kind: "golems" },
  { x: 4000, y: 1650, kind: "wolves" },
  { x: 3250, y: 1350, kind: "bears" },
  { x: 4450, y: 2900, kind: "golems" },
];

export const TOWER_STATS = [
  { hp: 1500, dmg: 85, range: 720, armor: 12 },
  { hp: 2000, dmg: 115, range: 720, armor: 15 },
  { hp: 2500, dmg: 145, range: 720, armor: 18 },
  { hp: 3100, dmg: 175, range: 760, armor: 22 },
];
export const ANCIENT_STATS = { hp: 4200, dmg: 120, range: 700, armor: 16 };

export const TEAM_COLOR: Record<Team, string> = { radiant: "#57d98a", dire: "#e05252" };

// ---------- герои (10 шт — под 5v5 с двумя людьми без повторов) ----------

export const HEROES: HeroDef[] = [
  {
    id: "akasha", name: "Акаша", title: "Повелительница Пустоты", role: "Нюкер", attr: "int", color: "#b76bf0",
    baseHp: 580, hpGain: 95, baseMana: 420, manaGain: 55, baseDmg: 46, dmgGain: 3.0,
    baseArmor: 2, armorGain: 0.4, atkRange: 550, atkRate: 0.75, atkProj: 1000, moveSpeed: 290,
    abilities: [
      { key: "Q", name: "Разрыв Пустоты", desc: "Сгусток тьмы ранит цель", kind: "nuke", mana: 90, cd: 7, range: 700, power: [90, 150, 210, 270], needsTarget: true, isUlt: false, tint: "#b76bf0" },
      { key: "W", name: "Волна Скверны", desc: "Взрыв в области", kind: "aoe", mana: 110, cd: 10, range: 800, radius: 300, power: [120, 190, 260, 330], needsTarget: false, isUlt: false, tint: "#8f4fd9" },
      { key: "E", name: "Скверное Ускорение", desc: "Скорость и урон на 4с", kind: "buff", mana: 60, cd: 14, range: 0, power: [35, 45, 55, 65], needsTarget: false, isUlt: false, tint: "#c98ff0" },
      { key: "R", name: "Пустотный Взрыв", desc: "Разлом рвёт всех вокруг", kind: "ult_aoe", mana: 200, cd: 80, range: 0, radius: 420, power: [300, 420, 540], needsTarget: false, isUlt: true, tint: "#6b2fd9" },
    ],
  },
  {
    id: "bramble", name: "Брэмбл", title: "Древний Страж", role: "Танк", attr: "str", color: "#57d98a",
    baseHp: 740, hpGain: 125, baseMana: 280, manaGain: 32, baseDmg: 54, dmgGain: 3.4,
    baseArmor: 4, armorGain: 0.7, atkRange: 165, atkRate: 0.9, atkProj: 0, moveSpeed: 295,
    abilities: [
      { key: "Q", name: "Землетрясение", desc: "Удар по земле в области", kind: "aoe", mana: 100, cd: 9, range: 620, radius: 320, power: [110, 170, 230, 290], needsTarget: false, isUlt: false, tint: "#8a6b3f" },
      { key: "W", name: "Каменная Кожа", desc: "Броня и урон на 5с", kind: "buff", mana: 70, cd: 16, range: 0, power: [10, 14, 18, 22], needsTarget: false, isUlt: false, tint: "#9fb4c9" },
      { key: "E", name: "Удар Валуна", desc: "Мощный удар по цели", kind: "nuke", mana: 80, cd: 6, range: 250, power: [70, 115, 160, 205], needsTarget: true, isUlt: false, tint: "#7a8a9a" },
      { key: "R", name: "Пробуждение Големов", desc: "Ярость камня: броня и урон", kind: "buff", mana: 180, cd: 90, range: 0, power: [24, 32, 40], needsTarget: false, isUlt: true, tint: "#d9a05b" },
    ],
  },
  {
    id: "sylvara", name: "Сильвара", title: "Дочь Луны", role: "Керри", attr: "agi", color: "#8fd9e8",
    baseHp: 560, hpGain: 90, baseMana: 320, manaGain: 40, baseDmg: 52, dmgGain: 3.6,
    baseArmor: 3, armorGain: 0.5, atkRange: 620, atkRate: 0.8, atkProj: 1250, moveSpeed: 300,
    abilities: [
      { key: "Q", name: "Лунная Стрела", desc: "Пронзающий выстрел", kind: "nuke", mana: 70, cd: 5, range: 700, power: [80, 130, 180, 230], needsTarget: true, isUlt: false, tint: "#8fd9e8" },
      { key: "W", name: "Лунное Благословение", desc: "Скорость атаки на 5с", kind: "buff", mana: 60, cd: 15, range: 0, power: [0.5, 0.65, 0.8, 0.95], needsTarget: false, isUlt: false, tint: "#c9e8f0" },
      { key: "E", name: "Лунное Сияние", desc: "Вспышка в области", kind: "aoe", mana: 90, cd: 11, range: 750, radius: 280, power: [100, 160, 220, 280], needsTarget: false, isUlt: false, tint: "#a8d9f0" },
      { key: "R", name: "Гнев Луны", desc: "Лунный удар по области", kind: "ult_aoe", mana: 160, cd: 70, range: 0, radius: 400, power: [260, 380, 500], needsTarget: false, isUlt: true, tint: "#e8f4f8" },
    ],
  },
  {
    id: "korvas", name: "Корвас", title: "Кровавый Жнец", role: "Ассасин", attr: "agi", color: "#e05252",
    baseHp: 620, hpGain: 105, baseMana: 300, manaGain: 36, baseDmg: 60, dmgGain: 4.0,
    baseArmor: 3, armorGain: 0.6, atkRange: 180, atkRate: 1.1, atkProj: 0, moveSpeed: 315,
    abilities: [
      { key: "Q", name: "Рывок Жнеца", desc: "Мгновенный рывок к точке", kind: "dash", mana: 70, cd: 8, range: 650, power: [0, 0, 0, 0], needsTarget: false, isUlt: false, tint: "#e05252" },
      { key: "W", name: "Кровавый Удар", desc: "Жестокий выпад по цели", kind: "nuke", mana: 75, cd: 6, range: 260, power: [90, 150, 210, 270], needsTarget: true, isUlt: false, tint: "#f07a7a" },
      { key: "E", name: "Жажда Крови", desc: "Скорость бега на 3.5с", kind: "buff", mana: 60, cd: 14, range: 0, power: [40, 55, 70, 85], needsTarget: false, isUlt: false, tint: "#f0a0a0" },
      { key: "R", name: "Кровавая Жатва", desc: "Вихрь клинков вокруг", kind: "ult_aoe", mana: 170, cd: 75, range: 0, radius: 380, power: [280, 400, 520], needsTarget: false, isUlt: true, tint: "#c92f2f" },
    ],
  },
  {
    id: "lumen", name: "Люмен", title: "Светоносец", role: "Саппорт", attr: "int", color: "#f0d27a",
    baseHp: 540, hpGain: 88, baseMana: 440, manaGain: 58, baseDmg: 44, dmgGain: 2.8,
    baseArmor: 2, armorGain: 0.4, atkRange: 600, atkRate: 0.7, atkProj: 900, moveSpeed: 288,
    abilities: [
      { key: "Q", name: "Свет Исцеления", desc: "Лечит союзного героя", kind: "heal", mana: 80, cd: 6, range: 700, power: [90, 150, 210, 270], needsTarget: true, isUlt: false, tint: "#f0d27a" },
      { key: "W", name: "Сияние", desc: "Святой огонь в области", kind: "aoe", mana: 100, cd: 10, range: 800, radius: 300, power: [110, 175, 240, 305], needsTarget: false, isUlt: false, tint: "#f0e2a0" },
      { key: "E", name: "Благословение", desc: "Урон и броня на 6с", kind: "buff", mana: 70, cd: 15, range: 0, power: [20, 28, 36, 44], needsTarget: false, isUlt: false, tint: "#f0e8c0" },
      { key: "R", name: "Рассвет", desc: "Лечит союзников, жжёт врагов", kind: "aoeheal", mana: 220, cd: 100, range: 0, radius: 500, power: [250, 375, 500], needsTarget: false, isUlt: true, tint: "#f0d27a" },
    ],
  },
  {
    id: "kaira", name: "Кайра", title: "Хранительница Льда", role: "Нюкер", attr: "int", color: "#7fd4f0",
    baseHp: 560, hpGain: 92, baseMana: 400, manaGain: 52, baseDmg: 46, dmgGain: 3.2,
    baseArmor: 2, armorGain: 0.4, atkRange: 550, atkRate: 0.75, atkProj: 950, moveSpeed: 285,
    abilities: [
      { key: "Q", name: "Ледяной Осколок", desc: "Ледяной снаряд в цель", kind: "nuke", mana: 85, cd: 6, range: 700, power: [85, 140, 195, 250], needsTarget: true, isUlt: false, tint: "#7fd4f0" },
      { key: "W", name: "Кольцо Стужи", desc: "Мороз взрывается в области", kind: "aoe", mana: 105, cd: 10, range: 780, radius: 300, power: [115, 180, 245, 310], needsTarget: false, isUlt: false, tint: "#a8e0f0" },
      { key: "E", name: "Ледяная Броня", desc: "Броня и скорость на 5с", kind: "buff", mana: 65, cd: 15, range: 0, power: [8, 11, 14, 17], needsTarget: false, isUlt: false, tint: "#c9ecf8" },
      { key: "R", name: "Буран", desc: "Ледяная буря замедляет и ранит", kind: "ult_aoe", mana: 190, cd: 85, range: 0, radius: 430, power: [290, 410, 530], needsTarget: false, isUlt: true, tint: "#d9f4ff" },
    ],
  },
  {
    id: "run", name: "Рун", title: "Громовержец", role: "Боец", attr: "agi", color: "#9fb4f0",
    baseHp: 600, hpGain: 98, baseMana: 340, manaGain: 42, baseDmg: 55, dmgGain: 3.5,
    baseArmor: 3, armorGain: 0.5, atkRange: 500, atkRate: 0.85, atkProj: 1100, moveSpeed: 305,
    abilities: [
      { key: "Q", name: "Разряд", desc: "Молния бьёт в цель", kind: "nuke", mana: 75, cd: 5, range: 650, power: [80, 135, 190, 245], needsTarget: true, isUlt: false, tint: "#9fb4f0" },
      { key: "W", name: "Цепная Молния", desc: "Гроза в области", kind: "aoe", mana: 100, cd: 9, range: 750, radius: 290, power: [110, 170, 230, 290], needsTarget: false, isUlt: false, tint: "#c9d4f0" },
      { key: "E", name: "Статическое Поле", desc: "Скорость атаки и бега", kind: "buff", mana: 60, cd: 14, range: 0, power: [0.45, 0.6, 0.75, 0.9], needsTarget: false, isUlt: false, tint: "#e0e8ff" },
      { key: "R", name: "Гнев Небес", desc: "Небо обрушивается на врагов", kind: "ult_aoe", mana: 180, cd: 80, range: 0, radius: 410, power: [280, 400, 520], needsTarget: false, isUlt: true, tint: "#f0f4ff" },
    ],
  },
  {
    id: "noktis", name: "Ноктис", title: "Клинок Тьмы", role: "Ассасин", attr: "agi", color: "#b78af0",
    baseHp: 610, hpGain: 100, baseMana: 310, manaGain: 38, baseDmg: 62, dmgGain: 4.1,
    baseArmor: 3, armorGain: 0.6, atkRange: 170, atkRate: 1.05, atkProj: 0, moveSpeed: 318,
    abilities: [
      { key: "Q", name: "Теневой Шаг", desc: "Раствориться и возникнуть в точке", kind: "dash", mana: 65, cd: 7, range: 680, power: [0, 0, 0, 0], needsTarget: false, isUlt: false, tint: "#b78af0" },
      { key: "W", name: "Поглощение Души", desc: "Тёмный удар по цели", kind: "nuke", mana: 80, cd: 6, range: 240, power: [95, 155, 215, 275], needsTarget: true, isUlt: false, tint: "#8a5fd9" },
      { key: "E", name: "Кровожадность", desc: "Урон и скорость атаки", kind: "buff", mana: 60, cd: 14, range: 0, power: [30, 42, 54, 66], needsTarget: false, isUlt: false, tint: "#d9b8f0" },
      { key: "R", name: "Покров Ночи", desc: "Тьма поглощает область", kind: "ult_aoe", mana: 165, cd: 70, range: 0, radius: 390, power: [270, 390, 510], needsTarget: false, isUlt: true, tint: "#4f2f8a" },
    ],
  },
  {
    id: "urgot", name: "Ургот", title: "Зверь Пустоши", role: "Инициатор", attr: "str", color: "#d9a05b",
    baseHp: 760, hpGain: 128, baseMana: 260, manaGain: 30, baseDmg: 56, dmgGain: 3.6,
    baseArmor: 4, armorGain: 0.7, atkRange: 160, atkRate: 0.95, atkProj: 0, moveSpeed: 292,
    abilities: [
      { key: "Q", name: "Сотрясение", desc: "Пустошь содрогается", kind: "aoe", mana: 95, cd: 8, range: 600, radius: 310, power: [105, 165, 225, 285], needsTarget: false, isUlt: false, tint: "#d9a05b" },
      { key: "W", name: "Ярость Зверя", desc: "Урон и броня на 5с", kind: "buff", mana: 70, cd: 15, range: 0, power: [18, 26, 34, 42], needsTarget: false, isUlt: false, tint: "#e8c08a" },
      { key: "E", name: "Сокрушительный Рёв", desc: "Оглушающий рёв по цели", kind: "nuke", mana: 85, cd: 7, range: 230, power: [80, 130, 180, 230], needsTarget: true, isUlt: false, tint: "#c98a3f" },
      { key: "R", name: "Топот Древних", desc: "Земля раскалывается вокруг", kind: "ult_aoe", mana: 185, cd: 85, range: 0, radius: 400, power: [270, 385, 500], needsTarget: false, isUlt: true, tint: "#a06b2f" },
    ],
  },
  {
    id: "solara", name: "Солара", title: "Дитя Рассвета", role: "Саппорт", attr: "int", color: "#f0c96b",
    baseHp: 570, hpGain: 94, baseMana: 430, manaGain: 56, baseDmg: 45, dmgGain: 2.9,
    baseArmor: 2, armorGain: 0.4, atkRange: 580, atkRate: 0.72, atkProj: 950, moveSpeed: 286,
    abilities: [
      { key: "Q", name: "Обжигающий Луч", desc: "Луч солнца ранит цель", kind: "nuke", mana: 80, cd: 6, range: 680, power: [80, 135, 190, 245], needsTarget: true, isUlt: false, tint: "#f0c96b" },
      { key: "W", name: "Солнечное Благословение", desc: "Тепло исцеляет союзника", kind: "heal", mana: 85, cd: 7, range: 700, power: [95, 160, 225, 290], needsTarget: true, isUlt: false, tint: "#f0e0a0" },
      { key: "E", name: "Сияние Рассвета", desc: "Урон и броня союзнику", kind: "buff", mana: 65, cd: 15, range: 0, power: [22, 30, 38, 46], needsTarget: false, isUlt: false, tint: "#f8ecc0" },
      { key: "R", name: "Полуденное Затмение", desc: "Свет лечит и карает", kind: "aoeheal", mana: 210, cd: 95, range: 0, radius: 480, power: [240, 360, 480], needsTarget: false, isUlt: true, tint: "#f0d9a0" },
    ],
  },
];

export const ITEMS: ItemDef[] = [
  { id: "tp", name: "Свиток телепорта", cost: 100, icon: "scroll", tint: "#c9a0f0", desc: "Телепорт на базу или свою вышку (3с)", consumable: true, stats: {} },
  { id: "blade", name: "Железный клинок", cost: 450, icon: "sword", tint: "#c9c9d4", desc: "+18 урона", stats: { dmg: 18 } },
  { id: "mail", name: "Кольчуга", cost: 500, icon: "shield", tint: "#9fb4c9", desc: "+6 брони", stats: { armor: 6 } },
  { id: "vitality", name: "Кольцо жизни", cost: 500, icon: "ring", tint: "#7de08a", desc: "+260 здоровья", stats: { hp: 260 } },
  { id: "boots", name: "Сапоги ветра", cost: 450, icon: "boots", tint: "#8fd9c9", desc: "+45 скорости", stats: { ms: 45 } },
  { id: "stone", name: "Камень энергии", cost: 600, icon: "gem", tint: "#8fa8f0", desc: "+300 маны, +2 рег. маны", stats: { mana: 300, manaRegen: 2 } },
  { id: "regrowth", name: "Лоза восстановления", cost: 400, icon: "leaf", tint: "#9fe08a", desc: "+6 рег. здоровья", stats: { regen: 6 } },
  { id: "drum", name: "Боевой барабан", cost: 1200, icon: "drum", tint: "#e0b07a", desc: "+30 урона, +250 здоровья", stats: { dmg: 30, hp: 250 } },
  { id: "plate", name: "Плита хранителя", cost: 1400, icon: "shield", tint: "#c9d9e8", desc: "+12 брони, +400 здоровья", stats: { armor: 12, hp: 400 } },
  { id: "talon", name: "Коготь стремительности", cost: 2000, icon: "claw", tint: "#e8e08f", desc: "+28 урона, +45 скорости, +0.5 скор. атаки", stats: { dmg: 28, ms: 45, aspd: 0.5 } },
  { id: "fang", name: "Кровавый клык", cost: 2200, icon: "sword", tint: "#f08a8a", desc: "+55 урона, +150 здоровья", stats: { dmg: 55, hp: 150 } },
  { id: "idol", name: "Тайный идол", cost: 2400, icon: "gem", tint: "#c9a8f0", desc: "+600 маны, +8 рег. маны, +40 урона", stats: { mana: 600, manaRegen: 8, dmg: 40 } },
  { id: "heart", name: "Сердце голема", cost: 2600, icon: "heart", tint: "#f07a9f", desc: "+1200 здоровья, +12 рег.", stats: { hp: 1200, regen: 12 } },
];

export function heroById(id: string): HeroDef {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}

export function itemById(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}

export function xpForLevel(level: number): number {
  return Math.round(180 * Math.pow(level, 1.15));
}

// ---------- ростеры ----------

export const SLOT_LANES = [1, 0, 0, 2, 2];

// локальная игра: игрок + 4 союзника против 5 ботов
export function buildLocalSetup(playerHero: string): { radiant: string[]; dire: string[] } {
  const pool = HEROES.map((h) => h.id).filter((h) => h !== playerHero);
  return { radiant: [playerHero, ...pool.slice(0, 4)], dire: pool.slice(4, 9) };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// сетевая игра: coop — оба человека за Свет; versus — по разным сторонам
export function buildNetRoster(mode: NetMode, hostHero: string, guestHero: string): { radiant: string[]; dire: string[] } {
  const rest = shuffle(HEROES.map((h) => h.id).filter((h) => h !== hostHero && h !== guestHero));
  if (mode === "coop") {
    return { radiant: [hostHero, guestHero, ...rest.slice(0, 3)], dire: rest.slice(3, 8) };
  }
  return { radiant: [hostHero, ...rest.slice(0, 4)], dire: [guestHero, ...rest.slice(4, 8)] };
}
