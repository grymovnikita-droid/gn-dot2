// Мастерская: замена иконок юнитов и ландшафта своими картинками (например, из Доты 2).
import { useEffect, useRef, useState } from "react";
import { HEROES } from "../game/data";
import {
  PRESETS,
  TERRAIN_KEY,
  UNIT_KEYS,
  clearSprite,
  getSpriteURL,
  loadImageFile,
  setProcedural,
  setSprite,
  subscribeSprites,
} from "../game/assets";
import { HeroEmblem } from "./icons";

function Slot({ label, spriteKey, sub }: { label: string; spriteKey: string; sub?: string }) {
  const [url, setUrl] = useState<string | null>(getSpriteURL(spriteKey));
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => subscribeSprites((k) => (k === spriteKey ? setUrl(getSpriteURL(k)) : undefined)), [spriteKey]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const img = await loadImageFile(f);
      setSprite(spriteKey, img);
    } catch {
      alert("Не удалось прочитать картинку. Нужен PNG/JPG.");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-[#2a3428] bg-[#10180f] px-3 py-2">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[#3a4a3c] bg-[#0c120d]">
        {url ? (
          <img src={url} className="h-full w-full object-contain" draggable={false} alt="" />
        ) : spriteKey.startsWith("hero:") ? (
          <HeroEmblem id={spriteKey.split(":")[1]} size={30} color={HEROES.find((h) => `hero:${h.id}` === spriteKey)?.color} />
        ) : (
          <span className="text-[10px] font-bold text-[#5a6a58]">НЕТ</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-[#e8e4d8]">{label}</div>
        {sub && <div className="text-[11px] font-semibold text-[#8a8471]">{sub}</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()} className="rounded-sm border border-[#4a5a44] bg-[#1a241c] px-2 py-1 text-[11px] font-bold text-[#a8d98a] hover:brightness-125 active:scale-95">
        Загрузить
      </button>
      <button
        onClick={() => clearSprite(spriteKey)}
        disabled={!url}
        className="rounded-sm border border-[#5a3a3a] bg-[#241516] px-2 py-1 text-[11px] font-bold text-[#e08a8a] hover:brightness-125 active:scale-95 disabled:opacity-30"
      >
        Сброс
      </button>
    </div>
  );
}

function TerrainSlot() {
  const [url, setUrl] = useState<string | null>(getSpriteURL(TERRAIN_KEY));
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => subscribeSprites((k) => (k === TERRAIN_KEY ? setUrl(getSpriteURL(k)) : undefined)), []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const img = await loadImageFile(f);
      setSprite(TERRAIN_KEY, img);
    } catch {
      alert("Не удалось прочитать картинку.");
    }
  };

  return (
    <div className="rounded-md border border-[#2a3428] bg-[#10180f] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[14px] font-bold text-[#e8e4d8]">Ландшафт карты</div>
          <div className="text-[11.5px] font-semibold text-[#8a8471]">
            Квадратная картинка (например, карта из Доты 2) натянется на всю карту. Тропы, базы и лагеря рисуются поверх.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-sm border border-[#3a4a3c] bg-[#0c120d]">
          {url ? <img src={url} className="h-full w-full object-cover" draggable={false} alt="" /> : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#5a6a58]">СТАНДАРТ</div>}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} className="rounded-sm border border-[#4a5a44] bg-[#1a241c] px-3 py-1.5 text-[12px] font-bold text-[#a8d98a] hover:brightness-125 active:scale-95">
            Загрузить картинку
          </button>
          <button
            onClick={() => clearSprite(TERRAIN_KEY)}
            disabled={!url}
            className="rounded-sm border border-[#5a3a3a] bg-[#241516] px-3 py-1.5 text-[12px] font-bold text-[#e08a8a] hover:brightness-125 active:scale-95 disabled:opacity-30"
          >
            Вернуть стандартный
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Workshop({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"units" | "terrain" | "packs">("units");
  if (!open) return null;

  const heroKeys = UNIT_KEYS.filter((k) => k.key.startsWith("hero:"));
  const unitKeys = UNIT_KEYS.filter((k) => !k.key.startsWith("hero:"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gold-frame reveal-up flex h-[82vh] w-[860px] max-w-[94vw] flex-col rounded-lg bg-[#0d150e]">
        <div className="flex items-center justify-between border-b border-[#2a3428] px-6 py-4">
          <div>
            <div className="font-display text-[22px] font-black tracking-[0.1em] text-[#f0d27a]">МАСТЕРСКАЯ</div>
            <div className="text-[12px] font-semibold text-[#8a8471]">Меняй иконки героев, крипов, катапульты, нейтралов, зданий и сам ландшафт карты</div>
          </div>
          <button onClick={onClose} className="rounded-sm border border-[#3a4a3c] bg-[#151d14] px-3 py-1.5 text-[12px] font-bold text-[#c9c2ae] hover:brightness-125 active:scale-95">
            ЗАКРЫТЬ · ESC
          </button>
        </div>

        <div className="flex gap-2 border-b border-[#2a3428] px-6 py-3">
          {(
            [
              ["units", "Иконки юнитов"],
              ["terrain", "Ландшафт"],
              ["packs", "Готовые паки"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`font-display rounded-sm px-4 py-1.5 text-[13px] tracking-wider transition-all ${
                tab === id ? "border border-[#d4a83f]/70 bg-[#2c2310] text-[#f0d27a]" : "border border-[#2a3428] bg-[#10180f] text-[#8a8471] hover:text-[#c9c2ae]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {tab === "units" && (
            <div className="space-y-5">
              <div>
                <div className="font-display mb-2 text-[12px] font-bold tracking-[0.3em] text-[#8a8471]">ГЕРОИ</div>
                <div className="grid grid-cols-2 gap-2">
                  {heroKeys.map((k) => (
                    <Slot key={k.key} label={k.label} spriteKey={k.key} sub="Квадратная иконка — в круг героя" />
                  ))}
                </div>
              </div>
              <div>
                <div className="font-display mb-2 text-[12px] font-bold tracking-[0.3em] text-[#8a8471]">КРИПЫ · НЕЙТРАЛЫ · ЗДАНИЯ</div>
                <div className="grid grid-cols-2 gap-2">
                  {unitKeys.map((k) => (
                    <Slot
                      key={k.key}
                      label={k.label}
                      spriteKey={k.key}
                      sub={k.key === "siege" ? "Меняется сразу у обеих команд" : "Сторона Тьмы получает красный оттенок"}
                    />
                  ))}
                </div>
                <div className="mt-2 text-[11.5px] font-semibold text-[#8a8471]">
                  Одна иконка работает для обеих команд: у Тьмы автоматически добавляется красный оттенок, у Света — зелёный.
                </div>
              </div>
            </div>
          )}
          {tab === "terrain" && <TerrainSlot />}
          {tab === "packs" && (
            <div className="space-y-3">
              <div className="text-[12.5px] font-semibold text-[#8a8471]">
                Встроенный пак рисованных спрайтов «Разлом» — можно применить одной кнопкой и сравнить со своими картинками.
              </div>
              {PRESETS.map((p) => (
                <div key={p.name} className="flex items-center justify-between rounded-md border border-[#2a3428] bg-[#10180f] px-4 py-3">
                  <div className="text-[14px] font-bold text-[#e8e4d8]">{p.name}</div>
                  <button
                    onClick={() => p.apply()}
                    className="rounded-sm border border-[#d4a83f]/60 bg-[#2c2310] px-3 py-1.5 text-[12px] font-bold text-[#f0d27a] hover:brightness-125 active:scale-95"
                  >
                    Применить
                  </button>
                </div>
              ))}
              <div className="rounded-md border border-[#2a3428] bg-[#10180f] px-4 py-3">
                <div className="text-[14px] font-bold text-[#e8e4d8]">Процедурные иконки крипов и нейтралов</div>
                <div className="mt-1 text-[12px] font-semibold text-[#8a8471]">Отдельные кнопки для точечной замены:</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {UNIT_KEYS.filter((k) => !k.key.startsWith("hero:")).map((k) => (
                    <button
                      key={k.key}
                      onClick={() => setProcedural(k.key)}
                      className="rounded-sm border border-[#4a5a44] bg-[#1a241c] px-2.5 py-1 text-[11px] font-bold text-[#a8d98a] hover:brightness-125 active:scale-95"
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
