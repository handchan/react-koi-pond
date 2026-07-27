import { useCallback, useEffect, useState } from "react";
import type {
  AppState,
  LogEntry,
  Pt,
  ReminderSettings,
  Stack,
  SyncSettings,
  Tank,
} from "./types";
import { uid } from "./status";

const STORAGE_KEY = "fishroom.state.v2";
const LEGACY_KEY = "fishroom.state.v1";
const STATE_VERSION = 2;

const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, hour: 9 };
const DEFAULT_SYNC: SyncSettings = {
  slug: import.meta.env.VITE_AQUARIUM_SLUG ?? "",
  publish: false,
};

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** A small starter fishroom — includes a couple of racks with stacked tanks. */
function seed(): AppState {
  const stacks: Stack[] = [
    { id: "s1", x: 0.26, y: 0.34, label: "Main rack" },
    { id: "s2", x: 0.7, y: 0.32, label: "Shrimp rack" },
    { id: "s3", x: 0.5, y: 0.66, label: "Reef stand" },
    { id: "s4", x: 0.8, y: 0.7, label: "QT" },
  ];

  const mk = (
    name: string,
    volumeGallons: number,
    stackId: string,
    shelf: number,
    waterChangeIntervalDays: number,
    daysSinceChange: number,
    daysSinceFeed: number,
    extra: Partial<Tank> = {}
  ): Tank => ({
    id: uid(),
    name,
    volumeGallons,
    waterType: "freshwater",
    waterChangeIntervalDays,
    defaultChangePercent: 30,
    stackId,
    shelf,
    livestock: "",
    notes: "",
    createdAt: daysAgoISO(120),
    logs: [
      {
        id: uid(),
        date: daysAgoISO(daysSinceChange),
        type: "water_change",
        percent: 30,
      },
      { id: uid(), date: daysAgoISO(daysSinceFeed), type: "feeding" },
    ],
    ...extra,
  });

  return {
    version: STATE_VERSION,
    room: {
      points: [
        { x: 0.1, y: 0.16 },
        { x: 0.9, y: 0.16 },
        { x: 0.9, y: 0.84 },
        { x: 0.1, y: 0.84 },
      ],
    },
    stacks,
    reminders: DEFAULT_REMINDERS,
    sync: DEFAULT_SYNC,
    tanks: [
      // Main rack — three tanks stacked
      mk("Community 75g", 75, "s1", 0, 7, 2, 0, {
        waterType: "planted",
        livestock: "Cardinal tetras, kuhli loaches, otos",
        tempF: 78,
      }),
      mk("Grow-out 20L", 20, "s1", 1, 5, 1, 0, {
        livestock: "Angelfish fry",
      }),
      mk("Betta 5g", 5, "s1", 2, 7, 9, 1, {
        livestock: "Galaxy betta",
        notes: "Sponge filter — rinse in old tank water.",
        tempF: 80,
      }),
      // Shrimp rack — two stacked
      mk("Blue Dream 10g", 10, "s2", 0, 10, 4, 2, {
        waterType: "planted",
        livestock: "Blue dream neocaridina",
        notes: "Remineralize RO to GH 6 / KH 1.",
      }),
      mk("Sakura 10g", 10, "s2", 1, 10, 11, 2, {
        waterType: "planted",
        livestock: "Sakura red cherries",
      }),
      // Reef stand — single
      mk("Reef 40B", 40, "s3", 0, 14, 16, 0, {
        waterType: "saltwater",
        livestock: "Clownfish pair, cleaner shrimp, zoas",
        tempF: 77,
      }),
      // QT — single
      mk("Quarantine 10g", 10, "s4", 0, 4, 5, 1, {
        notes: "Empty between uses — keep cycled with ammonia.",
      }),
    ],
  };
}

interface LegacyTank extends Tank {
  x?: number;
  y?: number;
}

/** Migrate a v1 state (free-floating tanks with x/y) into v2 stacks. */
function migrateV1(raw: string): AppState | null {
  try {
    const old = JSON.parse(raw) as { tanks?: LegacyTank[] };
    if (!old || !Array.isArray(old.tanks)) return null;
    const stacks: Stack[] = [];
    const tanks: Tank[] = old.tanks.map((t) => {
      const id = "s_" + (t.id ?? uid());
      stacks.push({ id, x: t.x ?? 0.5, y: t.y ?? 0.5 });
      const { x: _x, y: _y, ...rest } = t;
      void _x;
      void _y;
      return { ...rest, stackId: id, shelf: 0 } as Tank;
    });
    return {
      version: STATE_VERSION,
      stacks,
      tanks,
      reminders: DEFAULT_REMINDERS,
      sync: DEFAULT_SYNC,
    };
  } catch {
    return null;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.tanks) && Array.isArray(parsed.stacks)) {
        return {
          ...parsed,
          reminders: parsed.reminders ?? DEFAULT_REMINDERS,
          sync: parsed.sync ?? DEFAULT_SYNC,
        };
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateV1(legacy);
      if (migrated) return migrated;
    }
    return seed();
  } catch {
    return seed();
  }
}

