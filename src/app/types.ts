// Core data model for the Fishroom aquarium tracker.

export type WaterType = "freshwater" | "planted" | "saltwater" | "brackish";

export interface LogEntry {
  id: string;
  /** ISO timestamp of when the event happened. */
  date: string;
  type: "water_change" | "feeding" | "temp_test";
  /** For water changes: percent of volume changed. */
  percent?: number;
  /** For temp tests: the measured temperature in °F. */
  tempF?: number;
  note?: string;
}

export interface Tank {
  id: string;
  name: string;
  /** Volume in US gallons. Drives node size on the map. */
  volumeGallons: number;
  waterType: WaterType;

  /** Target interval between water changes, in days. */
  waterChangeIntervalDays: number;
  /** Typical percent changed, used to prefill the quick log. */
  defaultChangePercent: number;

  /** The rack/stack this tank lives on. */
  stackId: string;
  /** Shelf order within the stack — 0 is the top shelf. */
  shelf: number;

  /** Metadata */
  livestock: string;
  notes: string;
  tempF?: number;

  /** Include this tank in the public payload your personal site can read. */
  shared?: boolean;

  createdAt: string;
  /** Most recent events, newest first. */
  logs: LogEntry[];
}

/** A point on the map, normalized 0..1 of the canvas. */
export interface Pt {
  x: number;
  y: number;
}

/**
 * A rack / stand placed in the room. Tanks can be stacked on its shelves,
 * so a single map location may hold several tanks.
 */
export interface Stack {
  id: string;
  /** Position on the map, normalized 0..1. */
  x: number;
  y: number;
  label?: string;
}

/** The drawn outline of the fishroom — a closed polygon of normalized points. */
export interface RoomShape {
  points: Pt[];
}

export interface ReminderSettings {
  enabled: boolean;
  /** Hour of day (0–23) for the daily "what's due" summary. */
  hour: number;
}

export interface SyncSettings {
  /** Slug the personal site reads from, e.g. "hengchengyu". */
  slug: string;
  /** Whether the shared snapshot is published (site-readable). */
  publish: boolean;
}

export interface AppState {
  version: number;
  room?: RoomShape;
  stacks: Stack[];
  tanks: Tank[];
  reminders: ReminderSettings;
  sync?: SyncSettings;
  /** Multiplier for map icon sizes (0.6–1.8). Defaults to 1. */
  nodeScale?: number;
}
