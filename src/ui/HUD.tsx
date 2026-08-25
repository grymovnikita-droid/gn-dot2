import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { HeroCard, HudState, ItemDef, SelectedHero, Team } from "../game/types";
import { HEROES, ITEMS, heroById, itemById } from "../game/data";
import { getSpriteURL, subscribeSprites } from "../game/assets";
import { AbilityIcon, HeroEmblem, HeroPortrait, ItemIcon } from "./icons";

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

const STAT_LABEL: Record<string, string> = {
  dmg: "урон",
  hp: "здоровье",
  mana: "мана",
  armor: "броня",
  ms: "скорость",
  aspd: "скор. атаки",
  regen: "рег. здоровья",
  manaRegen: "рег. маны",
};
const STAT_TINT: Record<string, string> = {
  dmg: "#e0855a",
  hp: "#6cc97c",
  mana: "#6a9de0",
  armor: "#9fb4c9",
  ms: "#7cc9b8",
  aspd: "#e0c95a",
  regen: "#8fd98a",
  manaRegen: "#8ab8f0",
};

function StatChips({ item }: { item: ItemDef }) {
  const entries = Object.entries(item.stats).filter(([, v]) => v);
  if (entries.length === 0) return null;
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="rounded-sm px-1.5 py-px text-[10.5px] font-extrabold"
          style={{ background: `${STAT_TINT[k]}22`, color: STAT_TINT[k], border: `1px solid ${STAT_TINT[k]}44` }}
        >
          +{v} {STAT_LABEL[k] ?? k}
        </span>
      ))}
    </div>
  );
}

