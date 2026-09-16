import type {
  AbilityDef,
  Announcement,
  Buff,
  Effect,
  FeedMsg,
  GameSetup,
  HeroCard,
  HudState,
  NetCmd,
  Projectile,
  Team,
  Unit,
  Vec,
} from "./types";
import {
  ANCIENT_STATS,
  BASE_TOWERS,
  CAMPS,
  DIRE_ANCIENT,
  DIRE_BASE,
  DIRE_FOUNTAIN,
  HEROES,
  ITEMS,
  LANES,
  RADIANT_ANCIENT,
  RADIANT_BASE,
  RADIANT_FOUNTAIN,
  SLOT_LANES,
  TOWER_SPOTS,
  TOWER_STATS,
  WORLD,
  buildLocalSetup,
  heroById,
  itemById,
  xpForLevel,
} from "./data";
import { sfx } from "./audio";

let nextId = 1;
const nid = () => nextId++;

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export const buffSum = (u: Unit, stat: Buff["stat"]) =>
  u.buffs.reduce((s, b) => (b.stat === stat ? s + b.value : s), 0);
export const effDmg = (u: Unit) => u.dmg + buffSum(u, "dmg");
export const effArmor = (u: Unit) => u.armor + buffSum(u, "armor");
export const effMS = (u: Unit) => Math.max(130, u.moveSpeed + buffSum(u, "ms"));
export const effRate = (u: Unit) => Math.max(0.25, u.atkRate + buffSum(u, "aspd"));

const isTargetable = (u: Unit) => !u.dead && u.kind !== "fountain" && u.silentT <= 0;
const isStructure = (u: Unit) => u.kind === "tower" || u.kind === "ancient";
const isHeroLike = (u: Unit) => u.kind === "hero";

const BUFF_FX: Record<string, (p: number, tint: string) => Buff[]> = {
  akasha: (p, t) => [{ stat: "ms", value: p, ttl: 4, tint: t }, { stat: "dmg", value: p * 0.6, ttl: 4, tint: t }],
  bramble: (p, t) => [{ stat: "armor", value: p * 0.7, ttl: 5, tint: t }, { stat: "dmg", value: p, ttl: 5, tint: t }],
  sylvara: (p, t) => [{ stat: "aspd", value: p, ttl: 5, tint: t }, { stat: "ms", value: 30, ttl: 5, tint: t }],
  korvas: (p, t) => [{ stat: "ms", value: p, ttl: 3.5, tint: t }],
  lumen: (p, t) => [{ stat: "dmg", value: p, ttl: 6, tint: t }, { stat: "armor", value: p * 0.16, ttl: 6, tint: t }],
  kaira: (p, t) => [{ stat: "armor", value: p * 0.8, ttl: 5, tint: t }, { stat: "ms", value: 25, ttl: 5, tint: t }],
  run: (p, t) => [{ stat: "aspd", value: p, ttl: 5, tint: t }, { stat: "ms", value: 35, ttl: 5, tint: t }],
  noktis: (p, t) => [{ stat: "dmg", value: p, ttl: 5, tint: t }, { stat: "aspd", value: 0.3, ttl: 5, tint: t }],
  urgot: (p, t) => [{ stat: "dmg", value: p, ttl: 5, tint: t }, { stat: "armor", value: p * 0.5, ttl: 5, tint: t }],
  solara: (p, t) => [{ stat: "dmg", value: p, ttl: 6, tint: t }, { stat: "armor", value: p * 0.15, ttl: 6, tint: t }],
};

const KIND_CODE: Record<Unit["kind"], number> = {
  hero: 0, melee: 1, ranged: 2, siege: 3, neutral: 4, tower: 5, ancient: 6, fountain: 7,
};
const KIND_BY_CODE: Unit["kind"][] = ["hero", "melee", "ranged", "siege", "neutral", "tower", "ancient", "fountain"];

function makeUnit(p: Partial<Unit> & { team: Team; kind: Unit["kind"]; pos: Vec }): Unit {
  return {
    id: nid(),
    moveTarget: null,
    hp: 100,
    maxHp: 100,
    mana: 0,
    maxMana: 0,
    dmg: 20,
    armor: 0,
    atkRange: 60,
    atkRate: 1,
    atkCd: 0,
    atkProj: 0,
    moveSpeed: 220,
    radius: 16,
    dead: false,
    respawnIn: 0,
    attackTargetId: null,
    hero: null,
    level: 1,
    xp: 0,
    gold: 600,
    kills: 0,
    deaths: 0,
    assists: 0,
    streak: 0,
    rapid: 0,
    lastKillT: -99,
    abilityPoints: 0,
    abilities: [],
    buffs: [],
    items: [],
    ai: null,
    isPlayer: false,
    camp: -1,
    campOrigin: null,
    lane: 1,
    wpIdx: 1,
    tier: 1,
    hitFlash: 0,
    hurtBy: null,
    hurtT: 0,
    silentT: 0,
    ...p,
  };
}

export interface NetSnap {
  t: number;
  wt: number;
  rk: number;
  dk: number;
  o: number; // 0 none, 1 victory, 2 defeat
  ch: number; // телепорт гостя 0..1
  ann: [string, string, string, number, number] | 0;
  feed: [string, string, number][];
  ca: number[];
  units: (number | string)[][];
  proj: (number | string)[][];
  fx: (number | string)[][];
}

