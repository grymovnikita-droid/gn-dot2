import type { ReactNode } from "react";
import type { AbilityKind } from "../game/types";
import { getSpriteURL } from "../game/assets";

export function HeroEmblem({ id, size = 48, color }: { id: string; size?: number; color?: string }) {
  const c = color ?? "#e8e4d8";
  const paths: Record<string, ReactNode> = {
    akasha: (
      <g stroke={c} strokeWidth="2.6" fill="none">
        <circle cx="12" cy="12" r="9" strokeDasharray="7 4" />
        <circle cx="12" cy="12" r="3.2" fill={c} stroke="none" />
      </g>
    ),
    bramble: (
      <g fill={c}>
        <path d="M12 2.5 14.5 8.5l6 .4-4.6 4 1.5 6L12 15.5l-5.4 3.4 1.5-6-4.6-4 6-.4z" opacity="0.45" />
        <path d="M12 6l1.8 4.4 4.6.3-3.6 3 1.2 4.6L12 15.8l-4 2.5 1.2-4.6-3.6-3 4.6-.3z" />
      </g>
    ),
    sylvara: (
      <g fill={c}>
        <path d="M15.5 2.8A9.5 9.5 0 1 0 21 14.5 8 8 0 0 1 15.5 2.8z" />
        <circle cx="17" cy="7" r="1.4" opacity="0.8" />
      </g>
    ),
    korvas: (
      <g fill={c}>
        <path d="M5 3c2 4 3 6 4.4 7.6L4 19l3.4-1.2L9 21l1.6-3.2L12.2 21l1.6-3.2L15.4 21l1.6-3.2L18.6 19l1.4-2.6-5.4-8.8C16 6 17 4 19 3c-3 .6-5 1.6-7 4-2-2.4-4-3.4-7-4z" />
      </g>
    ),
    lumen: (
      <g stroke={c} strokeWidth="2.4" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.6" fill={c} stroke="none" opacity="0.9" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
      </g>
    ),
    kaira: (
      <g stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17" />
        <path d="M12 5.5 9.8 3.6M12 5.5l2.2-1.9M12 18.5l-2.2 1.9M12 18.5l2.2 1.9" />
      </g>
    ),
    run: (
      <g fill={c}>
        <path d="M13.2 2 5 13.4h4.8L9 22l8.3-11.8h-4.9L13.2 2z" />
      </g>
    ),
    noktis: (
      <g fill={c}>
        <path d="M14.8 2.6A9.6 9.6 0 1 0 21.4 15a10.8 10.8 0 0 1-6.6-12.4z" />
        <path d="M15.4 3.6l1.2 2.6 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6L11.6 7.4l2.6-1.2z" opacity="0.7" />
      </g>
    ),
    urgot: (
      <g fill={c}>
        <path d="M6.2 3.5c1 5.6 2.2 8.6 5.8 15.5 3.6-6.9 4.8-9.9 5.8-15.5-2.8 2.8-4 3.8-5.8 3.8s-3-1-5.8-3.8z" />
      </g>
    ),
    solara: (
      <g stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" fill={c} stroke="none" />
        <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
      </g>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ filter: `drop-shadow(0 0 ${size / 8}px ${c}55)` }}>
      {paths[id] ?? paths.akasha}
    </svg>
  );
}

// Портрет: кастом из Мастерской или встроенная эмблема
export function HeroPortrait({ id, size, color, round = true }: { id: string; size: number; color: string; round?: boolean }) {
  const url = getSpriteURL(`hero:${id}`);
  if (url) {
    return (
      <span
        className="flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size, borderRadius: round ? "50%" : 6, border: `2px solid ${color}` }}
      >
        <img src={url} alt={id} className="h-full w-full object-cover" draggable={false} />
      </span>
    );
  }
  return <HeroEmblem id={id} size={size} color={color} />;
}

export function AbilityIcon({ kind, size = 22, color = "#e8e4d8" }: { kind: AbilityKind; size?: number; color?: string }) {
  const node: Record<AbilityKind, ReactNode> = {
    nuke: (
      <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
      </g>
    ),
    aoe: (
      <g stroke={color} strokeWidth="2" fill="none">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
      </g>
    ),
    buff: (
      <g stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V6M6 12l6-6 6 6" />
        <path d="M7 20h10" />
      </g>
    ),
    heal: (
      <g fill={color}>
        <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" />
      </g>
    ),
    dash: (
      <g stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5l7 7-7 7" />
        <path d="M13 5l7 7-7 7" />
      </g>
    ),
    ult_aoe: (
      <g fill={color}>
        <path d="M12 1.5 14.6 8l6.9.4-5.3 4.4 1.7 6.7L12 15.8l-5.9 3.7 1.7-6.7-5.3-4.4L9.4 8z" />
      </g>
    ),
    aoeheal: (
      <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
        <path d="M12 7v10M7 12h10" strokeWidth="2.6" />
      </g>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {node[kind]}
    </svg>
  );
}

export function ItemIcon({ icon, size = 26, color }: { icon: string; size?: number; color?: string }) {
  const c = color ?? "#c9c2ae";
  const node: Record<string, ReactNode> = {
    scroll: (
      <g stroke={c} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M8 4h9v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-2h8" />
        <path d="M8 4a3 3 0 0 0-3 3v2h8V7a3 3 0 0 0-3-3Z" />
        <path d="M9 11h5M9 14h4" />
      </g>
    ),
    sword: (
      <g stroke={c} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M5 19 17 7M17 7l2-4-4 2M5 19l-2 2M7.5 16.5l2 2" />
      </g>
    ),
    shield: (
      <g stroke={c} strokeWidth="2" fill="none" strokeLinejoin="round">
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
        <path d="M12 7v8" strokeLinecap="round" />
      </g>
    ),
    ring: (
      <g stroke={c} strokeWidth="2.4" fill="none">
        <circle cx="12" cy="13" r="6" />
        <path d="M12 7 9.5 3.5h5L12 7z" fill={c} />
      </g>
    ),
    boots: (
      <g stroke={c} strokeWidth="2" fill="none" strokeLinejoin="round">
        <path d="M7 3h6v8l4 3v4H7z" />
        <path d="M7 14h6" />
      </g>
    ),
    gem: (
      <g stroke={c} strokeWidth="2" fill="none" strokeLinejoin="round">
        <path d="M12 3l6 5-6 13L6 8z" />
        <path d="M6 8h12M12 3 9 8l3 13M12 3l3 5-3 13" />
      </g>
    ),
    leaf: (
      <g stroke={c} strokeWidth="2" fill="none" strokeLinejoin="round">
        <path d="M5 19C5 9 12 4 20 4c0 8-5 15-15 15z" />
        <path d="M5 19c3-5 7-9 11-11" strokeLinecap="round" />
      </g>
    ),
    drum: (
      <g stroke={c} strokeWidth="2" fill="none">
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </g>
    ),
    claw: (
      <g stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path d="M6 4c1 6 3 10 6 16M12 20c3-6 5-10 6-16M9 5c.7 5 1.8 8.5 3 12M15 5c-.7 5-1.8 8.5-3 12" />
      </g>
    ),
    heart: (
      <g fill={c}>
        <path d="M12 21C6 16 3 12.5 3 8.8 3 6 5 4 7.6 4 9.5 4 11 5 12 6.6 13 5 14.5 4 16.4 4 19 4 21 6 21 8.8c0 3.7-3 7.2-9 12.2z" />
      </g>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {node[icon] ?? node.gem}
    </svg>
  );
}
