// Сетевое лобби: хост создаёт комнату (код), гость вводит код.
// Работает через PeerJS (WebRTC) — сервер не нужен, подходит для GitHub Pages.
import { useMemo, useState } from "react";
import type { NetMode } from "../game/types";
import { HEROES, heroById } from "../game/data";
import { NetSession } from "../net/session";
import type { NetRole } from "../net/session";
import { HeroPortrait } from "./icons";

type Phase = "root" | "hostLobby" | "guestWait";

function Embers() {
  const embers = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: (i * 151) % 100,
        size: 3 + ((i * 47) % 6),
        dur: 8 + ((i * 83) % 9),
        delay: -((i * 29) % 12),
        op: 0.2 + ((i * 13) % 50) / 100,
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

function HeroGrid({ value, onChange, disabledIds, cols = 5 }: { value: string | null; onChange: (id: string) => void; disabledIds: string[]; cols?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {HEROES.map((h) => {
        const dis = disabledIds.includes(h.id);
        const act = value === h.id;
        return (
          <button
            key={h.id}
            disabled={dis}
            onClick={() => onChange(h.id)}
            className={`flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 transition-all ${
              act
                ? "border-[#f0d27a] bg-[#22291a] shadow-[0_0_24px_rgba(240,210,122,0.25)]"
                : dis
                ? "cursor-not-allowed border-[#241f18] bg-[#0c100b] opacity-35"
                : "border-[#2a3428] bg-[#10180f] hover:border-[#4a5a44] hover:-translate-y-0.5"
            }`}
            title={dis ? "Занят другим игроком" : `${h.name} — ${h.role}`}
          >
            <HeroPortrait id={h.id} size={44} color={h.color} />
            <span className={`text-[11.5px] font-bold ${act ? "text-[#f0d27a]" : "text-[#c9c2ae]"}`}>{h.name}</span>
            <span className="text-[9.5px] font-semibold uppercase tracking-wide text-[#8a8471]">{h.role}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function NetScreen({
  onStart,
  onExit,
}: {
  onStart: (session: NetSession, role: NetRole, heroId: string, info: { radiant: string[]; dire: string[]; mode: NetMode }) => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("root");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [hostHero, setHostHero] = useState<string | null>(null);
  const [guestHero, setGuestHero] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [mode, setMode] = useState<NetMode>("coop");
  const [guestOnline, setGuestOnline] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<NetSession | null>(null);
  const [copied, setCopied] = useState(false);

  const startHost = () => {
    if (!hostHero) return;
    setError("");
    const s = NetSession.host({
      onOpen: (c) => setCode(c),
      onGuestJoin: () => {
        setGuestOnline(true);
        s.send({ t: "lobby", code: s.code, hostHero, taken: [hostHero] });
      },
      onHello: (hero) => {
        const final = hero === hostHero ? HEROES.find((h) => h.id !== hostHero)!.id : hero;
        setGuestHero(final);
        s.send({ t: "lobby", code: s.code, hostHero, taken: [hostHero] });
      },
      onClose: (r) => {
        setPhase("root");
        setGuestOnline(false);
        setGuestHero(null);
        setError(r);
      },
      onError: (m) => setError(m),
    });
    setSession(s);
    setPhase("hostLobby");
  };

  const startJoin = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length < 4) {
      setError("Введи код комнаты (6 символов)");
      return;
    }
    setError("");
    setTaken([]);
    const s = NetSession.join(c, {
      onLobby: (info) => {
        setTaken(info.taken ?? []);
        setCode(info.code);
        setPhase("guestWait");
      },
      onMode: (m) => setMode(m),
      onStart: (msg) => {
        onStart(s, "guest", msg.guestHero, { radiant: msg.radiant, dire: msg.dire, mode: msg.mode });
      },
      onClose: (r) => {
        setPhase("root");
        setError(r);
      },
      onError: (m) => {
        setError(m);
        setPhase("root");
      },
    });
    setSession(s);
  };

  const pickGuestHero = (id: string) => {
    setGuestHero(id);
    session?.send({ t: "hello", hero: id });
  };

  const changeMode = (m: NetMode) => {
    setMode(m);
    session?.send({ t: "mode", mode: m });
  };

  const launch = () => {
    if (!session || !hostHero || !guestHero) return;
    const rest = HEROES.map((h) => h.id).filter((h) => h !== hostHero && h !== guestHero);
    // перемешать для разнообразия
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const radiant = mode === "coop" ? [hostHero, guestHero, ...rest.slice(0, 3)] : [hostHero, ...rest.slice(0, 4)];
    const dire = mode === "coop" ? rest.slice(3, 8) : [guestHero, ...rest.slice(4, 8)];
    session.send({ t: "start", radiant, dire, guestHero, hostHero, mode });
    onStart(session, "host", hostHero, { radiant, dire, mode });
  };

  const leave = () => {
    session?.close();
    setSession(null);
    setPhase("root");
    setGuestOnline(false);
    setGuestHero(null);
    setTaken([]);
  };

  const copy = () => {
    try {
      void navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden" style={{ background: "radial-gradient(120% 90% at 50% 10%, #17202a 0%, #0e1318 45%, #080b0e 100%)" }}>
      <Embers />

      {phase === "root" && (
        <div className="relative z-10 w-[880px] max-w-[94vw] reveal-up">
          <div className="mb-8 text-center">
            <div className="font-display text-[13px] font-bold tracking-[0.5em] text-[#7a8a9a]">СЕТЕВАЯ ИГРА · P2P (WEBRTC)</div>
            <h1 className="font-display mt-1 text-[38px] font-black tracking-[0.08em] text-[#e8e4d8]">
              СОВМЕСТНАЯ <span className="text-[#f0d27a]">БИТВА</span>
            </h1>
            <p className="mt-2 text-[14px] font-semibold text-[#8a9aa8]">
              Выложи игру на GitHub Pages, скинь другу код комнаты — и играйте вдвоём против ботов или друг против друга.
            </p>
          </div>

          {error && <div className="mx-auto mb-5 w-fit rounded-sm border border-[#e05252]/50 bg-[#241516] px-4 py-2 text-[13px] font-bold text-[#e08a8a]">{error}</div>}

          <div className="grid grid-cols-2 gap-6">
            <div className="gold-frame rounded-lg bg-[#0d141a]/90 p-6">
              <div className="font-display text-[20px] font-black tracking-wider text-[#f0d27a]">СОЗДАТЬ КОМНАТУ</div>
              <div className="mt-1 text-[12.5px] font-semibold text-[#8a9aa8]">Шаг 1 — выбери своего героя</div>
              <div className="mt-3">
                <HeroGrid value={hostHero} onChange={setHostHero} disabledIds={[]} />
              </div>
              <button onClick={startHost} disabled={!hostHero} className="btn-war mt-5 w-full rounded-md px-6 py-3.5 text-[17px] font-black disabled:cursor-not-allowed disabled:opacity-40">
                СОЗДАТЬ КОМНАТУ
              </button>
            </div>

            <div className="gold-frame rounded-lg bg-[#0d141a]/90 p-6">
              <div className="font-display text-[20px] font-black tracking-wider text-[#8fd9e8]">ПРИСОЕДИНИТЬСЯ</div>
              <div className="mt-1 text-[12.5px] font-semibold text-[#8a9aa8]">Введи код комнаты от друга</div>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={8}
                className="font-display mt-4 w-full rounded-md border border-[#3a4a54] bg-[#0a0f14] px-4 py-3.5 text-center text-[26px] font-black tracking-[0.4em] text-[#e8e4d8] outline-none placeholder:text-[#3a4a54] focus:border-[#8fd9e8]"
                onKeyDown={(e) => e.key === "Enter" && startJoin()}
              />
              <button onClick={startJoin} disabled={joinCode.trim().length < 4} className="mt-4 w-full rounded-md border border-[#8fd9e8]/60 bg-[#10222a] px-6 py-3.5 font-display text-[17px] font-black tracking-[0.14em] text-[#8fd9e8] transition-all hover:brightness-125 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">
                ПОДКЛЮЧИТЬСЯ
              </button>
              <div className="mt-5 rounded-md border border-[#243038] bg-[#0a0f14] p-3 text-[12px] font-semibold leading-relaxed text-[#7a8a9a]">
                Работает через бесплатный сигнальный сервер PeerJS: данные идут напрямую между браузерами, свой сервер не нужен.
              </div>
            </div>
          </div>

          <button onClick={onExit} className="mx-auto mt-6 block rounded-sm border border-[#3a4a54] bg-[#101820] px-5 py-2 text-[13px] font-bold text-[#8a9aa8] transition-all hover:brightness-125">
            ← НАЗАД В МЕНЮ
          </button>
        </div>
      )}

      {phase === "hostLobby" && (
        <div className="relative z-10 w-[760px] max-w-[94vw] reveal-up">
          <div className="gold-frame rounded-lg bg-[#0d141a]/90 p-7">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-[13px] font-bold tracking-[0.4em] text-[#7a8a9a]">КОМНАТА СОЗДАНА</div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-display text-[44px] font-black tracking-[0.3em] text-[#f0d27a]" style={{ textShadow: "0 0 30px rgba(240,210,122,0.35)" }}>
                    {code || "······"}
                  </span>
                  <button onClick={copy} className="rounded-sm border border-[#d4a83f]/60 bg-[#2c2310] px-3 py-1.5 text-[12px] font-bold text-[#f0d27a] hover:brightness-125 active:scale-95">
                    {copied ? "СКОПИРОВАНО" : "КОПИРОВАТЬ"}
                  </button>
                </div>
                <div className="mt-1 text-[12.5px] font-semibold text-[#8a9aa8]">Скинь код другу — пусть жмёт «Присоединиться»</div>
              </div>
              <button onClick={leave} className="rounded-sm border border-[#5a3a3a] bg-[#241516] px-3 py-1.5 text-[12px] font-bold text-[#e08a8a] hover:brightness-125">
                ЗАКРЫТЬ
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-5">
              <div className="rounded-md border border-[#243038] bg-[#0a0f14] p-4">
                <div className="font-display text-[12px] font-bold tracking-[0.3em] text-[#7a8a9a]">ТЫ · {heroById(hostHero ?? "akasha").name}</div>
                <div className="mt-3 flex justify-center">
                  <HeroPortrait id={hostHero ?? "akasha"} size={84} color={heroById(hostHero ?? "akasha").color} />
                </div>
              </div>
              <div className={`rounded-md border p-4 ${guestOnline ? "border-[#57d98a]/50 bg-[#0f1a12]" : "border-[#243038] bg-[#0a0f14]"}`}>
                <div className="font-display text-[12px] font-bold tracking-[0.3em] text-[#7a8a9a]">ДРУГ</div>
                {guestOnline && guestHero ? (
                  <>
                    <div className="mt-3 flex justify-center">
                      <HeroPortrait id={guestHero} size={84} color={heroById(guestHero).color} />
                    </div>
                    <div className="mt-2 text-center text-[14px] font-bold text-[#57d98a]">{heroById(guestHero).name} готов!</div>
                  </>
                ) : guestOnline ? (
                  <div className="mt-6 text-center text-[14px] font-bold text-[#e0c95a]">Подключился — выбирает героя…</div>
                ) : (
                  <div className="mt-6 text-center text-[14px] font-bold text-[#7a8a9a]">Ожидание подключения…</div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="font-display mb-2 text-[12px] font-bold tracking-[0.3em] text-[#7a8a9a]">РЕЖИМ ИГРЫ</div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => changeMode("coop")} className={`rounded-md border px-4 py-3 text-left transition-all ${mode === "coop" ? "border-[#57d98a] bg-[#122418]" : "border-[#243038] bg-[#0a0f14] hover:border-[#3a4a54]"}`}>
                  <div className={`font-display text-[15px] font-black ${mode === "coop" ? "text-[#57d98a]" : "text-[#c9c2ae]"}`}>ПЛЕЧОМ К ПЛЕЧУ</div>
                  <div className="text-[12px] font-semibold text-[#7a8a9a]">Вы вдвоём + 3 бота Света против 5 ботов Тьмы</div>
                </button>
                <button onClick={() => changeMode("versus")} className={`rounded-md border px-4 py-3 text-left transition-all ${mode === "versus" ? "border-[#e05252] bg-[#241214]" : "border-[#243038] bg-[#0a0f14] hover:border-[#3a4a54]"}`}>
                  <div className={`font-display text-[15px] font-black ${mode === "versus" ? "text-[#e05252]" : "text-[#c9c2ae]"}`}>ДРУГ ПРОТИВ ДРУГА</div>
                  <div className="text-[12px] font-semibold text-[#7a8a9a]">Ты за Свет + 4 бота, друг за Тьму + 4 бота</div>
                </button>
              </div>
            </div>

            <button onClick={launch} disabled={!guestHero} className="btn-war pulse-gold mt-6 w-full rounded-md px-6 py-4 text-[20px] font-black disabled:cursor-not-allowed disabled:opacity-40">
              НАЧАТЬ БИТВУ
            </button>
          </div>
        </div>
      )}

      {phase === "guestWait" && (
        <div className="relative z-10 w-[760px] max-w-[94vw] reveal-up">
          <div className="gold-frame rounded-lg bg-[#0d141a]/90 p-7">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-[13px] font-bold tracking-[0.4em] text-[#7a8a9a]">КОМНАТА {code}</div>
                <div className="font-display mt-1 text-[26px] font-black text-[#8fd9e8]">ВЫБОР ГЕРОЯ</div>
              </div>
              <button onClick={leave} className="rounded-sm border border-[#5a3a3a] bg-[#241516] px-3 py-1.5 text-[12px] font-bold text-[#e08a8a] hover:brightness-125">
                ВЫЙТИ
              </button>
            </div>
            <div className="mt-4">
              <HeroGrid value={guestHero} onChange={pickGuestHero} disabledIds={taken} />
            </div>
            <div className="mt-5 flex items-center justify-between rounded-md border border-[#243038] bg-[#0a0f14] px-4 py-3">
              <div className="text-[13px] font-bold text-[#c9c2ae]">
                Режим: <span className={mode === "coop" ? "text-[#57d98a]" : "text-[#e05252]"}>{mode === "coop" ? "ПЛЕЧОМ К ПЛЕЧУ" : "ДРУГ ПРОТИВ ДРУГА"}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#e0c95a]">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#e0c95a]" />
                Ждём, когда хост начнёт битву…
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
