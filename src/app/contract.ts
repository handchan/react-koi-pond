// The PUBLIC data contract — the stable shape your personal site reads.
// Only tanks explicitly marked `shared` are included. Bump the version if the
// shape changes in a breaking way so the consuming site can adapt.

import type { AppState, Tank, WaterType } from "./types";
import { daysSince, getStatus, lastLogOfType } from "./status";
import type { StatusLevel } from "./status";

export const PUBLIC_SCHEMA_VERSION = 1;

export interface PublicReading {
  date: string;
  tempF: number;
}
export interface PublicChange {
  date: string;
  percent: number;
}

export interface PublicTank {
  id: string;
  name: string;
  volumeGallons: number;
  waterType: WaterType;
  livestock?: string;
  /** Where it sits in the fishroom map (normalized 0..1) + which rack. */
  rackId: string;
  rackLabel?: string;
  /** Current state */
  status: StatusLevel;
  tempF?: number;
  daysSinceWaterChange: number | null;
  daysSinceFeeding: number | null;
  lastWaterChange?: string;
  lastFeeding?: string;
  lastTempTest?: string;
  /** Recent history for charts (most-recent-last, capped). */
  temperatures: PublicReading[];
  waterChanges: PublicChange[];
  feedings: string[];
}

export interface PublicRack {
  id: string;
  label?: string;
  x: number;
  y: number;
}

export interface PublicAquariumData {
  schemaVersion: number;
  generatedAt: string;
  room?: { points: { x: number; y: number }[] };
  racks: PublicRack[];
  tanks: PublicTank[];
}

const CAP = 120; // max history points per series

export function toPublicData(state: AppState, now = Date.now()): PublicAquariumData {
  const shared = state.tanks.filter((t) => t.shared);
  const usedStacks = new Set(shared.map((t) => t.stackId));

  return {
    schemaVersion: PUBLIC_SCHEMA_VERSION,
    generatedAt: new Date(now).toISOString(),
    room:
      state.room && state.room.points.length >= 3 ? state.room : undefined,
    racks: state.stacks
      .filter((s) => usedStacks.has(s.id))
      .map((s) => ({ id: s.id, label: s.label, x: s.x, y: s.y })),
    tanks: shared.map((t) => publicTank(t, state, now)),
  };
}

function publicTank(t: Tank, state: AppState, now: number): PublicTank {
  const st = getStatus(t, now);
  const rack = state.stacks.find((s) => s.id === t.stackId);
  const lastWc = lastLogOfType(t, "water_change");
  const lastFeed = lastLogOfType(t, "feeding");
  const lastTemp = lastLogOfType(t, "temp_test");

  const temps: PublicReading[] = t.logs
    .filter((l) => l.type === "temp_test" && l.tempF != null)
    .map((l) => ({ date: l.date, tempF: l.tempF as number }))
    .reverse()
    .slice(-CAP);
  const waterChanges: PublicChange[] = t.logs
    .filter((l) => l.type === "water_change")
    .map((l) => ({ date: l.date, percent: l.percent ?? t.defaultChangePercent }))
    .reverse()
    .slice(-CAP);
  const feedings: string[] = t.logs
    .filter((l) => l.type === "feeding")
    .map((l) => l.date)
    .reverse()
    .slice(-CAP);

  return {
    id: t.id,
    name: t.name,
    volumeGallons: t.volumeGallons,
    waterType: t.waterType,
    livestock: t.livestock || undefined,
    rackId: t.stackId,
    rackLabel: rack?.label,
    status: st.level,
    tempF: t.tempF,
    daysSinceWaterChange: daysSince(lastWc?.date, now),
    daysSinceFeeding: daysSince(lastFeed?.date, now),
    lastWaterChange: lastWc?.date,
    lastFeeding: lastFeed?.date,
    lastTempTest: lastTemp?.date,
    temperatures: temps,
    waterChanges,
    feedings,
  };
}