function save(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / private mode — ignore, app still works in-memory
  }
}

/** Drop stacks that no longer have any tanks on them. */
function pruneStacks(s: AppState): AppState {
  const used = new Set(s.tanks.map((t) => t.stackId));
  return { ...s, stacks: s.stacks.filter((st) => used.has(st.id)) };
}

export function useFishroom() {
  const [state, setState] = useState<AppState>(() => load());

  useEffect(() => {
    save(state);
  }, [state]);

  const upsertTank = useCallback((tank: Tank, ensureStack?: Stack) => {
    setState((s) => {
      const i = s.tanks.findIndex((t) => t.id === tank.id);
      const tanks = [...s.tanks];
      if (i >= 0) tanks[i] = tank;
      else tanks.push(tank);
      let stacks = s.stacks;
      if (ensureStack && !stacks.some((st) => st.id === ensureStack.id)) {
        stacks = [...stacks, ensureStack];
      }
      return pruneStacks({ ...s, stacks, tanks });
    });
  }, []);

  const removeTank = useCallback((id: string) => {
    setState((s) =>
      pruneStacks({ ...s, tanks: s.tanks.filter((t) => t.id !== id) })
    );
  }, []);

  const moveStack = useCallback((id: string, x: number, y: number) => {
    setState((s) => ({
      ...s,
      stacks: s.stacks.map((st) => (st.id === id ? { ...st, x, y } : st)),
    }));
  }, []);

  const setStackLabel = useCallback((id: string, label: string) => {
    setState((s) => ({
      ...s,
      stacks: s.stacks.map((st) => (st.id === id ? { ...st, label } : st)),
    }));
  }, []);

  const addLog = useCallback((id: string, entry: Omit<LogEntry, "id">) => {
    setState((s) => ({
      ...s,
      tanks: s.tanks.map((t) =>
        t.id === id
          ? {
              ...t,
              // keep the tank's current temp in sync with the latest reading
              tempF:
                entry.type === "temp_test" && typeof entry.tempF === "number"
                  ? entry.tempF
                  : t.tempF,
              logs: [{ ...entry, id: uid() }, ...t.logs].sort(
                (a, b) => +new Date(b.date) - +new Date(a.date)
              ),
            }
          : t
      ),
    }));
  }, []);

  /** Mark every tank fed right now (one feeding log each). */
  const feedAll = useCallback(() => {
    const date = new Date().toISOString();
    setState((s) => ({
      ...s,
      tanks: s.tanks.map((t) => ({
        ...t,
        logs: [{ id: uid(), date, type: "feeding" as const }, ...t.logs],
      })),
    }));
  }, []);

  const removeLog = useCallback((tankId: string, logId: string) => {
    setState((s) => ({
      ...s,
      tanks: s.tanks.map((t) =>
        t.id === tankId
          ? { ...t, logs: t.logs.filter((l) => l.id !== logId) }
          : t
      ),
    }));
  }, []);

  const setRoom = useCallback((points: Pt[]) => {
    setState((s) => ({
      ...s,
      // Keep partial point lists while drawing so corners can be added one at a
      // time; an empty list clears the room. (Validity for export is enforced
      // separately — see contract.ts.)
      room: points.length > 0 ? { points } : undefined,
    }));
  }, []);

  const setReminders = useCallback((reminders: ReminderSettings) => {
    setState((s) => ({ ...s, reminders }));
  }, []);

  const setSync = useCallback((sync: SyncSettings) => {
    setState((s) => ({ ...s, sync }));
  }, []);

  const replaceState = useCallback((next: AppState) => {
    setState({
      ...next,
      reminders: next.reminders ?? DEFAULT_REMINDERS,
      sync: next.sync ?? DEFAULT_SYNC,
    });
  }, []);

  return {
    state,
    upsertTank,
    removeTank,
    moveStack,
    setStackLabel,
    addLog,
    feedAll,
    removeLog,
    setRoom,
    setReminders,
    setSync,
    replaceState,
  };
}

/** Build a fresh tank, optionally onto an existing stack. */
export function newTank(stackId: string, shelf: number, partial: Partial<Tank> = {}): Tank {
  return {
    id: uid(),
    name: "New Tank",
    volumeGallons: 20,
    waterType: "freshwater",
    waterChangeIntervalDays: 7,
    defaultChangePercent: 30,
    stackId,
    shelf,
    livestock: "",
    notes: "",
    createdAt: new Date().toISOString(),
    logs: [],
    ...partial,
  };
}

export function newStack(x = 0.5, y = 0.5, label?: string): Stack {
  return { id: uid(), x, y, label };
}

export { STORAGE_KEY };
