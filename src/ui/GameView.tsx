import { useEffect, useRef, useState } from "react";
import type { GameSetup, NetCmd, Vec } from "../game/types";
import { GameEngine } from "../game/engine";
import type { NetSnap } from "../game/engine";
import { Renderer } from "../game/render";
import { WORLD, heroById, opposite } from "../game/data";
import { sfx } from "../game/audio";
import { TERRAIN_KEY, subscribeSprites } from "../game/assets";
import type { NetRole, NetSession } from "../net/session";
import HUD from "./HUD";
import Workshop from "./Workshop";

export interface NetInfo {
  session: NetSession;
  role: NetRole;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const minimapRect = (vw: number, vh: number) => {
  const size = Math.min(210, vw * 0.18);
  return { x: 14, y: vh - size - 14, w: size, h: size };
};

export default function GameView({ heroId, setup, net, onExit }: { heroId: string; setup?: GameSetup; net?: NetInfo; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const [hud, setHud] = useState(() => null as ReturnType<GameEngine["snapshot"]> | null);
  const [shopOpen, setShopOpenState] = useState(false);
  const shopRef = useRef(false);
  const [workshopOpen, setWorkshopOpenState] = useState(false);
  const workshopRef = useRef(false);
  const [targeting, setTargetingState] = useState<number | null>(null);
  const targetingRef = useRef<number | null>(null);
  const [tpTargeting, setTpTargetingState] = useState(false);
  const tpSlotRef = useRef<number | null>(null);
  const [connLost, setConnLost] = useState<string | null>(null);

  const isHost = net?.role === "host";
  const isGuest = net?.role === "guest";

  const setShopOpen = (v: boolean) => {
    shopRef.current = v;
    setShopOpenState(v);
  };
  const setWorkshopOpen = (v: boolean) => {
    workshopRef.current = v;
    setWorkshopOpenState(v);
    targetingRef.current = null;
    tpSlotRef.current = null;
    setTpTargetingState(false);
    const rd = rendererRef.current;
    if (rd) {
      rd.targeting = null;
      rd.tpMode = false;
    }
  };
  const setTargeting = (v: number | null) => {
    targetingRef.current = v;
    setTargetingState(v);
    const rd = rendererRef.current;
    if (rd) rd.targeting = null;
  };
  const setTpTargeting = (v: boolean) => {
    tpSlotRef.current = v ? tpSlotRef.current : null;
    setTpTargetingState(v);
    const rd = rendererRef.current;
    if (rd) rd.tpMode = v;
  };

  // отправка команды (гость) или прямое действие (локально/хост)
  const sendCmd = (k: NetCmd["k"], extra: Partial<NetCmd> = {}) => {
    net?.session.send({ t: "cmd", cmd: { t: "cmd", k, ...extra } });
  };

  const enterTp = () => {
    const en = engineRef.current;
    if (!en || en.player.dead || en.over) return;
    const slot = en.getTpSlot();
    if (slot === -1) {
      sfx.error();
      en.pushFeed("Нет свитка телепорта — купи в лавке за 100 золота", "#c9a0f0");
      setHud(en.snapshot());
      return;
    }
    tpSlotRef.current = slot;
    setTpTargeting(true);
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const en = new GameEngine(heroId, setup);
    const rd = new Renderer(en, cv);
    engineRef.current = en;
    rendererRef.current = rd;
    
    // Вызываем resize сразу и с задержкой, чтобы canvas успел получить размеры
    rd.resize();
    setTimeout(() => rd.resize(), 100);

    if (isHost && net) {
      net.session.ev.onCmd = (d) => en.remoteCmd(d as NetCmd);
      net.session.ev.onSnap = undefined;
    }
    if (isGuest && net) {
      net.session.ev.onSnap = (s) => en.applySnapshot(s as NetSnap);
      net.session.ev.onCmd = undefined;
    }
    if (net) {
      net.session.ev.onClose = (reason) => setConnLost(reason);
    }

    const onResize = () => rd.resize();
    window.addEventListener("resize", onResize);

    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock);

    let snapInt: number | undefined;
    if (isHost && net) {
      const s = net.session;
      snapInt = window.setInterval(() => {
        if (s.conn && s.conn.open) s.send({ t: "snap", snap: en.netSnapshot() });
      }, 80);
    }

    const unsubSprites = subscribeSprites((key) => {
      if (key === TERRAIN_KEY) rd.rebakeTerrain();
    });

    let raf = 0;
    let lastT = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      if (!workshopRef.current) en.update(dt);
      rd.draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    setHud(en.snapshot());
    const hudInt = window.setInterval(() => setHud(en.snapshot()), 120);

    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === "KeyB") {
        ev.preventDefault();
        setShopOpen(!shopRef.current);
      } else if (ev.code === "KeyT") {
        ev.preventDefault();
        enterTp();
      } else if (ev.code === "Space") {
        ev.preventDefault();
        en.camFree = 0;
        en.camTarget = { ...en.player.pos };
      } else if (ev.code === "KeyS") {
        en.player.moveTarget = null;
        en.player.attackTargetId = null;
        en.playerChannel = null;
        if (isGuest) sendCmd("stop");
      } else if (ev.code === "Escape") {
        if (workshopRef.current) setWorkshopOpen(false);
        else if (shopRef.current) setShopOpen(false);
        else {
          setTargeting(null);
          setTpTargeting(false);
          en.selectedId = null;
        }
      } else {
        const map: Record<string, number> = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyR: 3 };
        if (map[ev.code] !== undefined) pressAbility(map[ev.code]);
      }
    };
    window.addEventListener("keydown", onKey);

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      en.zoom = clamp(en.zoom * (ev.deltaY > 0 ? 0.9 : 1.1), 0.38, 1.15);
    };
    cv.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(hudInt);
      if (snapInt) clearInterval(snapInt);
      unsubSprites();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", unlock);
      cv.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pressAbility = (i: number) => {
    const en = engineRef.current;
    if (!en || en.player.dead || en.over) return;
    const def = heroById(heroId).abilities[i];
    const st = en.player.abilities[i];

    if (isGuest) {
      if (!def || st.level <= 0 || st.cd > 0 || en.player.mana < def.mana) {
        sfx.error();
        return;
      }
      if (def.kind === "aoe" || def.kind === "dash") {
        const rd = rendererRef.current;
        if (rd) rd.targeting = { kind: "point", radius: def.radius ?? 0, range: def.range };
        setTargeting(i);
      } else if (def.needsTarget) {
        const rd = rendererRef.current;
        if (rd) rd.targeting = { kind: "target", radius: 0, range: def.range };
        setTargeting(i);
      } else sendCmd("castS", { idx: i });
      return;
    }

    const res = en.beginCast(i);
    if (res === "point" || res === "target") {
      const rd = rendererRef.current;
      if (rd) rd.targeting = { kind: res, radius: def.radius ?? 0, range: def.range };
      setTargeting(i);
    } else if (res === "done") {
      setHud(en.snapshot());
    }
  };

  const resolveTargeting = (ti: number, world: Vec) => {
    const en = engineRef.current;
    if (!en) return;
    const def = heroById(heroId).abilities[ti];
    if (isGuest) {
      if (def.kind === "nuke") {
        const t = en.pickAt(world, en.player.team);
        if (t) sendCmd("castT", { idx: ti, id: t.id });
      } else if (def.kind === "heal" || (def.kind === "buff" && def.needsTarget)) {
        const t = en.pickAt(world, opposite(en.player.team));
        if (t) sendCmd("castT", { idx: ti, id: t.id });
        else sendCmd("castS", { idx: ti });
      } else {
        sendCmd("castP", { idx: ti, x: world.x, y: world.y });
      }
      return;
    }
    if (def.kind === "nuke") {
      const t = en.pickAt(world, en.player.team);
      if (t) en.castAtTarget(ti, t.id);
    } else if (def.kind === "heal" || (def.kind === "buff" && def.needsTarget)) {
      const t = en.pickAt(world, opposite(en.player.team));
      const ok = t ? en.castAtTarget(ti, t.id) : false;
      if (!ok) en.castAtTarget(ti, en.player.id);
    } else {
      en.castAtPoint(ti, world);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rd = rendererRef.current;
    if (rd) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        rd.mouseWorld = rd.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const en = engineRef.current;
    const rd = rendererRef.current;
    if (!en || !rd) return;
    
    // Получаем координаты относительно canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    // Отладка
    console.log('Click:', { sx, sy, viewW: rd.viewW, viewH: rd.viewH, camera: en.camera, zoom: en.zoom });
    const isRightClick = e.button === 2;
    const isLeftClick = e.button === 0;

    // миникарта работает на обе кнопки
    const mm = minimapRect(rd.viewW, rd.viewH);
    if (sx >= mm.x - 4 && sx <= mm.x + mm.w + 4 && sy >= mm.y - 4 && sy <= mm.y + mm.h + 4) {
      en.camTarget = { x: clamp(((sx - mm.x) / mm.w) * WORLD, 0, WORLD), y: clamp(((sy - mm.y) / mm.h) * WORLD, 0, WORLD) };
      en.camFree = 4;
      return;
    }

    const world = rd.screenToWorld(sx, sy);

    // ПКМ — отмена таргетинга/телепорта
    if (isRightClick) {
      if (tpSlotRef.current !== null) {
        setTpTargeting(false);
        return;
      }
      if (targetingRef.current !== null) {
        setTargeting(null);
        return;
      }
    }

    // ЛКМ — выбор цели телепорта
    if (isLeftClick && tpSlotRef.current !== null) {
      const s = en.pickStructureAt(world, en.player.team);
      if (s) {
        if (isGuest) sendCmd("tp", { slot: tpSlotRef.current, id: s.id });
        else en.confirmTp(tpSlotRef.current, s.id);
        setTpTargeting(false);
        setHud(en.snapshot());
      }
      return;
    }

    // ЛКМ — выбор цели способности
    if (isLeftClick && targetingRef.current !== null) {
      resolveTargeting(targetingRef.current, world);
      setTargeting(null);
      setHud(en.snapshot());
      return;
    }

    // ПКМ — клик по герою для разведданных (ЛКМ тоже работает)
    const heroUnder = en.pickHeroAt(world);
    if (heroUnder && isRightClick) {
      en.selectedId = heroUnder.id;
      setHud(en.snapshot());
      return;
    }

    // ПКМ — движение и атака
    if (isRightClick) {
      const enemy = en.pickAt(world, en.player.team);
      if (enemy) {
        if (isGuest) {
          sendCmd("attack", { id: enemy.id });
          en.player.attackTargetId = enemy.id;
          en.player.moveTarget = null;
        } else en.orderAttack(enemy.id);
      } else {
        en.selectedId = null;
        if (isGuest) {
          sendCmd("move", { x: world.x, y: world.y });
          en.player.moveTarget = en.clampToWorld(world);
          en.player.attackTargetId = null;
        } else en.orderMove(world);
      }
    }
  };

  const exitToMenu = () => {
    net?.session.close();
    onExit();
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b100d]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />

      {hud && (
        <HUD
          hud={hud}
          shopOpen={shopOpen}
          onToggleShop={() => setShopOpen(!shopRef.current)}
          onToggleWorkshop={() => setWorkshopOpen(!workshopRef.current)}
          onAbilityPress={pressAbility}
          onLearn={(i) => {
            const en = engineRef.current;
            if (!en) return;
            if (isGuest) {
              const def = heroById(heroId).abilities[i];
              const st = en.player.abilities[i];
              const need = def.isUlt ? [6, 11, 16][st.level] ?? 99 : st.level * 2 + 1;
              if (en.player.abilityPoints <= 0 || st.level >= def.power.length || en.player.level < need) return;
              sendCmd("learn", { idx: i });
            } else {
              en.learnAbility(i);
            }
            setHud(en.snapshot());
          }}
          onBuy={(id) => {
            const en = engineRef.current;
            if (!en) return;
            if (isGuest) sendCmd("buy", { id });
            else en.buyItem(id);
            setHud(en.snapshot());
          }}
          onUseItem={() => enterTp()}
          onTp={() => enterTp()}
          onDeselect={() => {
            const en = engineRef.current;
            if (en) {
              en.selectedId = null;
              setHud(en.snapshot());
            }
          }}
          onExit={exitToMenu}
        />
      )}

      {(targeting !== null || tpTargeting) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[140px] flex justify-center">
          <div className="rounded-sm border border-[#d4a83f]/50 bg-[#0c120d]/90 px-4 py-1.5 text-[13px] font-bold text-[#f0d27a]">
            {tpTargeting ? "Телепорт: кликни по союзной вышке или базе · ПКМ — отмена" : "Выбери цель кликом · ESC — отмена"}
          </div>
        </div>
      )}

      {workshopOpen && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-sm border border-[#d4a83f]/50 bg-[#0c120d]/90 px-4 py-1.5 text-[13px] font-bold text-[#f0d27a]">
          ПАУЗА · Мастерская открыта
        </div>
      )}

      {connLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85">
          <div className="gold-frame reveal-up rounded-lg bg-[#0d150e] px-12 py-10 text-center">
            <div className="font-display text-[30px] font-black tracking-widest text-[#e05252]">СОЕДИНЕНИЕ ПОТЕРЯНО</div>
            <div className="mt-2 text-[14px] font-semibold text-[#8a8471]">{connLost}</div>
            <button onClick={onExit} className="btn-war mt-6 rounded-md px-8 py-3 text-[16px] font-black">
              В МЕНЮ
            </button>
          </div>
        </div>
      )}

      <Workshop open={workshopOpen} onClose={() => setWorkshopOpen(false)} />
    </div>
  );
}
