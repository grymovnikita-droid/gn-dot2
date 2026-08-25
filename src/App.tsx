import { useMemo, useState } from "react";
import type { GameSetup } from "./game/types";
import type { NetRole, NetSession } from "./net/session";
import HeroSelect from "./ui/HeroSelect";
import NetScreen from "./ui/NetScreen";
import GameView from "./ui/GameView";

interface GameCfg {
  heroId: string;
  setup?: GameSetup;
  net?: { session: NetSession; role: NetRole };
}

type Screen = { k: "menu" } | { k: "local" } | { k: "net" } | ({ k: "game" } & GameCfg);

function MenuEmbers() {
  const embers = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: (i * 149) % 100,
        size: 3 + ((i * 59) % 6),
        dur: 7 + ((i * 97) % 10),
        delay: -((i * 37) % 12),
        op: 0.2 + ((i * 19) % 55) / 100,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((e, i) => (
        <span key={i} className="ember" style={{ left: `${e.left}%`, width: e.size, height: e.size, opacity: e.op, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s` }} />
      ))}
    </div>
  );
}

function Menu({ onLocal, onNet }: { onLocal: () => void; onNet: () => void }) {
  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden" style={{ background: "radial-gradient(120% 90% at 50% 10%, #17251a 0%, #0e1710 45%, #080d09 100%)" }}>
      <MenuEmbers />
      <div className="relative z-10 text-center reveal-up">
        <div className="font-display text-[14px] font-bold tracking-[0.6em] text-[#8a8471]">MOBA · 5 НА 5 · ВИД СВЕРХУ</div>
        <h1 className="font-display mt-2 text-[72px] font-black leading-none tracking-[0.06em] text-[#f0d27a]" style={{ textShadow: "0 0 60px rgba(212,168,63,0.45)" }}>
          ДРЕВНИЙ РАЗЛОМ
        </h1>
        <div className="mt-3 text-[15px] font-semibold text-[#a8a392]">
          Три линии · Вышки Т1–Т4 · Лес с нейтралами · Свитки телепорта · Мастерская скинов
        </div>
      </div>

      <div className="relative z-10 mt-12 grid w-[720px] max-w-[92vw] grid-cols-2 gap-6 reveal-up" style={{ animationDelay: "0.12s" }}>
        <button onClick={onLocal} className="gold-frame group rounded-lg bg-[#0d150e]/85 p-7 text-left transition-all hover:-translate-y-1 hover:shadow-[0_14px_50px_rgba(87,217,138,0.15)]">
          <div className="flex items-center gap-3">
            <svg width="34" height="34" viewBox="0 0 24 24">
              <g stroke="#57d98a" strokeWidth="2" fill="none" strokeLinecap="round">
                <path d="M12 3l2.2 5.3L20 9l-4.4 3.7L17 19l-5-3.2L7 19l1.4-6.3L4 9l5.8-.7z" />
              </g>
            </svg>
            <span className="font-display text-[22px] font-black tracking-wider text-[#e8e4d8] group-hover:text-[#57d98a]">ЛОКАЛЬНАЯ ИГРА</span>
          </div>
          <div className="mt-3 text-[13px] font-semibold leading-relaxed text-[#8a8471]">
            Ты + 4 бота Света против 5 ботов Тьмы. Классический матч с прокачкой, лавкой и лесными лагерями.
          </div>
        </button>

        <button onClick={onNet} className="gold-frame group rounded-lg bg-[#0d150e]/85 p-7 text-left transition-all hover:-translate-y-1 hover:shadow-[0_14px_50px_rgba(143,217,232,0.15)]">
          <div className="flex items-center gap-3">
            <svg width="34" height="34" viewBox="0 0 24 24">
              <g stroke="#8fd9e8" strokeWidth="2" fill="none" strokeLinecap="round">
                <circle cx="6" cy="12" r="2.6" />
                <circle cx="18" cy="6" r="2.6" />
                <circle cx="18" cy="18" r="2.6" />
                <path d="M8.4 10.8 15.6 7M8.4 13.2l7.2 3.6" />
              </g>
            </svg>
            <span className="font-display text-[22px] font-black tracking-wider text-[#e8e4d8] group-hover:text-[#8fd9e8]">СЕТЕВАЯ ИГРА</span>
          </div>
          <div className="mt-3 text-[13px] font-semibold leading-relaxed text-[#8a8471]">
            Создай комнату и скинь код другу (P2P через PeerJS — работает даже на GitHub Pages). Вместе против ботов или друг против друга.
          </div>
        </button>
      </div>

      <div className="relative z-10 mt-10 text-[12px] font-semibold text-[#5a6a58] reveal-up" style={{ animationDelay: "0.22s" }}>
        ЛКМ/ПКМ — движение и атака · QWER — способности · B — лавка · T — телепорт · Пробел — камера · Колесо — зум
      </div>
    </div>
  );
}

export default function App() {
  const [scr, setScr] = useState<Screen>({ k: "menu" });
  const [run, setRun] = useState(0);

  if (scr.k === "local") {
    return (
      <HeroSelect
        onBack={() => setScr({ k: "menu" })}
        onStart={(h) => {
          setRun((r) => r + 1);
          setScr({ k: "game", heroId: h });
        }}
      />
    );
  }

  if (scr.k === "net") {
    return (
      <NetScreen
        onExit={() => setScr({ k: "menu" })}
        onStart={(session, role, heroId, info) => {
          const guestHero = info.mode === "coop" ? info.radiant[1] : info.dire[0];
          const setup: GameSetup =
            role === "host"
              ? { radiant: info.radiant, dire: info.dire, playerHero: heroId, playerTeam: "radiant", remoteHero: guestHero }
              : { radiant: info.radiant, dire: info.dire, playerHero: heroId, playerTeam: info.radiant.includes(heroId) ? "radiant" : "dire", remoteMode: true };
          setRun((r) => r + 1);
          setScr({ k: "game", heroId, setup, net: { session, role } });
        }}
      />
    );
  }

  if (scr.k === "game") {
    return <GameView key={run} heroId={scr.heroId} setup={scr.setup} net={scr.net} onExit={() => setScr({ k: "menu" })} />;
  }

  return <Menu onLocal={() => setScr({ k: "local" })} onNet={() => setScr({ k: "net" })} />;
}
