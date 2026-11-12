import { useEffect } from "react";
import {
  Building2,
  Car,
  Coins,
  Factory,
  Home,
  Landmark,
  Pickaxe,
  Scale,
  ThermometerSun,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import type { Meters } from "@workspace/api-client-react";

export type MeterKey = keyof Meters;

export const normalizeRoomCode = (value: string) => value.toUpperCase().replace(/\s/g, "");
export const isValidRoomCode = (value: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(value);

export const METERS: { key: MeterKey; label: string; icon: LucideIcon; color: string }[] = [
  { key: "climate", label: "Klimaziel", icon: ThermometerSun, color: "hsl(var(--chart-1))" },
  { key: "population", label: "Bevölkerung", icon: Users, color: "hsl(var(--chart-2))" },
  { key: "economy", label: "Wirtschaft", icon: TrendingUp, color: "hsl(var(--chart-3))" },
  { key: "treasury", label: "Staatskasse", icon: Coins, color: "hsl(var(--chart-4))" },
  { key: "reelection", label: "Wiederwahl", icon: Vote, color: "hsl(var(--chart-5))" },
];

export const ROLE_META: Record<string, { label: string; icon: LucideIcon; tint: string }> = {
  state: { label: "Staat", icon: Landmark, tint: "hsl(var(--chart-4))" },
  business: { label: "Unternehmen", icon: Building2, tint: "hsl(var(--chart-3))" },
  citizen: { label: "Bürger", icon: Users, tint: "hsl(var(--chart-2))" },
};

export const ROUND_ICONS: LucideIcon[] = [Car, Pickaxe, Factory, Home];

export const STANCES = [
  { id: "support", label: "Unterstützen", icon: ThumbsUp, tint: "hsl(var(--chart-1))" },
  { id: "accept", label: "Akzeptieren", icon: Scale, tint: "hsl(var(--chart-3))" },
  { id: "oppose", label: "Dagegen", icon: ThumbsDown, tint: "hsl(var(--chart-2))" },
] as const;

export const PHASE_LABEL: Record<string, string> = {
  role: "Rollen lesen",
  decision: "Staat entscheidet",
  reaction: "Reaktionen",
  effects: "Folgen",
  finished: "Fertig",
};

export function errorText(err: unknown): string {
  if (!err) return "";
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^HTTP \d+[^:]*:\s*/, "") || "Etwas ist schiefgelaufen.";
}

export function errorStatus(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return null;
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Klimaschutz – Das Rollenspiel` : "Klimaschutz – Das Rollenspiel";
  }, [title]);
}

const T_KEY = "klima:teacherRooms";
const S_KEY = "klima:studentRoom";

export function rememberTeacherRoom(code: string) {
  const list = getTeacherRooms().filter((c) => c !== code);
  localStorage.setItem(T_KEY, JSON.stringify([code, ...list].slice(0, 3)));
}
export function getTeacherRooms(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(T_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function rememberStudentRoom(code: string, name: string) {
  localStorage.setItem(S_KEY, JSON.stringify({ code, name }));
}
export function getStudentRoom(): { code: string; name: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(S_KEY) || "null");
    return v && typeof v.code === "string" ? v : null;
  } catch {
    return null;
  }
}
export function forgetRooms() {
  localStorage.removeItem(T_KEY);
  localStorage.removeItem(S_KEY);
}

export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