export class GameEngine {
  units: Unit[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  feed: FeedMsg[] = [];
  announcement: Announcement | null = null;
  time = 0;
  waveTimer = 15;
  waveCount = 0;
  campTimer = 60;
  campAlive: boolean[] = CAMPS.map(() => true);
  radiantKills = 0;
  direKills = 0;
  over: "victory" | "defeat" | null = null;
  overT = 0;
  player!: Unit;
  playerHeroId: string;
  playerTeam: Team = "radiant";
  camera: Vec;
  camTarget: Vec;
  camFree = 0;
  zoom = 1;
  shake = 0;
  firstBlood = false;
  selectedId: number | null = null;
  playerChannel: { t: number; dur: number; dest: Vec } | null = null;
  remoteUnit: Unit | null = null;
  remoteMode = false;
  private remoteChannel: { t: number; dur: number; dest: Vec } | null = null;
  private remoteTargets = new Map<number, Vec>();
  private feedId = 1;

  constructor(playerHero: string, setup?: GameSetup) {
    const st: GameSetup = setup
      ? setup
      : { ...buildLocalSetup(playerHero), playerHero, playerTeam: "radiant" };
    this.playerHeroId = playerHero;
    this.playerTeam = st.playerTeam;
    this.remoteMode = !!st.remoteMode;

    this.units.push(
      makeUnit({ team: "radiant", kind: "fountain", pos: { ...RADIANT_FOUNTAIN }, hp: 1e9, maxHp: 1e9, radius: 90, moveSpeed: 0 }),
      makeUnit({ team: "dire", kind: "fountain", pos: { ...DIRE_FOUNTAIN }, hp: 1e9, maxHp: 1e9, radius: 90, moveSpeed: 0 })
    );
    this.units.push(
      makeUnit({ team: "radiant", kind: "ancient", pos: { ...RADIANT_ANCIENT }, hp: ANCIENT_STATS.hp, maxHp: ANCIENT_STATS.hp, dmg: ANCIENT_STATS.dmg, armor: ANCIENT_STATS.armor, atkRange: ANCIENT_STATS.range, atkRate: 0.9, atkProj: 800, radius: 62, moveSpeed: 0 }),
      makeUnit({ team: "dire", kind: "ancient", pos: { ...DIRE_ANCIENT }, hp: ANCIENT_STATS.hp, maxHp: ANCIENT_STATS.hp, dmg: ANCIENT_STATS.dmg, armor: ANCIENT_STATS.armor, atkRange: ANCIENT_STATS.range, atkRate: 0.9, atkProj: 800, radius: 62, moveSpeed: 0 })
    );
    for (const t of TOWER_SPOTS) {
      const s = TOWER_STATS[t.tier - 1];
      this.units.push(
        makeUnit({ team: t.team, kind: "tower", pos: { ...t.pos }, hp: s.hp, maxHp: s.hp, dmg: s.dmg, armor: s.armor, atkRange: s.range, atkRate: 0.85, atkProj: 850, radius: 34, moveSpeed: 0, lane: t.lane, tier: t.tier })
      );
    }
    for (const t of BASE_TOWERS) {
      const s = TOWER_STATS[3];
      this.units.push(
        makeUnit({ team: t.team, kind: "tower", pos: { ...t.pos }, hp: s.hp, maxHp: s.hp, dmg: s.dmg, armor: s.armor, atkRange: s.range, atkRate: 0.85, atkProj: 850, radius: 36, moveSpeed: 0, lane: -1, tier: 4 })
      );
    }

    const spawnTeam = (team: Team, heroes: string[]) => {
      heroes.forEach((hid, i) => {
        const isP = hid === st.playerHero && st.playerTeam === team;
        const u = this.spawnHero(hid, team, isP, SLOT_LANES[i % SLOT_LANES.length]);
        if (st.remoteHero && hid === st.remoteHero && team !== st.playerTeam) {
          this.remoteUnit = u;
          u.ai = null;
        } else if (st.remoteHero && hid === st.remoteHero && st.playerTeam === team) {
          // coop: второй человек в той же команде
          this.remoteUnit = u;
          u.ai = null;
        }
      });
    };
    spawnTeam("radiant", st.radiant);
    spawnTeam("dire", st.dire);

    this.player = this.units.find((u) => u.isPlayer) ?? this.units[0];
    this.spawnAllCamps();
    this.camera = { ...this.player.pos };
    this.camTarget = { ...this.player.pos };
    this.announce("БИТВА НАЧАЛАСЬ", "Первая волна крипов через 15 секунд", "#f0d27a", 3.4);
  }

  // ---------- spawning ----------

  spawnHero(heroId: string, team: Team, isPlayer: boolean, lane: number): Unit {
    const def = heroById(heroId);
    const fountain = team === "radiant" ? RADIANT_FOUNTAIN : DIRE_FOUNTAIN;
    const u = makeUnit({
      team,
      kind: "hero",
      pos: { x: fountain.x + rand(-70, 70), y: fountain.y + rand(-70, 70) },
      hero: heroId,
      radius: 22,
      lane,
      isPlayer,
      gold: 600,
      abilityPoints: 1,
      abilities: def.abilities.map(() => ({ level: 0, cd: 0 })),
      ai: isPlayer ? null : { lane, state: "lane", think: rand(0, 0.3) },
      atkProj: def.atkProj,
    });
    this.units.push(u);
    this.recalc(u);
    u.hp = u.maxHp;
    u.mana = u.maxMana;
    return u;
  }

  recalc(u: Unit) {
    const def = heroById(u.hero ?? "akasha");
    const l = u.level - 1;
    let maxHp = def.baseHp + def.hpGain * l;
    let maxMana = def.baseMana + def.manaGain * l;
    let dmg = def.baseDmg + def.dmgGain * l;
    let armor = def.baseArmor + def.armorGain * l;
    let ms = def.moveSpeed;
    let rate = def.atkRate;
    for (const iid of u.items) {
      const it = itemById(iid);
      if (!it) continue;
      maxHp += it.stats.hp ?? 0;
      maxMana += it.stats.mana ?? 0;
      dmg += it.stats.dmg ?? 0;
      armor += it.stats.armor ?? 0;
      ms += it.stats.ms ?? 0;
      rate += it.stats.aspd ?? 0;
    }
    const dHp = maxHp - u.maxHp;
    const dMana = maxMana - u.maxMana;
    u.maxHp = maxHp;
    u.maxMana = maxMana;
    u.dmg = dmg;
    u.armor = armor;
    u.moveSpeed = ms;
    u.atkRate = rate;
    u.atkRange = def.atkRange;
    if (dHp > 0) u.hp += dHp;
    if (dMana > 0) u.mana += dMana;
    u.hp = clamp(u.hp, 0, u.maxHp);
    u.mana = clamp(u.mana, 0, u.maxMana);
  }

  spawnCreep(team: Team, lane: number, kind: "melee" | "ranged" | "siege") {
    const w = this.waveCount;
    const base = team === "radiant" ? RADIANT_BASE : DIRE_BASE;
    const pts = this.lanePoints(team, lane);
    const dir = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const t = rand(30, 130);
    const side = rand(-55, 55);
    const pos = {
      x: base.x + (dir.x / len) * t + (-dir.y / len) * side,
      y: base.y + (dir.y / len) * t + (dir.x / len) * side,
    };
    const hpM = 1 + w * 0.05;
    const dmgM = 1 + w * 0.04;
    const specs = {
      melee: { hp: 545 * hpM, dmg: 19 * dmgM, armor: 2, range: 60, rate: 0.9, ms: 225, proj: 0, radius: 15 },
      ranged: { hp: 300 * hpM, dmg: 26 * dmgM, armor: 0, range: 470, rate: 0.85, ms: 225, proj: 900, radius: 13 },
      siege: { hp: 840 * hpM, dmg: 48 * dmgM, armor: 5, range: 390, rate: 0.55, ms: 200, proj: 700, radius: 20 },
    }[kind];
    this.units.push(
      makeUnit({
        team, kind, pos, hp: specs.hp, maxHp: specs.hp, dmg: specs.dmg, armor: specs.armor,
        atkRange: specs.range, atkRate: specs.rate, atkProj: specs.proj, moveSpeed: specs.ms,
        radius: specs.radius, lane, wpIdx: 1,
      })
    );
  }

  lanePoints(team: Team, lane: number): Vec[] {
    const pts = LANES[lane];
    return team === "radiant" ? pts : [...pts].reverse();
  }

  spawnAllCamps() {
    CAMPS.forEach((_, i) => {
      this.campAlive[i] = true;
      this.spawnCamp(i);
    });
  }

  spawnCamp(i: number) {
    const c = CAMPS[i];
    const scale = 1 + (this.time / 60) * 0.04;
    const add = (hp: number, dmg: number, radius: number, dx: number, dy: number) => {
      this.units.push(
        makeUnit({
          team: "dire", kind: "neutral",
          pos: { x: c.x + dx, y: c.y + dy },
          hp: hp * scale, maxHp: hp * scale, dmg: dmg * scale, armor: 2,
          atkRange: 80, atkRate: 0.85, moveSpeed: 200, radius, camp: i,
          campOrigin: { x: c.x + dx, y: c.y + dy },
        })
      );
    };
    if (c.kind === "wolves") {
      add(360, 24, 16, -40, 0);
      add(360, 24, 16, 40, 0);
    } else if (c.kind === "bears") {
      add(560, 32, 19, -45, 0);
      add(560, 32, 19, 45, 0);
    } else {
      add(950, 42, 26, 0, -30);
      add(420, 26, 16, 40, 40);
    }
    this.campAlive[i] = true;
  }

  // ---------- commands ----------

  orderMove(point: Vec, u: Unit = this.player) {
    if (u.dead || this.over) return;
    this.cancelChannel(u);
    u.attackTargetId = null;
    u.moveTarget = this.clampToWorld(point);
  }

  orderAttack(targetId: number, u: Unit = this.player) {
    if (u.dead || this.over) return;
    const t = this.byId(targetId);
    if (!t || t.team === u.team || !isTargetable(t)) return;
    this.cancelChannel(u);
    u.attackTargetId = targetId;
    u.moveTarget = null;
  }

  private cancelChannel(u: Unit) {
    if (u === this.player) this.playerChannel = null;
    if (u === this.remoteUnit) this.remoteChannel = null;
  }

  clampToWorld(p: Vec): Vec {
    return { x: clamp(p.x, 40, WORLD - 40), y: clamp(p.y, 40, WORLD - 40) };
  }

  byId(id: number): Unit | undefined {
    return this.units.find((u) => u.id === id);
  }

  pickAt(p: Vec, enemyOf: Team): Unit | null {
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of this.units) {
      if (u.team === enemyOf || !isTargetable(u)) continue;
      const d = dist(p, u.pos) - u.radius;
      if (d < 14 && d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  pickHeroAt(p: Vec): Unit | null {
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of this.units) {
      if (!isHeroLike(u) || u.dead) continue;
      const d = dist(p, u.pos) - u.radius;
      if (d < 18 && d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  pickStructureAt(p: Vec, team: Team): Unit | null {
    let best: Unit | null = null;
    let bd = Infinity;
    for (const u of this.units) {
      if (u.team !== team || u.dead) continue;
      if (u.kind !== "tower" && u.kind !== "ancient") continue;
      const d = dist(p, u.pos) - u.radius;
      if (d < 130 && d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  // ---------- abilities ----------

  beginCast(idx: number): "done" | "target" | "point" | "fail" {
    const u = this.player;
    if (u.dead || this.over) return "fail";
    const def = this.defOf(u)[idx];
    const st = u.abilities[idx];
    if (!def || st.level <= 0) {
      sfx.error();
      return "fail";
    }
    if (st.cd > 0 || u.mana < def.mana) {
      sfx.error();
      return "fail";
    }
    if (def.kind === "aoe" || def.kind === "dash") return "point";
    if (def.needsTarget) return "target";
    return this.execCast(u, idx, u.id, { ...u.pos }) ? "done" : "fail";
  }

  castAtPoint(idx: number, point: Vec): boolean {
    return this.execCast(this.player, idx, null, point);
  }

  castAtTarget(idx: number, targetId: number): boolean {
    return this.execCast(this.player, idx, targetId, null);
  }

  private defOf(u: Unit): AbilityDef[] {
    return heroById(u.hero ?? "akasha").abilities;
  }

  execCast(u: Unit, idx: number, targetId: number | null, point: Vec | null): boolean {
    const def = this.defOf(u)[idx];
    const st = u.abilities[idx];
    if (!def || st.level <= 0 || st.cd > 0 || u.mana < def.mana) return false;
    const power = def.power[Math.min(def.power.length - 1, st.level - 1)];
    const ok = () => {
      u.mana -= def.mana;
      st.cd = def.cd * (1 - 0.07 * (st.level - 1));
      sfx.cast();
      return true;
    };

    switch (def.kind) {
      case "nuke": {
        const t = targetId != null ? this.byId(targetId) : null;
        if (!t || t.team === u.team || !isTargetable(t) || dist(u.pos, t.pos) > def.range + t.radius) return false;
        this.projectiles.push({
          id: nid(), team: u.team, kind: "spell", pos: { ...u.pos }, targetId: t.id, point: null,
          speed: 1050, damage: power, splash: 0, tint: def.tint, sourceId: u.id, magic: true, trail: 0,
        });
        this.fxCastNuke(u.pos.x, u.pos.y, def.tint);
        sfx.nuke();
        return ok();
      }
      case "heal": {
        const t = targetId != null ? this.byId(targetId) : null;
        if (!t || t.team !== u.team || !isHeroLike(t) || t.dead || dist(u.pos, t.pos) > def.range + t.radius) return false;
        this.projectiles.push({
          id: nid(), team: u.team, kind: "heal", pos: { ...u.pos }, targetId: t.id, point: null,
          speed: 1000, damage: power, splash: 0, tint: def.tint, sourceId: u.id, magic: false, trail: 0,
        });
        this.fxCastHeal(u.pos.x, u.pos.y, def.tint);
        return ok();
      }
      case "aoe": {
        if (!point) return false;
        const p = this.clampRange(u.pos, point, def.range);
        this.projectiles.push({
          id: nid(), team: u.team, kind: "spell", pos: { ...u.pos }, targetId: null, point: p,
          speed: 850, damage: power, splash: def.radius ?? 280, tint: def.tint, sourceId: u.id, magic: true, trail: 0,
        });
        this.fxCastAoe(u.pos.x, u.pos.y, def.radius ?? 280, def.tint);
        sfx.nuke();
        return ok();
      }
      case "dash": {
        if (!point) return false;
        const p = this.clampRange(u.pos, point, def.range);
        this.fxCastDash(u.pos.x, u.pos.y, p.x, p.y, def.tint);
        u.pos = p;
        u.moveTarget = null;
        return ok();
      }
      case "buff": {
        let t: Unit = u;
        if (def.needsTarget) {
          const c = targetId != null ? this.byId(targetId) : null;
          if (!c || c.team !== u.team || !isHeroLike(c) || c.dead || dist(u.pos, c.pos) > def.range + c.radius) return false;
          t = c;
        }
        const fx = BUFF_FX[u.hero ?? ""] ?? BUFF_FX.akasha;
        for (const b of fx(power, def.tint)) t.buffs.push(b);
        this.fxCastBuff(t.pos.x, t.pos.y, def.tint);
        return ok();
      }
      case "ult_aoe": {
        const radius = def.radius ?? 400;
        this.fxCastUlt(u.pos.x, u.pos.y, radius, def.tint);
        this.shakeIt(6);
        for (const e of this.units) {
          if (e.team === u.team || !isTargetable(e) || isStructure(e)) continue;
          if (dist(u.pos, e.pos) <= radius + e.radius) {
            this.dealDamage(u, e, power, true, def.tint);
            if (u.hero === "bramble" || u.hero === "kaira") e.buffs.push({ stat: "ms", value: -85, ttl: 2, tint: def.tint });
          }
        }
        for (const e of this.units) {
          if (e.team === u.team || !isTargetable(e) || !isStructure(e)) continue;
          if (dist(u.pos, e.pos) <= radius + e.radius) this.dealDamage(u, e, power * 0.55, true, def.tint);
        }
        return ok();
      }
      case "aoeheal": {
        const radius = def.radius ?? 500;
        this.fxCastUlt(u.pos.x, u.pos.y, radius, def.tint);
        this.shakeIt(5);
        for (const e of this.units) {
          if (!isTargetable(e) || dist(u.pos, e.pos) > radius + e.radius) continue;
          if (e.team !== u.team) this.dealDamage(u, e, power, true, def.tint);
          else if (isHeroLike(e)) this.healUnit(e, power * 0.7);
        }
        return ok();
      }
    }
    return false;
  }

  private clampRange(from: Vec, to: Vec, range: number): Vec {
    const d = dist(from, to);
    if (d <= range) return this.clampToWorld(to);
    return this.clampToWorld({
      x: from.x + ((to.x - from.x) / d) * range,
      y: from.y + ((to.y - from.y) / d) * range,
    });
  }

  learnAbility(idx: number, u: Unit = this.player): boolean {
    const def = this.defOf(u)[idx];
    const st = u.abilities[idx];
    if (!def || u.abilityPoints <= 0) return false;
    const nextLvl = st.level + 1;
    if (nextLvl > def.power.length) return false;
    const req = def.isUlt ? [6, 11, 16][nextLvl - 1] : nextLvl * 2 - 1;
    if (u.level < req) return false;
    st.level = nextLvl;
    u.abilityPoints--;
    this.fxRing(u.pos.x, u.pos.y, 90, "#f0d27a");
    if (u.isPlayer) sfx.levelup();
    return true;
  }

  buyItem(itemId: string, u: Unit = this.player): boolean {
    const it = itemById(itemId);
    if (!it || u.items.length >= 6 || u.gold < it.cost) {
      if (u.isPlayer) sfx.error();
      return false;
    }
    u.gold -= it.cost;
    u.items.push(itemId);
    this.recalc(u);
    if (u.isPlayer) {
      sfx.buy();
      this.fxText(u.pos.x, u.pos.y - 40, it.name, "#f0d27a", 15);
    }
    return true;
  }

  // ---------- телепорт ----------

  getTpSlot(u: Unit = this.player): number {
    return u.items.indexOf("tp");
  }

  confirmTp(slot: number, targetId: number, u: Unit = this.player): boolean {
    const itemId = u.items[slot];
    if (itemId !== "tp" || u.dead || this.over) return false;
    if ((u === this.player && this.playerChannel) || (u === this.remoteUnit && this.remoteChannel)) return false;
    const target = this.byId(targetId);
    if (!target || target.team !== u.team || (target.kind !== "tower" && target.kind !== "ancient") || target.dead) {
      sfx.error();
      return false;
    }
    if (dist(u.pos, target.pos) < 300) {
      this.fxText(u.pos.x, u.pos.y - 40, "Слишком близко", "#c9c2ae", 13);
      return false;
    }
    u.items.splice(slot, 1);
    this.recalc(u);
    const ang = Math.atan2(u.pos.y - target.pos.y, u.pos.x - target.pos.x);
    const off = target.radius + 70;
    const dest = { x: target.pos.x + Math.cos(ang) * off, y: target.pos.y + Math.sin(ang) * off };
    const ch = { t: 3, dur: 3, dest };
    if (u === this.player) this.playerChannel = ch;
    else this.remoteChannel = ch;
    u.moveTarget = null;
    u.attackTargetId = null;
    this.fxRing(u.pos.x, u.pos.y, 60, "#c9a0f0");
    this.pushFeed("Телепорт к " + (target.kind === "ancient" ? "базе" : `вышке Т${target.tier}`), "#c9a0f0");
    sfx.cast();
    return true;
  }

  private tickChannel(u: Unit, ch: { t: number; dur: number; dest: Vec }, dt: number): boolean {
    if (u.dead) return false;
    ch.t -= dt;
    this.fxRing(u.pos.x, u.pos.y, 30 + (ch.t / ch.dur) * 40, "#c9a0f0");
    if (ch.t <= 0) {
      this.fxRing(u.pos.x, u.pos.y, 90, "#c9a0f0");
      u.pos = { ...ch.dest };
      u.moveTarget = null;
      u.attackTargetId = null;
      if (u === this.player) {
        this.camTarget = { ...u.pos };
        this.camFree = 0;
      }
      this.fxRing(u.pos.x, u.pos.y, 90, "#c9a0f0");
      this.fxText(u.pos.x, u.pos.y - 50, "Телепорт!", "#c9a0f0", 16);
      sfx.cast();
      return false;
    }
    return true;
  }

  // ---------- серии убийств ----------

  private announceStreak(src: Unit) {
    if (!this.firstBlood) {
      this.firstBlood = true;
      this.announce("ПЕРВАЯ КРОВЬ", this.heroName(src) + " проливает её!", "#e05252", 2.6);
      return;
    }
    if (src.rapid >= 5) {
      this.announce("БЕЗУМИЕ!", this.heroName(src) + " не остановить", "#f0527a", 2.4);
      sfx.streak();
    } else if (src.rapid === 4) {
      this.announce("ЯРОСТЬ!", this.heroName(src) + " в ярости", "#f07a4a", 2.4);
      sfx.streak();
    } else if (src.rapid === 3) {
      this.announce("ТРОЙНОЕ УБИЙСТВО!", this.heroName(src), "#f0a24a", 2.2);
      sfx.streak();
    } else if (src.rapid === 2) {
      this.announce("ДВОЙНОЕ УБИЙСТВО!", this.heroName(src), "#f0d27a", 2.0);
      sfx.streak();
    } else if (src.streak === 5) {
      this.announce("GODLIKE!", this.heroName(src) + " — легенда Разлома", "#f05252", 2.8);
      sfx.streak();
    } else if (src.streak === 3) {
      this.announce("СЕРИЯ УБИЙСТВ!", this.heroName(src) + ": 3 подряд", "#f0d27a", 2.2);
    }
  }

  // ---------- combat ----------

  dealDamage(src: Unit | null, target: Unit, raw: number, magic: boolean, tint: string) {
    if (target.dead || target.silentT > 0 || this.over) return;
    let dmg = raw;
    if (magic) dmg *= 0.75;
    else {
      const a = Math.max(0, effArmor(target));
      dmg *= 1 - (0.06 * a) / (1 + 0.06 * a);
    }
    dmg = Math.max(1, Math.round(dmg));
    target.hp -= dmg;
    target.hitFlash = 0.12;
    if (target === this.player && this.playerChannel) {
      this.playerChannel = null;
      this.fxText(target.pos.x, target.pos.y - 40, "Телепорт прерван!", "#e05252", 13);
    }
    if (target === this.remoteUnit && this.remoteChannel) {
      this.remoteChannel = null;
      this.fxText(target.pos.x, target.pos.y - 40, "Телепорт прерван!", "#e05252", 13);
    }
    if (src) {
      target.hurtBy = src.id;
      target.hurtT = 8;
    }
    this.fxText(target.pos.x + rand(-14, 14), target.pos.y - target.radius - 8, String(dmg), tint, magic ? 15 : 13);
    sfx.hit();
    if (target.hp <= 0) this.kill(src, target);
  }

  healUnit(t: Unit, amt: number) {
    if (t.dead) return;
    const real = Math.min(t.maxHp - t.hp, Math.round(amt));
    if (real <= 0) return;
    t.hp += real;
    this.fxText(t.pos.x + rand(-12, 12), t.pos.y - t.radius - 8, `+${real}`, "#7de08a", 14);
  }

  kill(src: Unit | null, victim: Unit) {
    victim.dead = true;
    victim.hp = 0;
    victim.attackTargetId = null;
    const team = victim.team === "radiant" ? "dire" : "radiant";
    for (let i = 0; i < 10; i++) {
      this.effects.push({
        kind: "spark", x: victim.pos.x, y: victim.pos.y,
        vx: rand(-160, 160), vy: rand(-220, -40), ttl: rand(0.35, 0.7), maxTtl: 0.7,
        tint: victim.team === "radiant" ? "#57d98a" : "#e05252", size: rand(2, 5),
      });
    }
    this.fxRing(victim.pos.x, victim.pos.y, victim.radius * 2.2, victim.team === "radiant" ? "#57d98a" : "#e05252");

    if (isHeroLike(victim)) {
      victim.deaths++;
      victim.respawnIn = Math.min(65, 5 + victim.level * 3.2);
      victim.streak = 0;
      victim.rapid = 0;
      if (victim.isPlayer) sfx.death();
      if (src && isHeroLike(src)) {
        src.kills++;
        src.streak++;
        const now = this.time;
        src.rapid = now - src.lastKillT < 8 ? src.rapid + 1 : 1;
        src.lastKillT = now;
        const g = Math.round(200 + victim.level * 22);
        this.gainGold(src, g);
        if (src.team === "radiant") this.radiantKills++;
        else this.direKills++;
        this.announceStreak(src);
      } else {
        if (src?.team === "radiant") this.radiantKills++;
        else if (src?.team === "dire") this.direKills++;
        if (!this.firstBlood) {
          this.firstBlood = true;
          this.announce("ПЕРВАЯ КРОВЬ", "", "#e05252", 2.8);
        }
      }
      for (const u of this.units) {
        if (isHeroLike(u) && u.team === team && !u.dead && u.id !== src?.id && victim.hurtBy === u.id && victim.hurtT > 0) {
          u.assists++;
        }
      }
      const xp = 150 + victim.level * 28;
      this.shareXp(team, victim.pos, xp);
      this.pushFeed(`${this.heroName(victim)} повержен!`, victim.team === "radiant" ? "#e05252" : "#57d98a");
      return;
    }

    if (victim.kind === "tower" || victim.kind === "ancient") {
      this.shakeIt(victim.kind === "ancient" ? 22 : 13);
      sfx.tower();
      if (victim.kind === "tower") {
        this.pushFeed(`Башня Т${victim.tier} (${victim.team === "radiant" ? "Свет" : "Тьма"}) разрушена`, team === "radiant" ? "#57d98a" : "#e05252");
        this.announce(`БАШНЯ Т${victim.tier} РАЗРУШЕНА`, victim.team === "radiant" ? "Пала башня Света" : "Пала башня Тьмы", team === "radiant" ? "#57d98a" : "#e05252", 2.4);
        if (src && isHeroLike(src)) this.gainGold(src, 250);
        for (const u of this.units) if (isHeroLike(u) && u.team === team && !u.dead && u.id !== src?.id) this.gainGold(u, 110);
        this.shareXp(team, victim.pos, 260);
      } else {
        this.announce(team === "radiant" ? "ТРОН ТЬМЫ ПАЛ" : "ТРОН СВЕТА ПАЛ", "", team === "radiant" ? "#f0d27a" : "#e05252", 5);
        this.over = team === "radiant" ? "victory" : "defeat";
        this.overT = 1.6;
        if (team === "radiant") sfx.victory();
        else sfx.defeat();
      }
      return;
    }

    const isNeutral = victim.kind === "neutral";
    const gold = isNeutral
      ? Math.round(victim.maxHp * 0.15)
      : { melee: 42, ranged: 50, siege: 70 }[victim.kind as "melee" | "ranged" | "siege"] ?? 42;
    const xp = isNeutral ? Math.round(victim.maxHp * 0.24) : { melee: 62, ranged: 74, siege: 90 }[victim.kind as "melee" | "ranged" | "siege"] ?? 60;
    if (src && isHeroLike(src)) {
      this.gainGold(src, gold);
      for (const u of this.units) {
        if (isHeroLike(u) && u.team === src.team && !u.dead && u.id !== src.id && dist(u.pos, victim.pos) < 950) {
          this.gainGold(u, Math.round(gold * 0.35));
        }
      }
    }
    this.shareXp(isNeutral ? (src?.team ?? team) : team, victim.pos, xp);
    if (isNeutral) {
      const alive = this.units.some((u) => !u.dead && u.kind === "neutral" && u.camp === victim.camp);
      if (!alive) this.campAlive[victim.camp] = false;
    }
  }

  private heroName(u: Unit): string {
    return heroById(u.hero ?? "akasha").name;
  }

  shareXp(team: Team, pos: Vec, total: number) {
    const heroes = this.units.filter((u) => isHeroLike(u) && u.team === team && !u.dead && dist(u.pos, pos) < 1400);
    if (heroes.length === 0) return;
    const each = total / heroes.length;
    heroes.forEach((h) => this.gainXp(h, each));
  }

  gainXp(u: Unit, amt: number) {
    if (u.level >= 25) return;
    u.xp += amt;
    while (u.xp >= xpForLevel(u.level) && u.level < 25) {
      u.xp -= xpForLevel(u.level);
      u.level++;
      u.abilityPoints++;
      this.recalc(u);
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.12);
      u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.2);
      this.fxRing(u.pos.x, u.pos.y, 90, "#f0d27a");
      if (u.isPlayer || u === this.remoteUnit) {
        sfx.levelup();
        this.fxText(u.pos.x, u.pos.y - 60, `УРОВЕНЬ ${u.level}`, "#f0d27a", 20);
      }
    }
  }

  gainGold(u: Unit, amt: number) {
    u.gold += amt;
    if (u.isPlayer || u === this.remoteUnit) {
      sfx.gold();
      this.fxText(u.pos.x, u.pos.y - 46, `+${amt}`, "#f0d27a", 15);
    }
  }

  // ---------- fx ----------

  fxText(x: number, y: number, text: string, tint: string, size: number) {
    if (this.effects.length > 380) this.effects.splice(0, 40);
    this.effects.push({ kind: "text", x, y, vx: 0, vy: -46, ttl: 0.95, maxTtl: 0.95, text, tint, size });
  }

  fxRing(x: number, y: number, radius: number, tint: string) {
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.5, maxTtl: 0.5, tint, size: radius });
  }

  fxSlash(x: number, y: number, tint: string) {
    this.effects.push({ kind: "slash", x, y, vx: rand(-20, 20), vy: rand(-30, -10), ttl: 0.22, maxTtl: 0.22, tint, size: rand(18, 30) });
  }

  // Эффекты кастов способностей
  fxCastNuke(x: number, y: number, tint: string) {
    // Концентрированный сгусток энергии
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = rand(80, 140);
      this.effects.push({
        kind: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: 0.4,
        maxTtl: 0.4,
        tint,
        size: rand(3, 6),
      });
    }
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.3, maxTtl: 0.3, tint, size: 40 });
  }

  fxCastAoe(x: number, y: number, radius: number, tint: string) {
    // Взрыв по области
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const speed = rand(100, 200);
      this.effects.push({
        kind: "spark",
        x: x + Math.cos(angle) * radius * 0.3,
        y: y + Math.sin(angle) * radius * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: 0.6,
        maxTtl: 0.6,
        tint,
        size: rand(4, 8),
      });
    }
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.5, maxTtl: 0.5, tint, size: radius });
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.4, maxTtl: 0.4, tint, size: radius * 0.6 });
  }

  fxCastBuff(x: number, y: number, tint: string) {
    // Восходящие частицы баффа
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.effects.push({
        kind: "spark",
        x: x + Math.cos(angle) * 20,
        y: y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * 30,
        vy: -rand(60, 120),
        ttl: 0.7,
        maxTtl: 0.7,
        tint,
        size: rand(3, 5),
      });
    }
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.4, maxTtl: 0.4, tint, size: 50 });
  }

  fxCastHeal(x: number, y: number, tint: string) {
    // Целительные орбы
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      this.effects.push({
        kind: "spark",
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        vx: Math.cos(angle) * 20,
        vy: -rand(40, 80),
        ttl: 0.8,
        maxTtl: 0.8,
        tint: "#7de08a",
        size: rand(4, 7),
      });
    }
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.5, maxTtl: 0.5, tint, size: 60 });
  }

  fxCastDash(x: number, y: number, tx: number, ty: number, tint: string) {
    // След рывка
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.floor(dist / 20);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      this.effects.push({
        kind: "spark",
        x: x + dx * t,
        y: y + dy * t,
        vx: rand(-20, 20),
        vy: rand(-20, 20),
        ttl: 0.3 + t * 0.2,
        maxTtl: 0.5,
        tint,
        size: rand(2, 4),
      });
    }
    this.effects.push({ kind: "ring", x: tx, y: ty, vx: 0, vy: 0, ttl: 0.4, maxTtl: 0.4, tint, size: 70 });
  }

  fxCastUlt(x: number, y: number, radius: number, tint: string) {
    // Ультимативный взрыв
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const speed = rand(150, 280);
      this.effects.push({
        kind: "spark",
        x: x + Math.cos(angle) * radius * 0.2,
        y: y + Math.sin(angle) * radius * 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl: 0.8,
        maxTtl: 0.8,
        tint,
        size: rand(5, 10),
      });
    }
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.7, maxTtl: 0.7, tint, size: radius });
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.6, maxTtl: 0.6, tint, size: radius * 0.7 });
    this.effects.push({ kind: "ring", x, y, vx: 0, vy: 0, ttl: 0.5, maxTtl: 0.5, tint, size: radius * 0.4 });
  }

  shakeIt(v: number) {
    this.shake = Math.max(this.shake, v);
  }

  announce(text: string, sub: string, tint: string, dur: number) {
    this.announcement = { text, sub, ttl: dur, maxTtl: dur, tint };
  }

  pushFeed(text: string, tint: string) {
    this.feed.push({ id: this.feedId++, text, tint, ttl: 5.5 });
    if (this.feed.length > 6) this.feed.shift();
  }

  // ---------- update ----------

  update(dt: number) {
    if (this.remoteMode) {
      this.updateRemote(dt);
      return;
    }
    if (this.over) {
      this.overT -= dt;
      this.updateFx(dt);
      this.shake = Math.max(0, this.shake - dt * 30);
      return;
    }
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 30);

    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = 30;
      this.waveCount++;
      for (let lane = 0; lane < 3; lane++) {
        for (const team of ["radiant", "dire"] as Team[]) {
          this.spawnCreep(team, lane, "melee");
          this.spawnCreep(team, lane, "melee");
          this.spawnCreep(team, lane, "melee");
          this.spawnCreep(team, lane, "ranged");
          this.spawnCreep(team, lane, "siege");
        }
      }
      if (this.waveCount === 1) this.pushFeed("Волна крипов вышла на линии", "#c9c2ae");
    }

    this.campTimer -= dt;
    if (this.campTimer <= 0) {
      this.campTimer = 60;
      CAMPS.forEach((c, i) => {
        if (this.campAlive[i]) return;
        const blocked = this.units.some((u) => !u.dead && dist(u.pos, { x: c.x, y: c.y }) < 320);
        if (!blocked) this.spawnCamp(i);
      });
    }

    for (const u of this.units) {
      if (u.dead) {
        if (isHeroLike(u)) {
          u.respawnIn -= dt;
          if (u.respawnIn <= 0) this.respawnHero(u);
        }
        continue;
      }
      u.atkCd -= dt;
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      u.hurtT = Math.max(0, u.hurtT - dt);
      u.silentT = Math.max(0, u.silentT - dt);
      u.buffs = u.buffs.filter((b) => (b.ttl -= dt) > 0);

      if (isHeroLike(u)) {
        const regen = 1.1 + u.level * 0.18 + u.items.reduce((s, iid) => s + (itemById(iid)?.stats.regen ?? 0), 0);
        const mregen = 0.9 + u.level * 0.14 + u.items.reduce((s, iid) => s + (itemById(iid)?.stats.manaRegen ?? 0), 0);
        u.hp = Math.min(u.maxHp, u.hp + regen * dt);
        u.mana = Math.min(u.maxMana, u.mana + mregen * dt);
        u.gold += 1.6 * dt;
        for (const a of u.abilities) a.cd = Math.max(0, a.cd - dt);
        const f = u.team === "radiant" ? RADIANT_FOUNTAIN : DIRE_FOUNTAIN;
        if (dist(u.pos, f) < 540) {
          u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.1 * dt);
          u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.12 * dt);
        }
        if (u.ai) this.botThink(u, dt);
      }

      this.updateCombat(u);
      if (!isStructure(u) && u.kind !== "fountain") this.updateMove(u, dt);
    }

    // расталкивание
    const movable = this.units.filter((u) => !u.dead && !isStructure(u) && u.kind !== "fountain");
    for (let i = 0; i < movable.length; i++) {
      const a = movable[i];
      for (let j = i + 1; j < movable.length; j++) {
        const b = movable[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        const min = (a.radius + b.radius) * 0.72;
        if (d > 0 && d < min) {
          const push = ((min - d) / d) * 0.5;
          a.pos.x -= dx * push;
          a.pos.y -= dy * push;
          b.pos.x += dx * push;
          b.pos.y += dy * push;
        }
      }
    }

    this.updateProjectiles(dt);
    this.updateFx(dt);

    if (this.playerChannel && !this.tickChannel(this.player, this.playerChannel, dt)) this.playerChannel = null;
    if (this.remoteChannel && this.remoteUnit && !this.tickChannel(this.remoteUnit, this.remoteChannel, dt)) this.remoteChannel = null;

    this.units = this.units.filter((u) => !u.dead || isHeroLike(u));

    this.camFree = Math.max(0, this.camFree - dt);
    if (this.camFree <= 0 || !this.player.dead) {
      if (this.camFree <= 0) this.camTarget = { ...this.player.pos };
    }
    const k = Math.min(1, dt * 6);
    this.camera.x = lerp(this.camera.x, this.camTarget.x, k);
    this.camera.y = lerp(this.camera.y, this.camTarget.y, k);

    this.feed = this.feed.filter((f) => (f.ttl -= dt) > 0);
    if (this.announcement && (this.announcement.ttl -= dt) <= 0) this.announcement = null;
  }

  private updateRemote(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 30);
    const k = Math.min(1, dt * 13);
    for (const u of this.units) {
      const t = this.remoteTargets.get(u.id);
      if (!t) continue;
      if (u.dead) {
        u.pos.x = t.x;
        u.pos.y = t.y;
      } else {
        u.pos.x = lerp(u.pos.x, t.x, k);
        u.pos.y = lerp(u.pos.y, t.y, k);
      }
    }
    this.camFree = Math.max(0, this.camFree - dt);
    if (this.camFree <= 0 && !this.player.dead) this.camTarget = { ...this.player.pos };
    const ck = Math.min(1, dt * 6);
    this.camera.x = lerp(this.camera.x, this.camTarget.x, ck);
    this.camera.y = lerp(this.camera.y, this.camTarget.y, ck);
    this.feed = this.feed.filter((f) => (f.ttl -= dt) > 0);
    if (this.announcement && (this.announcement.ttl -= dt) <= 0) this.announcement = null;
  }

  respawnHero(u: Unit) {
    const f = u.team === "radiant" ? RADIANT_FOUNTAIN : DIRE_FOUNTAIN;
    u.dead = false;
    u.pos = { x: f.x + rand(-60, 60), y: f.y + rand(-60, 60) };
    u.hp = u.maxHp;
    u.mana = u.maxMana;
    u.silentT = 1.2;
    u.attackTargetId = null;
    u.moveTarget = null;
    this.fxRing(u.pos.x, u.pos.y, 80, "#f0d27a");
    if (u.ai) u.ai.state = "lane";
  }

  updateMove(u: Unit, dt: number) {
    if (!u.moveTarget) return;
    const dx = u.moveTarget.x - u.pos.x;
    const dy = u.moveTarget.y - u.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) {
      u.moveTarget = null;
      return;
    }
    const step = effMS(u) * dt;
    if (step >= d) {
      u.pos.x = u.moveTarget.x;
      u.pos.y = u.moveTarget.y;
      u.moveTarget = null;
    } else {
      u.pos.x += (dx / d) * step;
      u.pos.y += (dy / d) * step;
    }
  }

  nearestEnemy(u: Unit, range: number, structuresOnly = false): Unit | null {
    let best: Unit | null = null;
    let bd = range;
    for (const e of this.units) {
      if (e.team === u.team || !isTargetable(e)) continue;
      if (structuresOnly && !isStructure(e)) continue;
      const d = dist(u.pos, e.pos) - e.radius;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  updateCombat(u: Unit) {
    if (isStructure(u)) {
      if (u.atkCd <= 0) {
        const inRange = this.units.filter((e) => e.team !== u.team && isTargetable(e) && dist(u.pos, e.pos) - e.radius <= u.atkRange);
        if (inRange.length > 0) {
          inRange.sort((a, b) => {
            const ah = isHeroLike(a) ? 1 : 0;
            const bh = isHeroLike(b) ? 1 : 0;
            if (ah !== bh) return ah - bh;
            return dist(u.pos, a.pos) - dist(u.pos, b.pos);
          });
          this.fireAttack(u, inRange[0]);
        }
      }
      return;
    }
    if (u.kind === "fountain") return;

    const target = u.attackTargetId != null ? this.byId(u.attackTargetId) : undefined;
    if (target && (!isTargetable(target) || target.team === u.team)) {
      u.attackTargetId = null;
    }

    if (u.kind === "melee" || u.kind === "ranged" || u.kind === "siege") this.creepThink(u);
    else if (u.kind === "neutral") this.neutralThink(u);

    const t = u.attackTargetId != null ? this.byId(u.attackTargetId) : undefined;
    if (!t || !isTargetable(t) || t.team === u.team) return;
    const d = dist(u.pos, t.pos) - t.radius - u.radius;
    if (d > u.atkRange) {
      if (!isStructure(u)) u.moveTarget = { ...t.pos };
      return;
    }
    u.moveTarget = null;
    if (u.atkCd <= 0) this.fireAttack(u, t);
  }

  private fireAttack(u: Unit, t: Unit) {
    u.atkCd = 1 / effRate(u);
    if (u.atkProj > 0) {
      this.projectiles.push({
        id: nid(), team: u.team, kind: "attack", pos: { ...u.pos }, targetId: t.id, point: null,
        speed: u.atkProj, damage: effDmg(u), splash: 0,
        tint: u.kind === "tower" || u.kind === "ancient" ? (u.team === "radiant" ? "#a8f0c0" : "#f0a0a0") : "#f0e2b8",
        sourceId: u.id, magic: false, trail: 0,
      });
      if (u.kind === "tower" || u.kind === "ancient") sfx.arrow();
    } else {
      this.fxSlash(t.pos.x, t.pos.y, "#f0e2b8");
      this.dealDamage(u, t, effDmg(u), false, "#f0e2b8");
    }
  }

  private creepThink(u: Unit) {
    if (u.attackTargetId != null) {
      const t = this.byId(u.attackTargetId);
      if (t && isTargetable(t) && dist(u.pos, t.pos) < 620) return;
      u.attackTargetId = null;
    }
    let aggro = 470;
    let preferStructure = false;
    if (u.kind === "siege") {
      aggro = 560;
      preferStructure = true;
    }
    let target: Unit | null = null;
    if (preferStructure) target = this.nearestEnemy(u, aggro, true);
    if (!target) {
      let bd = aggro;
      for (const e of this.units) {
        if (e.team === u.team || !isTargetable(e)) continue;
        const d = dist(u.pos, e.pos) - e.radius;
        if (d < bd) {
          bd = d;
          target = e;
        }
      }
    }
    if (target) {
      u.attackTargetId = target.id;
      return;
    }
    const pts = this.lanePoints(u.team, u.lane);
    if (u.wpIdx < pts.length) {
      const wp = pts[u.wpIdx];
      if (dist(u.pos, wp) < 110) u.wpIdx++;
      else u.moveTarget = { ...wp };
    } else {
      const ancient = this.units.find((e) => e.kind === "ancient" && e.team !== u.team && !e.dead);
      if (ancient) {
        u.attackTargetId = ancient.id;
        u.moveTarget = { ...ancient.pos };
      }
    }
  }

  private neutralThink(u: Unit) {
    if (u.attackTargetId != null) {
      const t = this.byId(u.attackTargetId);
      const origin = u.campOrigin ?? u.pos;
      if (t && isTargetable(t) && dist(u.pos, origin) < 640 && dist(u.pos, t.pos) < 620) return;
      u.attackTargetId = null;
    }
    const origin = u.campOrigin ?? u.pos;
    for (const e of this.units) {
      if (e.team === "dire" && e.kind === "neutral") continue;
      if (!isTargetable(e) || isStructure(e) || e.kind === "fountain") continue;
      if (e.kind !== "hero" && e.kind !== "melee" && e.kind !== "ranged" && e.kind !== "siege") continue;
      if (dist(origin, e.pos) < 300 && dist(u.pos, e.pos) < 420) {
        u.attackTargetId = e.id;
        return;
      }
    }
    if (dist(u.pos, origin) > 30) {
      u.moveTarget = { ...origin };
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.0008);
    } else u.moveTarget = null;
  }

  private botLearn(u: Unit) {
    const defs = this.defOf(u);
    let guard = 0;
    while (u.abilityPoints > 0 && guard++ < 8) {
      let learned = false;
      for (let i = 0; i < defs.length; i++) {
        const d = defs[i];
        const st = u.abilities[i];
        if (st.level >= d.power.length) continue;
        const req = d.isUlt ? [6, 11, 16][st.level] : st.level * 2 + 1;
        if (u.level >= req) {
          st.level++;
          u.abilityPoints--;
          learned = true;
          break;
        }
      }
      if (!learned) break;
    }
  }

  private botThink(u: Unit, dt: number) {
    const ai = u.ai;
    if (!ai) return;
    this.botLearn(u);
    ai.think -= dt;
    const fountain = u.team === "radiant" ? RADIANT_FOUNTAIN : DIRE_FOUNTAIN;

    if (u.gold > 500 && u.items.length < 6) {
      const next = ITEMS.find((it) => it.id !== "tp" && !u.items.includes(it.id) && it.cost <= u.gold - 150);
      if (next && Math.random() < dt * 0.5) {
        u.gold -= next.cost;
        u.items.push(next.id);
        this.recalc(u);
      }
    }

    const atFountain = dist(u.pos, fountain) < 540;
    if (atFountain && u.hp < u.maxHp * 0.93) {
      u.moveTarget = null;
      u.attackTargetId = null;
      return;
    }
    if (ai.state === "retreat") {
      u.moveTarget = { ...fountain };
      if (u.hp > u.maxHp * 0.9 && atFountain) ai.state = "lane";
      this.tryBotAbilities(u);
      return;
    }
    if (u.hp < u.maxHp * 0.3) {
      ai.state = "retreat";
      return;
    }

    if (ai.think <= 0) {
      ai.think = 0.28;
      let heroTarget: Unit | null = null;
      let hd = 700;
      for (const e of this.units) {
        if (e.team === u.team || !isHeroLike(e) || e.dead) continue;
        const d = dist(u.pos, e.pos);
        if (d < hd) {
          hd = d;
          heroTarget = e;
        }
      }
      if (heroTarget) {
        const allies = this.units.filter((a) => a.team === u.team && isHeroLike(a) && !a.dead && dist(a.pos, u.pos) < 900).length;
        const brave = u.hp > u.maxHp * 0.45 || allies >= 2;
        if (brave) u.attackTargetId = heroTarget.id;
        else if (u.hp < u.maxHp * 0.55) {
          ai.state = "retreat";
          return;
        }
      } else {
        let t: Unit | null = null;
        let bd = 600;
        for (const e of this.units) {
          if (e.team === u.team || !isTargetable(e) || isHeroLike(e)) continue;
          const d = dist(u.pos, e.pos) - e.radius;
          if (d < bd) {
            bd = d;
            t = e;
          }
        }
        if (t) u.attackTargetId = t.id;
        else {
          const pts = this.lanePoints(u.team, ai.lane);
          if (u.wpIdx < pts.length) {
            const wp = pts[u.wpIdx];
            if (dist(u.pos, wp) < 120) u.wpIdx++;
            else u.moveTarget = { ...wp };
          } else {
            const ancient = this.units.find((e) => e.kind === "ancient" && e.team !== u.team && !e.dead);
            if (ancient) u.attackTargetId = ancient.id;
          }
        }
      }
      if (!u.attackTargetId && u.moveTarget && Math.random() < 0.3) {
        for (let i = 0; i < CAMPS.length; i++) {
          const c = CAMPS[i];
          const side = c.x + c.y < 6000 ? "radiant" : "dire";
          if (side !== u.team) continue;
          if (dist(u.pos, { x: c.x, y: c.y }) < 700) {
            const neutral = this.units.find((n) => !n.dead && n.kind === "neutral" && n.camp === i);
            if (neutral) {
              u.attackTargetId = neutral.id;
              break;
            }
          }
        }
      }
      this.tryBotAbilities(u);
    }
  }

  private tryBotAbilities(u: Unit) {
    const defs = this.defOf(u);
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const st = u.abilities[i];
      if (st.level <= 0 || st.cd > 0 || u.mana < def.mana + 40) continue;
      let enemy: Unit | null = null;
      let bd = def.range > 0 ? def.range : 620;
      for (const e of this.units) {
        if (e.team === u.team || !isTargetable(e) || !isHeroLike(e)) continue;
        const d = dist(u.pos, e.pos);
        if (d < bd) {
          bd = d;
          enemy = e;
        }
      }
      if (def.kind === "heal") {
        if (u.hp < u.maxHp * 0.72) this.execCast(u, i, u.id, null);
        else {
          const ally = this.units.find((a) => a.team === u.team && isHeroLike(a) && !a.dead && a.hp < a.maxHp * 0.6 && dist(u.pos, a.pos) < def.range);
          if (ally) this.execCast(u, i, ally.id, null);
        }
        continue;
      }
      if (def.kind === "buff") {
        if (enemy || u.hp < u.maxHp * 0.75) this.execCast(u, i, u.id, null);
        continue;
      }
      if (!enemy) continue;
      if (def.kind === "nuke") {
        this.execCast(u, i, enemy.id, null);
      } else if (def.kind === "aoe" || def.kind === "dash") {
        const p = { x: enemy.pos.x + rand(-60, 60), y: enemy.pos.y + rand(-60, 60) };
        if (def.kind === "dash" && u.hp < u.maxHp * 0.5) continue;
        this.execCast(u, i, null, p);
      } else if (def.kind === "ult_aoe" || def.kind === "aoeheal") {
        if (bd < (def.radius ?? 400)) this.execCast(u, i, u.id, { ...u.pos });
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.trail += dt;
      let dest: Vec | null = p.point;
      const t = p.targetId != null ? this.byId(p.targetId) : undefined;
      if (t && !t.dead) dest = t.pos;
      if (!dest) {
        p.speed = -1;
        continue;
      }
      const dx = dest.x - p.pos.x;
      const dy = dest.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      const hitR = t ? t.radius + 10 : 8;
      if (d <= step + hitR) {
        p.speed = -1;
        if (p.kind === "heal") {
          if (t && !t.dead) this.healUnit(t, p.damage);
        } else if (p.splash > 0) {
          const at = t && !t.dead ? t.pos : p.point ?? p.pos;
          this.fxRing(at.x, at.y, p.splash, p.tint);
          this.shakeIt(3);
          for (const e of this.units) {
            if (e.team === p.team || !isTargetable(e)) continue;
            if (dist(at, e.pos) <= p.splash + e.radius) {
              this.dealDamage(this.byId(p.sourceId) ?? null, e, p.damage, p.magic, p.tint);
            }
          }
        } else if (t && !t.dead) {
          this.dealDamage(this.byId(p.sourceId) ?? null, t, p.damage, p.magic, p.tint);
        }
      } else {
        p.pos.x += (dx / d) * step;
        p.pos.y += (dy / d) * step;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.speed > 0);
  }

  private updateFx(dt: number) {
    for (const e of this.effects) {
      e.ttl -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.kind === "spark") e.vy += 420 * dt;
    }
    this.effects = this.effects.filter((e) => e.ttl > 0);
  }

  // ---------- команды удалённого игрока (хост) ----------

  remoteCmd(cmd: NetCmd) {
    const u = this.remoteUnit;
    if (!u || this.over) return;
    switch (cmd.k) {
      case "move":
        if (cmd.x != null && cmd.y != null) this.orderMove({ x: cmd.x, y: cmd.y }, u);
        break;
      case "attack":
        if (cmd.id != null) this.orderAttack(Number(cmd.id), u);
        break;
      case "castT":
        if (cmd.idx != null && cmd.id != null) this.execCast(u, cmd.idx, Number(cmd.id), null);
        break;
      case "castP":
        if (cmd.idx != null && cmd.x != null && cmd.y != null) this.execCast(u, cmd.idx, null, { x: cmd.x, y: cmd.y });
        break;
      case "castS":
        if (cmd.idx != null) this.execCast(u, cmd.idx, u.id, { ...u.pos });
        break;
      case "learn":
        if (cmd.idx != null) this.learnAbility(cmd.idx, u);
        break;
      case "buy":
        if (cmd.id != null) this.buyItem(String(cmd.id), u);
        break;
      case "tp":
        if (cmd.slot != null && cmd.id != null) this.confirmTp(cmd.slot, Number(cmd.id), u);
        break;
      case "stop":
        u.moveTarget = null;
        u.attackTargetId = null;
        this.cancelChannel(u);
        break;
    }
  }

  // ---------- сетевые снапшоты ----------

  netSnapshot(): NetSnap {
    const units = this.units.map((u): (number | string)[] => [
      u.id,
      KIND_CODE[u.kind],
      u.team === "radiant" ? 0 : 1,
      Math.round(u.pos.x),
      Math.round(u.pos.y),
      Math.round(u.hp),
      Math.round(u.maxHp),
      Math.round(u.mana),
      Math.round(u.maxMana),
      Math.round(u.radius),
      u.dead ? 1 : 0,
      u.hero ? HEROES.findIndex((h) => h.id === u.hero) : -1,
      u.level,
      u.kind === "neutral" ? u.camp + 1 : u.tier,
      u.lane,
      Math.ceil(u.respawnIn),
      u.hitFlash > 0 ? 1 : 0,
      u === this.remoteUnit ? 1 : 0,
      Math.floor(u.gold),
      u.kills,
      u.deaths,
      u.assists,
      u.abilityPoints,
      u.abilities[0]?.level ?? 0,
      Math.round((u.abilities[0]?.cd ?? 0) * 10) / 10,
      u.abilities[1]?.level ?? 0,
      Math.round((u.abilities[1]?.cd ?? 0) * 10) / 10,
      u.abilities[2]?.level ?? 0,
      Math.round((u.abilities[2]?.cd ?? 0) * 10) / 10,
      u.abilities[3]?.level ?? 0,
      Math.round((u.abilities[3]?.cd ?? 0) * 10) / 10,
      u.items.join(","),
    ]);
    const proj = this.projectiles.map((p): (number | string)[] => [
      p.team === "radiant" ? 0 : 1,
      p.kind === "attack" ? 0 : p.kind === "spell" ? 1 : 2,
      Math.round(p.pos.x),
      Math.round(p.pos.y),
      p.targetId ?? -1,
      p.point ? Math.round(p.point.x) : -1,
      p.point ? Math.round(p.point.y) : -1,
      p.tint,
      p.speed,
      p.damage,
      p.splash,
      p.magic ? 1 : 0,
      p.sourceId,
    ]);
    const fx = this.effects.map((e): (number | string)[] => [
      e.kind === "text" ? 0 : e.kind === "ring" ? 1 : e.kind === "spark" ? 2 : 3,
      Math.round(e.x),
      Math.round(e.y),
      Math.round(e.ttl * 20) / 20,
      e.maxTtl,
      e.tint,
      e.size,
      e.text ?? "",
    ]);
    return {
      t: this.time,
      wt: this.waveTimer,
      rk: this.radiantKills,
      dk: this.direKills,
      o: this.over === "victory" ? 1 : this.over === "defeat" ? 2 : 0,
      ch: this.remoteChannel ? 1 - this.remoteChannel.t / this.remoteChannel.dur : 0,
      ann: this.announcement
        ? [this.announcement.text, this.announcement.sub, this.announcement.tint, this.announcement.ttl, this.announcement.maxTtl]
        : 0,
      feed: this.feed.map((f): [string, string, number] => [f.text, f.tint, Math.round(f.ttl * 10) / 10]),
      ca: this.campAlive.map((c) => (c ? 1 : 0)),
      units,
      proj,
      fx,
    };
  }

  applySnapshot(snap: NetSnap) {
    this.time = snap.t;
    this.waveTimer = snap.wt;
    this.radiantKills = snap.rk;
    this.direKills = snap.dk;
    this.over = snap.o === 1 ? "victory" : snap.o === 2 ? "defeat" : null;
    this.playerChannel = snap.ch > 0 ? { t: (1 - snap.ch) * 3, dur: 3, dest: { ...this.player.pos } } : null;
    this.announcement = snap.ann
      ? { text: snap.ann[0], sub: snap.ann[1], tint: snap.ann[2], ttl: snap.ann[3], maxTtl: snap.ann[4] }
      : null;
    this.feed = snap.feed.map(([text, tint, ttl]) => ({ id: this.feedId++, text, tint, ttl }));
    snap.ca.forEach((v, i) => (this.campAlive[i] = v === 1));

    const seen = new Set<number>();
    for (const r of snap.units) {
      const id = r[0] as number;
      seen.add(id);
      let u = this.units.find((x) => x.id === id);
      if (!u) {
        u = this.hydrateUnit(r);
        this.units.push(u);
      }
      u.team = (r[2] as number) === 0 ? "radiant" : "dire";
      u.hp = r[5] as number;
      u.maxHp = r[6] as number;
      u.mana = r[7] as number;
      u.maxMana = r[8] as number;
      u.dead = (r[10] as number) === 1;
      u.level = r[12] as number;
      u.respawnIn = r[15] as number;
      u.hitFlash = r[16] as number;
      u.isPlayer = (r[17] as number) === 1;
      u.gold = r[18] as number;
      u.kills = r[19] as number;
      u.deaths = r[20] as number;
      u.assists = r[21] as number;
      u.abilityPoints = r[22] as number;
      if (u.abilities.length >= 4) {
        u.abilities[0].level = r[23] as number;
        u.abilities[0].cd = r[24] as number;
        u.abilities[1].level = r[25] as number;
        u.abilities[1].cd = r[26] as number;
        u.abilities[2].level = r[27] as number;
        u.abilities[2].cd = r[28] as number;
        u.abilities[3].level = r[29] as number;
        u.abilities[3].cd = r[30] as number;
      }
      const items = (r[31] as string).split(",").filter(Boolean);
      if (items.join() !== u.items.join()) {
        u.items = items;
        if (u.kind === "hero") this.recalc(u);
      }
      this.remoteTargets.set(id, { x: r[3] as number, y: r[4] as number });
    }
    this.units = this.units.filter((u) => seen.has(u.id));

    // ссылка на своего героя
    const me = this.units.find((u) => u.kind === "hero" && u.hero === this.playerHeroId && u.team === this.playerTeam);
    if (me) {
      this.player = me;
      // локальный маркер движения гаснет, когда герой дошёл
      if (me.moveTarget && Math.hypot(me.pos.x - me.moveTarget.x, me.pos.y - me.moveTarget.y) < 26) me.moveTarget = null;
      const at = me.attackTargetId != null ? this.byId(me.attackTargetId) : undefined;
      if (at && (at.dead || at.team === me.team)) me.attackTargetId = null;
    }

    this.projectiles = snap.proj.map((p) => ({
      id: nid(),
      team: (p[0] as number) === 0 ? ("radiant" as Team) : ("dire" as Team),
      kind: (p[1] as number) === 0 ? ("attack" as const) : (p[1] as number) === 1 ? ("spell" as const) : ("heal" as const),
      pos: { x: p[2] as number, y: p[3] as number },
      targetId: (p[4] as number) >= 0 ? (p[4] as number) : null,
      point: (p[5] as number) >= 0 ? { x: p[5] as number, y: p[6] as number } : null,
      tint: p[7] as string,
      speed: p[8] as number,
      damage: p[9] as number,
      splash: p[10] as number,
      magic: (p[11] as number) === 1,
      sourceId: p[12] as number,
      trail: 0,
    }));

    const EK: Effect["kind"][] = ["text", "ring", "spark", "slash"];
    this.effects = snap.fx.map((f) => ({
      kind: EK[f[0] as number],
      x: f[1] as number,
      y: f[2] as number,
      vx: 0,
      vy: (f[0] as number) === 0 ? -46 : (f[0] as number) === 2 ? 60 : 0,
      ttl: f[3] as number,
      maxTtl: f[4] as number,
      tint: f[5] as string,
      size: f[6] as number,
      text: (f[7] as string) || undefined,
    }));
  }

  private hydrateUnit(r: (number | string)[]): Unit {
    const kind = KIND_BY_CODE[r[1] as number];
    const team: Team = (r[2] as number) === 0 ? "radiant" : "dire";
    const u = makeUnit({ team, kind, pos: { x: r[3] as number, y: r[4] as number } });
    u.id = r[0] as number;
    u.radius = r[9] as number;
    u.tier = r[13] as number;
    u.lane = r[14] as number;
    if (kind === "hero") {
      const heroId = HEROES[r[11] as number]?.id ?? "akasha";
      u.hero = heroId;
      u.abilities = heroById(heroId).abilities.map(() => ({ level: 0, cd: 0 }));
      u.items = (r[31] as string).split(",").filter(Boolean);
      u.level = Math.max(1, r[12] as number);
      this.recalc(u);
    } else if (kind === "tower") {
      const s = TOWER_STATS[Math.min(3, Math.max(0, u.tier - 1))];
      u.dmg = s.dmg;
      u.armor = s.armor;
      u.atkRange = s.range;
      u.atkProj = 850;
    } else if (kind === "ancient") {
      u.dmg = ANCIENT_STATS.dmg;
      u.armor = ANCIENT_STATS.armor;
      u.atkRange = ANCIENT_STATS.range;
      u.atkProj = 800;
    } else if (kind === "fountain") {
      u.hp = 1e9;
      u.maxHp = 1e9;
    } else if (kind === "neutral") {
      u.camp = Math.max(0, u.tier - 1);
    }
    u.hp = r[5] as number;
    u.maxHp = r[6] as number;
    return u;
  }

  // ---------- snapshot для HUD ----------

  snapshot(): HudState {
    const u = this.player;
    const def = heroById(u.hero ?? "akasha");
    const towers = (team: Team) =>
      this.units.filter((t) => t.team === team && t.kind === "tower" && !t.dead).length +
      this.units.filter((t) => t.team === team && t.kind === "ancient" && !t.dead).length;
    const selUnit = this.selectedId != null ? this.byId(this.selectedId) : undefined;
    const selected =
      selUnit && isHeroLike(selUnit)
        ? (() => {
            const d = heroById(selUnit.hero ?? "akasha");
            return {
              id: selUnit.id,
              team: selUnit.team,
              heroId: selUnit.hero ?? d.id,
              name: d.name,
              title: d.title,
              color: d.color,
              level: selUnit.level,
              hp: Math.round(selUnit.hp),
              maxHp: Math.round(selUnit.maxHp),
              mana: Math.round(selUnit.mana),
              maxMana: Math.round(selUnit.maxMana),
              kills: selUnit.kills,
              deaths: selUnit.deaths,
              assists: selUnit.assists,
              items: [...selUnit.items],
              isPlayer: selUnit.isPlayer,
              dead: selUnit.dead,
            };
          })()
        : null;
    const card = (h: Unit): HeroCard => ({
      heroId: h.hero ?? "akasha",
      level: h.level,
      hp: Math.round(h.hp),
      maxHp: Math.round(h.maxHp),
      dead: h.dead,
      respawn: h.dead ? Math.max(0, Math.ceil(h.respawnIn)) : 0,
      isPlayer: h.isPlayer,
      kills: h.kills,
      deaths: h.deaths,
      gold: Math.floor(h.gold),
    });
    const teams = {
      radiant: this.units.filter((h) => isHeroLike(h) && h.team === "radiant").map(card),
      dire: this.units.filter((h) => isHeroLike(h) && h.team === "dire").map(card),
    };
    return {
      time: this.time,
      radiantKills: this.radiantKills,
      direKills: this.direKills,
      radiantTowers: towers("radiant"),
      direTowers: towers("dire"),
      nextWave: Math.max(0, this.waveTimer),
      over: this.over,
      selected,
      teams,
      channel: this.playerChannel ? 1 - this.playerChannel.t / this.playerChannel.dur : 0,
      player: {
        heroId: u.hero ?? def.id,
        hp: Math.round(u.hp),
        maxHp: Math.round(u.maxHp),
        mana: Math.round(u.mana),
        maxMana: Math.round(u.maxMana),
        level: u.level,
        xp: Math.round(u.xp),
        xpNext: xpForLevel(u.level),
        gold: Math.floor(u.gold),
        kills: u.kills,
        deaths: u.deaths,
        assists: u.assists,
        abilityPoints: u.abilityPoints,
        respawnIn: u.dead ? Math.max(0, u.respawnIn) : 0,
        items: [...u.items],
        abilities: u.abilities.map((a, i) => ({
          level: a.level,
          cd: a.cd,
          mana: def.abilities[i]?.mana ?? 0,
        })),
        dmg: Math.round(effDmg(u)),
        armor: Math.round(effArmor(u)),
        ms: Math.round(effMS(u)),
      },
      feed: this.feed.map((f) => ({ ...f })),
    };
  }
}
