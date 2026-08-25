export type Team = "radiant" | "dire";

export interface Vec {
  x: number;
  y: number;
}

export type UnitKind =
  | "hero"
  | "melee"
  | "ranged"
  | "siege"
  | "neutral"
  | "tower"
  | "ancient"
  | "fountain";

export type AbilityKind =
  | "nuke"
  | "aoe"
  | "buff"
  | "heal"
  | "dash"
  | "ult_aoe"
  | "aoeheal";

export interface AbilityDef {
  key: "Q" | "W" | "E" | "R";
  name: string;
  desc: string;
  kind: AbilityKind;
  mana: number;
  cd: number;
  range: number;
  radius?: number;
  power: number[];
  needsTarget: boolean;
  isUlt: boolean;
  tint: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  role: string;
  attr: "str" | "agi" | "int";
  color: string;
  baseHp: number;
  hpGain: number;
  baseMana: number;
  manaGain: number;
  baseDmg: number;
  dmgGain: number;
  baseArmor: number;
  armorGain: number;
  atkRange: number;
  atkRate: number;
  atkProj: number;
  moveSpeed: number;
  abilities: AbilityDef[];
}

export interface ItemDef {
  id: string;
  name: string;
  cost: number;
  icon: string;
  tint: string;
  desc: string;
  consumable?: boolean;
  stats: Partial<{
    dmg: number;
    hp: number;
    mana: number;
    armor: number;
    ms: number;
    aspd: number;
    regen: number;
    manaRegen: number;
  }>;
}

export interface Buff {
  stat: "ms" | "dmg" | "armor" | "aspd";
  value: number;
  ttl: number;
  tint: string;
}

export interface HeroAbilityState {
  level: number;
  cd: number;
}

export interface UnitAI {
  lane: number;
  state: "lane" | "retreat";
  think: number;
}

export interface Unit {
  id: number;
  team: Team;
  kind: UnitKind;
  pos: Vec;
  moveTarget: Vec | null;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  dmg: number;
  armor: number;
  atkRange: number;
  atkRate: number;
  atkCd: number;
  atkProj: number;
  moveSpeed: number;
  radius: number;
  dead: boolean;
  respawnIn: number;
  attackTargetId: number | null;
  hero: string | null;
  level: number;
  xp: number;
  gold: number;
  kills: number;
  deaths: number;
  assists: number;
  streak: number;
  rapid: number;
  lastKillT: number;
  abilityPoints: number;
  abilities: HeroAbilityState[];
  buffs: Buff[];
  items: string[];
  ai: UnitAI | null;
  isPlayer: boolean;
  camp: number;
  campOrigin: Vec | null;
  lane: number;
  wpIdx: number;
  tier: number;
  hitFlash: number;
  hurtBy: number | null;
  hurtT: number;
  silentT: number;
}

export interface Projectile {
  id: number;
  team: Team;
  kind: "attack" | "spell" | "heal";
  pos: Vec;
  targetId: number | null;
  point: Vec | null;
  speed: number;
  damage: number;
  splash: number;
  tint: string;
  sourceId: number;
  magic: boolean;
  trail: number;
}

export interface Effect {
  kind: "text" | "ring" | "spark" | "slash";
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  maxTtl: number;
  text?: string;
  tint: string;
  size: number;
}

export interface CampDef {
  x: number;
  y: number;
  kind: "wolves" | "bears" | "golems";
}

export interface FeedMsg {
  id: number;
  text: string;
  tint: string;
  ttl: number;
}

export interface Announcement {
  text: string;
  sub: string;
  ttl: number;
  maxTtl: number;
  tint: string;
}

export interface AbilityHud {
  level: number;
  cd: number;
  mana: number;
}

export interface HeroCard {
  heroId: string;
  level: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  respawn: number;
  isPlayer: boolean;
  kills: number;
  deaths: number;
  gold: number;
}

export interface SelectedHero {
  id: number;
  team: Team;
  heroId: string;
  name: string;
  title: string;
  color: string;
  level: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  kills: number;
  deaths: number;
  assists: number;
  items: string[];
  isPlayer: boolean;
  dead: boolean;
}

export interface HudState {
  time: number;
  radiantKills: number;
  direKills: number;
  radiantTowers: number;
  direTowers: number;
  nextWave: number;
  over: "victory" | "defeat" | null;
  selected: SelectedHero | null;
  teams: { radiant: HeroCard[]; dire: HeroCard[] };
  channel: number;
  player: {
    heroId: string;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    level: number;
    xp: number;
    xpNext: number;
    gold: number;
    kills: number;
    deaths: number;
    assists: number;
    abilityPoints: number;
    respawnIn: number;
    items: string[];
    abilities: AbilityHud[];
    dmg: number;
    armor: number;
    ms: number;
  };
  feed: FeedMsg[];
}

// ---------- мультиплеер ----------

export type NetMode = "coop" | "versus";

export interface GameSetup {
  radiant: string[];
  dire: string[];
  playerHero: string;
  playerTeam: Team;
  remoteHero?: string;
  remoteMode?: boolean;
}

export interface NetCmd {
  t: "cmd";
  k:
    | "move"
    | "attack"
    | "castT"
    | "castP"
    | "castS"
    | "learn"
    | "buy"
    | "tp"
    | "stop";
  x?: number;
  y?: number;
  id?: number | string;
  idx?: number;
  slot?: number;
}