function TeamPanel({ team, cards }: { team: Team; cards: HeroCard[] }) {
  const isRad = team === "radiant";
  return (
    <div className="pointer-events-auto absolute top-12 flex gap-1.5" style={{ [isRad ? "left" : "right"]: 12 } as CSSProperties}>
      {cards.map((c, i) => {
        const def = heroById(c.heroId);
        const pct = Math.max(0, Math.min(1, c.hp / c.maxHp));
        return (
          <div
            key={`${c.heroId}-${i}`}
            className={`relative w-14 overflow-hidden rounded-sm border bg-[#0c120d]/90 transition-transform hover:scale-105 ${
              c.isPlayer ? "border-[#f0d27a]/80" : isRad ? "border-[#57d98a]/40" : "border-[#e05252]/40"
            }`}
            title={`${def.name} · ${c.kills}/${c.deaths} · ${c.gold} золота`}
          >
            <div className="relative flex h-14 items-center justify-center" style={{ background: `radial-gradient(circle at 40% 30%, ${def.color}30, #0b100c 80%)` }}>
              <HeroPortrait id={c.heroId} size={40} color={def.color} round={false} />
              {c.dead && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75">
                  <span className="font-display text-[16px] leading-none text-[#e05252]">{c.respawn}</span>
                  <span className="text-[8px] font-bold tracking-wider text-[#a89292]">СЕК</span>
                </div>
              )}
              <span className="absolute left-0.5 top-0.5 rounded-sm bg-black/70 px-1 text-[10px] font-extrabold text-[#f0d27a]">{c.level}</span>
              {c.isPlayer && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#f0d27a]" title="Это ты" />}
            </div>
            <div className="h-1.5 w-full bg-[#1a1410]">
              <div className={`h-full ${c.dead ? "bg-[#4a4a4a]" : isRad ? "bg-[#57d98a]" : "bg-[#e05252]"}`} style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SelectedHeroPanel({ sel, onClose }: { sel: SelectedHero; onClose: () => void }) {
  const isAlly = sel.team === "radiant";
  return (
    <div className="pointer-events-auto absolute right-4 top-[220px] w-[240px] rounded-lg border border-[#2a3428] bg-[#0d150e]/95 p-4 reveal-up" style={{ borderColor: `${sel.color}66` }}>
      <div className="flex items-center gap-3">
        <HeroPortrait id={sel.heroId} size={52} color={sel.color} />
        <div className="min-w-0">
          <div className="font-display truncate text-[16px] font-bold" style={{ color: sel.color }}>
            {sel.name}
          </div>
          <div className="text-[11px] font-semibold text-[#8a8471]">{sel.title}</div>
          <div className="text-[11px] font-bold" style={{ color: isAlly ? "#57d98a" : "#e05252" }}>
            {sel.isPlayer ? "ЭТО ТЫ" : isAlly ? "Союзник" : "Противник"} · Ур. {sel.level}
          </div>
        </div>
        <button onClick={onClose} className="ml-auto self-start text-[#8a8471] hover:text-[#e8e4d8]">
          ✕
        </button>
      </div>
      {sel.dead ? (
        <div className="mt-3 text-center text-[13px] font-bold text-[#e05252]">Повержен</div>
      ) : (
        <>
          <div className="mt-3 space-y-1.5">
            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#8a8471]">
                <span>ЗДОРОВЬЕ</span>
                <span>{sel.hp}/{sel.maxHp}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-[#1a1410]">
                <div className="h-full bg-[#57d98a]" style={{ width: `${(sel.hp / sel.maxHp) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#8a8471]">
                <span>МАНА</span>
                <span>{sel.mana}/{sel.maxMana}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-[#141a24]">
                <div className="h-full bg-[#5b8fd9]" style={{ width: `${(sel.mana / sel.maxMana) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[12px] font-bold">
            <span className="text-[#f0a0a0]">У {sel.kills}</span>
            <span className="text-[#8a8471]">С {sel.deaths}</span>
            <span className="text-[#a8d9f0]">П {sel.assists}</span>
          </div>
        </>
      )}
      <div className="mt-3">
        <div className="font-display mb-1.5 text-[11px] font-bold tracking-[0.3em] text-[#8a8471]">ИНВЕНТАРЬ</div>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 6 }, (_, i) => {
            const it = sel.items[i] ? itemById(sel.items[i]) : undefined;
            return (
              <div key={i} className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#2a3428] bg-[#10180f]" title={it ? `${it.name}: ${it.desc}` : "Пусто"}>
                {it && <ItemIcon icon={it.icon} size={17} color={it.tint} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface Props {
  hud: HudState;
  shopOpen: boolean;
  onToggleShop: () => void;
  onToggleWorkshop: () => void;
  onAbilityPress: (i: number) => void;
  onLearn: (i: number) => void;
  onBuy: (id: string) => void;
  onUseItem: (slot: number) => void;
  onTp: () => void;
  onDeselect: () => void;
  onExit: () => void;
}

export default function HUD({ hud, shopOpen, onToggleShop, onToggleWorkshop, onAbilityPress, onLearn, onBuy, onUseItem, onTp, onDeselect, onExit }: Props) {
  const p = hud.player;
  const def = heroById(p.heroId);
  const dead = p.respawnIn > 0;
  const hasTp = p.items.includes("tp");
  const [, force] = useState(0);
  useEffect(() => subscribeSprites(() => force((v) => v + 1)), []);

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* верхняя панель */}
      <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-4 rounded-md border border-[#d4a83f]/40 bg-[#0c120d]/90 px-5 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-display text-[22px] font-black text-[#57d98a]">{hud.radiantKills}</span>
          <span className="text-[11px] font-bold uppercase text-[#57d98a]/70">Свет</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-display text-[15px] font-bold text-[#e8e4d8]">{fmt(hud.time)}</span>
          <span className="text-[10px] font-semibold text-[#8a8471]">волна через {Math.ceil(hud.nextWave)}с</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-[#e05252]/70">Тьма</span>
          <span className="font-display text-[22px] font-black text-[#e05252]">{hud.direKills}</span>
        </div>
        <div className="ml-2 flex items-center gap-3 border-l border-[#2a3428] pl-4 text-[12px] font-bold">
          <span className="text-[#57d98a]">Башни {hud.radiantTowers}</span>
          <span className="text-[#e05252]">Башни {hud.direTowers}</span>
        </div>
      </div>

      {/* панели команд */}
      <TeamPanel team="radiant" cards={hud.teams.radiant} />
      <TeamPanel team="dire" cards={hud.teams.dire} />

      {/* килл-фид — под панелями команд, чтобы не налезал на иконки */}
      <div className="absolute right-4 top-[122px] flex w-[300px] flex-col items-end gap-1">
        {hud.feed.map((f) => (
          <div key={f.id} className="feed-in rounded-sm border border-[#2a3428] bg-[#0c120d]/85 px-3 py-1 text-[12.5px] font-bold" style={{ color: f.tint, opacity: Math.min(1, f.ttl / 0.8) }}>
            {f.text}
          </div>
        ))}
      </div>

      {/* панель выбранного героя */}
      {hud.selected && !dead && <SelectedHeroPanel sel={hud.selected} onClose={onDeselect} />}

      {/* нижняя панель */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 items-end gap-4">
        {/* статы */}
        <div className="gold-frame flex flex-col gap-1 rounded-md bg-[#10180f]/95 px-4 py-3 text-[12px] font-bold">
          <div className="flex items-center gap-2">
            <HeroPortrait id={p.heroId} size={40} color={def.color} />
            <div>
              <div className="font-display text-[14px] text-[#f0d27a]">{def.name}</div>
              <div className="text-[11px] text-[#8a8471]">Уровень {p.level}</div>
            </div>
          </div>
          <div className="text-[#e0855a]">Урон {p.dmg}</div>
          <div className="text-[#9fb4c9]">Броня {p.armor}</div>
          <div className="text-[#7cc9b8]">Скорость {p.ms}</div>
          <div className="text-[#f0d27a]">
            {p.kills}/{p.deaths}/{p.assists} · {p.gold}
          </div>
        </div>

        {/* способности */}
        <div className="gold-frame rounded-md bg-[#10180f]/95 px-4 py-3">
          <div className="flex items-end gap-2.5">
            {def.abilities.map((a, i) => {
              const st = p.abilities[i];
              const cdFrac = st.cd > 0 ? st.cd / (a.cd * (1 - 0.07 * (st.level - 1))) : 0;
              const noMana = p.mana < a.mana;
              const need = a.isUlt ? [6, 11, 16][st.level] ?? 99 : st.level * 2 + 1;
              const canLearn = p.abilityPoints > 0 && st.level < a.power.length && p.level >= need;
              return (
                <div key={a.key} className="relative">
                  <button
                    onClick={() => onAbilityPress(i)}
                    disabled={dead || st.level === 0}
                    className={`relative h-14 w-14 overflow-hidden rounded-sm border transition-transform active:scale-95 ${
                      a.isUlt ? "border-[#f0d27a]/60" : "border-[#3a4a3c]"
                    } ${st.level === 0 ? "opacity-50" : noMana ? "opacity-80" : "hover:brightness-125"}`}
                    style={{ background: `radial-gradient(circle at 35% 28%, ${a.tint}30, #0d130e 80%)` }}
                    title={`${a.name}: ${a.desc} (${a.mana} маны)`}
                  >
                    <div className="flex h-full w-full items-center justify-center">
                      <AbilityIcon kind={a.kind} size={26} color={a.isUlt ? "#f0d27a" : a.tint} />
                    </div>
                    {st.cd > 0 && (
                      <>
                        <div className="absolute inset-0 bg-black/70" style={{ clipPath: `inset(0 0 ${(1 - cdFrac) * 100}% 0)` }} />
                        <div className="absolute inset-0 flex items-center justify-center font-display text-[15px] text-white">{Math.ceil(st.cd)}</div>
                      </>
                    )}
                    <div className="absolute left-0.5 top-0.5 text-[10px] font-extrabold text-[#f0d27a]">{a.key}</div>
                    {st.level > 0 && (
                      <div className="absolute bottom-0.5 right-1 text-[10px] font-extrabold text-[#c9c2ae]">{st.level}</div>
                    )}
                  </button>
                  {canLearn && (
                    <button
                      onClick={() => onLearn(i)}
                      className="learn-pulse absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f0d27a] text-[13px] font-black text-[#241c08]"
                      title="Изучить умение"
                    >
                      +
                    </button>
                  )}
                  <div className="mt-1 flex justify-center gap-0.5">
                    {a.power.map((_, lvl) => (
                      <span key={lvl} className={`h-1 w-2 rounded-sm ${lvl < st.level ? "bg-[#f0d27a]" : "bg-[#2a3428]"}`} />
                    ))}
                  </div>
                </div>
              );
            })}
            {/* телепорт */}
            <div className="relative ml-1">
              <button
                onClick={onTp}
                disabled={dead || !hasTp}
                className={`flex h-14 w-14 items-center justify-center rounded-sm border transition-transform active:scale-95 ${
                  hasTp ? "border-[#c9a0f0]/70 bg-[#1c1424] hover:brightness-125" : "border-[#3a4a3c] bg-[#10180f] opacity-45"
                }`}
                title="Свиток телепорта: на базу или свою вышку (T)"
              >
                <ItemIcon icon="scroll" size={26} color="#c9a0f0" />
                {hud.channel > 0 && (
                  <div className="absolute inset-0 bg-[#c9a0f0]/25" style={{ clipPath: `inset(${(1 - hud.channel) * 100}% 0 0 0)` }} />
                )}
              </button>
              <div className="mt-1 text-center text-[10px] font-extrabold text-[#c9a0f0]">T</div>
            </div>
          </div>
        </div>

        {/* инвентарь */}
        <div className="gold-frame rounded-md bg-[#10180f]/95 px-4 py-3">
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 6 }, (_, i) => {
              const it = p.items[i] ? itemById(p.items[i]) : undefined;
              const usable = it?.consumable && it.id === "tp";
              return (
                <button
                  key={i}
                  onClick={() => usable && onUseItem(i)}
                  disabled={!usable}
                  className={`flex h-9 w-9 items-center justify-center rounded-sm border transition-transform ${
                    usable ? "cursor-pointer border-[#c9a0f0]/70 bg-[#1c1424] hover:scale-110 active:scale-95" : "border-[#2a3428] bg-[#10180f]"
                  }`}
                  title={it ? `${it.name}: ${it.desc}${usable ? " (клик — телепорт)" : ""}` : "Пустой слот"}
                >
                  {it && <ItemIcon icon={it.icon} size={20} color={it.tint} />}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-col gap-1">
            <button onClick={onToggleShop} className="btn-war rounded-sm px-3 py-1.5 text-[12px] font-black">
              ЛАВКА · B
            </button>
            <button onClick={onToggleWorkshop} className="rounded-sm border border-[#4a5a44] bg-[#1a241c] px-3 py-1 text-[10.5px] font-black tracking-wider text-[#a8d98a] transition-all hover:brightness-125 active:scale-95" title="Замена иконок и ландшафта">
              МАСТЕРСКАЯ
            </button>
          </div>
        </div>
      </div>

      {/* лавка */}
      {shopOpen && (
        <div className="pointer-events-auto absolute bottom-[130px] left-1/2 w-[560px] -translate-x-1/2 rounded-lg border border-[#d4a83f]/40 bg-[#0d150e]/97 p-4 reveal-up">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-[18px] font-black tracking-wider text-[#f0d27a]">ЛАВКА ПРЕДМЕТОВ</div>
            <div className="flex items-center gap-4">
              <span className="text-[14px] font-extrabold text-[#f0d27a]">{p.gold} золота</span>
              <button onClick={onToggleShop} className="text-[#8a8471] hover:text-white">✕</button>
            </div>
          </div>
          <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto pr-1">
            {ITEMS.map((it) => {
              const afford = p.gold >= it.cost;
              const full = p.items.length >= 6;
              const owned = p.items.filter((x) => x === it.id).length;
              return (
                <button
                  key={it.id}
                  onClick={() => onBuy(it.id)}
                  disabled={!afford || full}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-all ${
                    afford && !full ? "border-[#3a4a3c] bg-[#10180f] hover:border-[#d4a83f]/60 hover:bg-[#161f13] active:scale-[0.98]" : "border-[#241f18] bg-[#0c100b] opacity-45"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#2a3428] bg-[#0c120d]">
                    <ItemIcon icon={it.icon} size={24} color={it.tint} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[#e8e4d8]">{it.name}</div>
                    {it.consumable ? (
                      <div className="text-[11px] font-semibold text-[#c9a0f0]">{it.desc}</div>
                    ) : (
                      <>
                        <div className="text-[11px] font-semibold text-[#8a8471]">{it.desc}</div>
                        <StatChips item={it} />
                      </>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-[13px] font-extrabold ${afford ? "text-[#f0d27a]" : "text-[#8a5a4a]"}`}>{it.cost}</div>
                    {owned > 0 && <div className="text-[10px] font-bold text-[#8a8471]">×{owned}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* экран смерти */}
      {dead && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#2a0f0f]/45">
          <div className="text-center reveal-up">
            <div className="font-display text-[42px] font-black tracking-widest text-[#e05252]" style={{ textShadow: "0 0 30px rgba(224,82,82,0.6)" }}>
              ТЫ ПАЛ В БОЮ
            </div>
            <div className="mt-2 text-[16px] font-bold text-[#e8e4d8]">
              Возрождение через <span className="font-display text-[#f0d27a]">{Math.ceil(p.respawnIn)}</span> сек
            </div>
          </div>
        </div>
      )}

      {/* финал */}
      {hud.over && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/80">
          <div className="text-center reveal-up">
            <div
              className={`font-display text-[64px] font-black tracking-[0.15em] ${hud.over === "victory" ? "text-[#f0d27a]" : "text-[#e05252]"}`}
              style={{ textShadow: hud.over === "victory" ? "0 0 60px rgba(240,210,122,0.5)" : "0 0 60px rgba(224,82,82,0.5)" }}
            >
              {hud.over === "victory" ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
            </div>
            <div className="mt-3 text-[16px] font-bold text-[#c9c2ae]">
              {hud.over === "victory" ? "Древний Трон Тьмы разрушен!" : "Древний Трон Света пал..."} Счёт {hud.radiantKills}:{hud.direKills} за {fmt(hud.time)}
            </div>
            <div className="mt-2 text-[14px] font-bold text-[#8a8471]">
              Твой герой: {p.kills} убийств / {p.deaths} смертей / {p.assists} помощи
            </div>
            <button onClick={onExit} className="btn-war pulse-gold mt-8 rounded-md px-10 py-4 text-[19px] font-black">
              В МЕНЮ
            </button>
          </div>
        </div>
      )}

      {/* подсказка слева снизу над миникартой */}
      <div className="absolute bottom-[240px] left-4 text-[11px] font-semibold text-[#8a8471]/80">
        Пробел — камера · Колесо — зум · S — стоп · B — лавка · T — телепорт
      </div>
    </div>
  );
}
