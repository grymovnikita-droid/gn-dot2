import { useEffect, useMemo, useState } from "react";
import { HEROES, heroById } from "../game/data";
import { subscribeSprites } from "../game/assets";
import { AbilityIcon, HeroPortrait } from "./icons";
import Workshop from "./Workshop";

const ATTR_NAME: Record<string, string> = { str: "Сила", agi: "Ловкость", int: "Интеллект" };

function Embers() {
  const embers = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: (i * 137) % 100,
        size: 3 + ((i * 53) % 6),
        dur: 7 + ((i * 91) % 9),
        delay: -((i * 31) % 12),
        op: 0.25 + ((i * 17) % 50) / 100,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            opacity: e.op,
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function StatBar({ label, value, max, tint }: { label: string; value: number; max: number; tint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[#a8a392]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-[#1a241c] ring-1 ring-black/50">
        <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${(value / max) * 100}%`, background: tint }} />
      </div>
      <span className="w-12 text-right text-[13px] font-bold text-[#e8e4d8]">{value}</span>
    </div>
  );
}

export default function HeroSelect({ onStart, onBack }: { onStart: (heroId: string) => void; onBack?: () => void }) {
  const [sel, setSel] = useState("korvas");
  const [workshop, setWorkshop] = useState(false);
  const [, force] = useState(0);
  useEffect(() => subscribeSprites(() => force((v) => v + 1)), []);
  const h = heroById(sel);

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "radial-gradient(120% 90% at 50% 10%, #17251a 0%, #0e1710 45%, #080d09 100%)" }}
    >
      <Embers />

      <header className="relative z-10 flex items-end justify-between px-10 pt-7 reveal-up">
        <div>
          <div className="font-display text-[13px] font-bold tracking-[0.5em] text-[#8a8471]">МОБА · 5 НА 5 · БОТЫ</div>
          <h1 className="font-display mt-1 text-[40px] font-black leading-none tracking-[0.08em] text-[#f0d27a]" style={{ textShadow: "0 0 34px rgba(212,168,63,0.4)" }}>
            ДРЕВНИЙ РАЗЛОМ
          </h1>
        </div>
        <div className="flex items-center gap-4 pb-2">
          <div className="text-right text-[13px] font-semibold text-[#8a8471]">
            Три линии · Лес с нейтралами · Вышки Т1–Т4
            <br />
            <span className="text-[#c9b878]">Цель — разрушить Древний Трон врага</span>
          </div>
          <button
            onClick={() => setWorkshop(true)}
            className="rounded-sm border border-[#4a5a44] bg-[#1a241c] px-3 py-2 text-[12px] font-black tracking-wider text-[#a8d98a] transition-all hover:brightness-125 active:scale-95"
          >
            МАСТЕРСКАЯ
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 gap-6 px-10 py-5">
        <div className="flex w-[300px] shrink-0 flex-col gap-2.5 overflow-y-auto pr-1 reveal-up" style={{ animationDelay: "0.08s" }}>
          <div className="font-display mb-1 flex items-center justify-between text-[12px] font-bold tracking-[0.35em] text-[#8a8471]">
            <span>ВЫБОР ГЕРОЯ</span>
            {onBack && (
              <button onClick={onBack} className="rounded-sm border border-[#3a4a3c] bg-[#151d14] px-2 py-1 text-[11px] font-bold tracking-normal text-[#c9c2ae] hover:brightness-125">
                ← МЕНЮ
              </button>
            )}
          </div>
          {HEROES.map((hero) => {
            const active = hero.id === sel;
            return (
              <button
                key={hero.id}
                onClick={() => setSel(hero.id)}
                className={`group flex items-center gap-4 rounded-md px-4 py-2.5 text-left transition-all duration-200 ${
                  active
                    ? "gold-frame bg-[#1c2417] pulse-gold"
                    : "border border-[#2a3428] bg-[#10180f]/80 hover:border-[#4a5a44] hover:bg-[#161f13] hover:translate-x-1"
                }`}
              >
                <div
                  className="flex h-13 w-13 shrink-0 items-center justify-center rounded-md p-1"
                  style={{ background: `radial-gradient(circle at 35% 30%, ${hero.color}33, #0c120d 75%)`, border: `1px solid ${hero.color}66` }}
                >
                  <HeroPortrait id={hero.id} size={38} color={hero.color} />
                </div>
                <div className="min-w-0">
                  <div className={`font-display text-[16px] font-bold tracking-wide ${active ? "text-[#f0d27a]" : "text-[#e8e4d8]"}`}>{hero.name}</div>
                  <div className="truncate text-[12px] font-semibold text-[#8a8471]">{hero.title}</div>
                  <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: hero.color }}>
                    {hero.role}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div key={h.id} className="gold-frame relative flex min-w-0 flex-1 flex-col rounded-lg bg-[#0d150e]/85 px-9 py-5 reveal-up" style={{ animationDelay: "0.14s" }}>
          <div className="flex min-h-0 flex-1 gap-8">
            <div className="flex w-[230px] shrink-0 flex-col items-center justify-center">
              <div
                className="floaty flex h-40 w-40 items-center justify-center rounded-full"
                style={{ background: `radial-gradient(circle at 40% 32%, ${h.color}44, #0b110c 72%)`, border: `2px solid ${h.color}88`, boxShadow: `0 0 60px ${h.color}33` }}
              >
                <HeroPortrait id={h.id} size={118} color={h.color} />
              </div>
              <div className="font-display mt-5 text-center text-[32px] font-black leading-tight tracking-wide text-[#f0ead2]">{h.name}</div>
              <div className="text-center text-[14px] font-semibold italic text-[#a8a392]">«{h.title}»</div>
              <div className="mt-3 flex gap-2">
                <span className="rounded-sm px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: `${h.color}22`, color: h.color, border: `1px solid ${h.color}55` }}>
                  {ATTR_NAME[h.attr]}
                </span>
                <span className="rounded-sm border border-[#4a5a44] bg-[#1a241c] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#c9c2ae]">{h.role}</span>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-5">
              <div className="space-y-2">
                <StatBar label="Здоровье" value={h.baseHp} max={800} tint="#57d98a" />
                <StatBar label="Мана" value={h.baseMana} max={460} tint="#5b8fd9" />
                <StatBar label="Урон" value={h.baseDmg} max={70} tint="#e0a052" />
                <StatBar label="Броня" value={h.baseArmor} max={6} tint="#9fb4c9" />
                <StatBar label="Скорость" value={h.moveSpeed} max={330} tint="#8fd9c9" />
                <StatBar label="Дальность" value={h.atkRange} max={650} tint="#b7a4f0" />
              </div>
              <div>
                <div className="font-display mb-2 text-[12px] font-bold tracking-[0.35em] text-[#8a8471]">СПОСОБНОСТИ</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {h.abilities.map((a) => (
                    <div key={a.key} className="flex items-start gap-2.5 rounded-md border border-[#2a3428] bg-[#10180f] px-3 py-2">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${a.isUlt ? "border border-[#f0d27a]/60 bg-[#2c2310]" : "border border-[#3a4a3c] bg-[#151d14]"}`}>
                        <AbilityIcon kind={a.kind} size={18} color={a.isUlt ? "#f0d27a" : a.tint} />
                      </div>
                      <div className="min-w-0">
                        <span className="mr-1.5 inline-block rounded-sm bg-[#22301f] px-1.5 text-[11px] font-extrabold text-[#c9d8a0]">{a.key}</span>
                        <span className={`text-[13px] font-bold ${a.isUlt ? "text-[#f0d27a]" : "text-[#e8e4d8]"}`}>{a.name}</span>
                        <div className="mt-0.5 text-[11.5px] leading-snug text-[#8a8471]">{a.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-[280px] shrink-0 flex-col gap-3 reveal-up" style={{ animationDelay: "0.2s" }}>
          <div className="gold-frame rounded-lg bg-[#0d150e]/85 p-4">
            <div className="font-display mb-2.5 text-[12px] font-bold tracking-[0.35em] text-[#8a8471]">УПРАВЛЕНИЕ</div>
            <ul className="space-y-1.5 text-[12.5px] font-semibold text-[#c9c2ae]">
              {[
                ["ЛКМ / ПКМ", "движение и атака"],
                ["Q W E R", "способности"],
                ["Клик по кнопке", "изучить умение"],
                ["B", "лавка предметов"],
                ["T", "телепорт (свиток)"],
                ["Клик по герою", "иконка и инвентарь"],
                ["Пробел", "камера на героя"],
                ["Колесо", "приблизить / отдалить"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 rounded-sm border border-[#3a4a3c] bg-[#151d14] px-1.5 py-0.5 text-[11px] font-extrabold text-[#f0d27a]">{k}</span>
                  <span className="text-right">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="gold-frame rounded-lg bg-[#0d150e]/85 p-4">
            <div className="font-display mb-2.5 text-[12px] font-bold tracking-[0.35em] text-[#8a8471]">ХОД БИТВЫ</div>
            <ul className="space-y-1.5 text-[12.5px] font-semibold leading-snug text-[#c9c2ae]">
              <li>• Волна каждые 30с: <span className="text-[#e8e4d8]">3 мечника, 1 стрелок, 1 катапульта</span></li>
              <li>• Добивай крипов — золото и опыт</li>
              <li>• Лагеря нейтралов подсвечены в лесу</li>
              <li>• Тропинки-срезы: мид → топ и бот</li>
              <li>• Телепорт на базу или свою вышку (T)</li>
              <li>• Снеси вышки Т1→Т4 и Древний Трон</li>
            </ul>
          </div>
          <button onClick={() => onStart(sel)} className="btn-war pulse-gold mt-auto rounded-md px-6 py-4 text-[22px] font-black">
            В БОЙ
          </button>
        </div>
      </div>

      <Workshop open={workshop} onClose={() => setWorkshop(false)} />
    </div>
  );
}
