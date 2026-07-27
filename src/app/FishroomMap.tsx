import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Pt, RoomShape, Stack, Tank } from "./types";
import {
  getStatus,
  nodeRadius,
  stackMembers,
  statusColor,
  summarizeStack,
} from "./status";

interface Props {
  stacks: Stack[];
  tanks: Tank[];
  room?: RoomShape;
  now: number;
  editRoom: boolean;
  nodeScale: number;
  selectedStackId: string | null;
  onSelectStack: (id: string | null) => void;
  onOpenStack: (stack: Stack) => void;
  onMoveStack: (id: string, x: number, y: number) => void;
  onRoomChange: (points: Pt[]) => void;
}

/** Pointer travel (px) before a press becomes a drag rather than a tap. */
const DRAG_SLOP = 8;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

interface View {
  s: number;
  tx: number;
  ty: number;
}

type DragKind = "stack" | "vertex" | "pan";
interface DragState {
  kind: DragKind;
  id: string;
  index?: number;
  moved: boolean;
  startX: number;
  startY: number;
  /** For pan: the view offset when the drag began. */
  baseTx: number;
  baseTy: number;
}

export default function FishroomMap({
  stacks,
  tanks,
  room,
  now,
  editRoom,
  nodeScale,
  selectedStackId,
  onSelectStack,
  onOpenStack,
  onMoveStack,
  onRoomChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState<string | null>(null);

  // Refs so the window-level pointer handlers always see current values
  // without needing to re-subscribe on every render.
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<DragState | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  /** Screen point → normalized (0..1) map coordinates, undoing pan/zoom. */
  const toNorm = useCallback((clientX: number, clientY: number): Pt => {
    const el = wrapRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: clamp01((clientX - r.left - v.tx) / (v.s * r.width)),
      y: clamp01((clientY - r.top - v.ty) / (v.s * r.height)),
    };
  }, []);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = cx == null ? r.left + r.width / 2 : cx;
    const py = cy == null ? r.top + r.height / 2 : cy;
    setView((v) => {
      const s = clamp(v.s * factor, MIN_SCALE, MAX_SCALE);
      const k = s / v.s;
      // keep the point under the cursor fixed
      const ox = px - r.left;
      const oy = py - r.top;
      return { s, tx: ox - (ox - v.tx) * k, ty: oy - (oy - v.ty) * k };
    });
  }, []);

  const resetView = useCallback(() => setView({ s: 1, tx: 0, ty: 0 }), []);

  // ---- Global pointer handling (robust: survives leaving the element) ----
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (pointers.current.has(e.pointerId))
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Two fingers → pinch zoom / pan
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const p = pinch.current;
        if (p) {
          if (p.dist > 0) zoomAt(dist / p.dist, cx, cy);
          const dx = cx - p.cx;
          const dy = cy - p.cy;
          if (dx || dy) setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
        }
        pinch.current = { dist, cx, cy };
        dragRef.current = null;
        return;
      }

      const d = dragRef.current;
      if (!d) return;
      const travel = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (!d.moved) {
        if (travel < DRAG_SLOP) return;
        d.moved = true;
        if (d.kind !== "pan") setDragging(d.id);
      }
      e.preventDefault();

      if (d.kind === "pan") {
        setView((v) => ({
          ...v,
          tx: d.baseTx + (e.clientX - d.startX),
          ty: d.baseTy + (e.clientY - d.startY),
        }));
      } else if (d.kind === "stack") {
        const p = toNorm(e.clientX, e.clientY);
        onMoveStack(d.id, p.x, p.y);
      } else if (d.kind === "vertex") {
        const pts = roomRef.current?.points;
        if (pts) {
          const p = toNorm(e.clientX, e.clientY);
          onRoomChange(pts.map((q, i) => (i === d.index ? p : q)));
        }
      }
    }

    function onUp(e: PointerEvent) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setDragging(null);
      if (d.moved) return;

      // A tap (no meaningful movement)
      if (d.kind === "stack") {
        const st = stacks.find((s) => s.id === d.id);
        if (st) {
          onSelectStack(st.id);
          onOpenStack(st);
        }
      } else if (d.kind === "pan" && !editRoom) {
        onSelectStack(null); // tapping empty space clears selection
      }
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [stacks, editRoom, onMoveStack, onRoomChange, onOpenStack, onSelectStack, toNorm, zoomAt]);

  function begin(e: React.PointerEvent, kind: DragKind, id: string, index?: number) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      dragRef.current = null;
      return;
    }
    const v = viewRef.current;
    dragRef.current = {
      kind,
      id,
      index,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      baseTx: v.tx,
      baseTy: v.ty,
    };
  }

  function onBackgroundDown(e: React.PointerEvent) {
    if (editRoom) {
      // In edit mode a tap on empty canvas adds a corner.
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = toNorm(e.clientX, e.clientY);
      onRoomChange([...(roomRef.current?.points ?? []), p]);
      return;
    }
    begin(e, "pan", "bg");
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  }

  const points = room?.points ?? [];
  const poly = points.map((p) => `${p.x * size.w},${p.y * size.h}`).join(" ");

  return (
    <div
      className="map-wrap"
      ref={wrapRef}
      onPointerDown={onBackgroundDown}
      onWheel={onWheel}
    >
      <div
        className="map-layer"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
        }}
      >
        {size.w > 0 && (
          <svg className="room-svg" width={size.w} height={size.h}>
            {points.length >= 2 && <polygon className="room-poly" points={poly} />}
            {editRoom &&
              points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x * size.w}
                  cy={p.y * size.h}
                  r={12 / view.s}
                  className="room-handle"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    begin(e, "vertex", "room", i);
                  }}
                />
              ))}
          </svg>
        )}

        {size.w > 0 &&
          !editRoom &&
          stacks.map((stack) => {
            const members = stackMembers(tanks, stack.id);
            if (members.length === 0) return null;
            const sum = summarizeStack(members, now);
            const left = stack.x * size.w;
            const top = stack.y * size.h;
            const isDrag = dragging === stack.id;
            const isSel = selectedStackId === stack.id;
            const label = stack.label || members[0].name;
            const hit = hitSize(sum.maxVolume, members.length, nodeScale);

            return (
              <div key={stack.id}>
                {members.length === 1
                  ? renderSingle(members[0], left, top, now, isDrag, isSel, nodeScale)
                  : renderRack(members, sum, left, top, now, isDrag, isSel, nodeScale)}
                <div
                  className="node-hit"
                  style={{ left, top, width: hit, height: hit }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    begin(e, "stack", stack.id);
                  }}
                />
                <div
                  className="node-label"
                  style={{ left, top: top + labelOffset(sum.maxVolume, members.length, nodeScale) }}
                >
                  {label}
                  {members.length > 1 && <span className="count"> · {members.length}</span>}
                </div>
              </div>
            );
          })}
      </div>

      {/* Zoom controls */}
      {!editRoom && (
        <div className="zoom-tools">
          <button onClick={() => zoomAt(1.25)} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out">
            −
          </button>
          <button className="reset" onClick={resetView} aria-label="Reset view">
            ⤢
          </button>
        </div>
      )}

      {!editRoom && (
        <div className="map-hint">Tap to open · drag to move · pinch to zoom</div>
      )}
    </div>
  );
}

function clamp01(v: number): number {
  return Math.max(0.03, Math.min(0.97, v));
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function fmtVol(g: number): string {
  return g >= 100 ? `${Math.round(g)}` : `${g}g`;
}

function radiusOf(volume: number, scale: number): number {
  return nodeRadius(volume) * scale;
}
function rackWidth(maxVolume: number, scale: number): number {
  return Math.max(48, Math.min(96, nodeRadius(maxVolume) * 1.7)) * scale;
}
function rackHeight(count: number, scale: number): number {
  return (count * 16 + (count - 1) * 4 + 10) * scale;
}
function hitSize(maxVolume: number, count: number, scale: number): number {
  // Always at least a comfortable touch target, even for tiny tanks.
  if (count === 1) return Math.max(44, radiusOf(maxVolume, scale) * 2);
  return Math.max(44, rackWidth(maxVolume, scale));
}
function labelOffset(maxVolume: number, count: number, scale: number): number {
  return count === 1
    ? radiusOf(maxVolume, scale) + 4
    : rackHeight(count, scale) / 2 + 6;
}

function renderSingle(
  t: Tank,
  left: number,
  top: number,
  now: number,
  dragging: boolean,
  selected: boolean,
  scale: number
) {
  const st = getStatus(t, now);
  const r = radiusOf(t.volumeGallons, scale);
  const color = statusColor(st.ratio);
  return (
    <div
      className={
        "node" + (dragging ? " dragging" : "") + (selected ? " selected" : "")
      }
      style={{
        left,
        top,
        width: r * 2,
        height: r * 2,
        background: `radial-gradient(circle at 35% 30%, ${lighten(color)}, ${color})`,
        fontSize: `${Math.max(0.7, scale)}em`,
      }}
    >
      <span className="node-vol">{fmtVol(t.volumeGallons)}</span>
      <span className="node-days">
        {st.daysSinceChange == null ? "—" : `${st.daysSinceChange}d`}
      </span>
    </div>
  );
}

function renderRack(
  members: Tank[],
  sum: { maxVolume: number; attention: number },
  left: number,
  top: number,
  now: number,
  dragging: boolean,
  selected: boolean,
  scale: number
) {
  const w = rackWidth(sum.maxVolume, scale);
  const h = rackHeight(members.length, scale);
  return (
    <div
      className={
        "rack" + (dragging ? " dragging" : "") + (selected ? " selected" : "")
      }
      style={{ left, top, width: w, height: h, fontSize: `${Math.max(0.7, scale)}em` }}
    >
      {members.map((t) => {
        const st = getStatus(t, now);
        const color = statusColor(st.ratio);
        return (
          <div
            key={t.id}
            className="shelf"
            style={{ background: `linear-gradient(90deg, ${color}, ${lighten(color)})` }}
          >
            <span className="shelf-vol">{fmtVol(t.volumeGallons)}</span>
            <span className="shelf-days">
              {st.daysSinceChange == null ? "—" : `${st.daysSinceChange}d`}
            </span>
          </div>
        );
      })}
      {sum.attention > 0 && <span className="rack-badge">{sum.attention}</span>}
    </div>
  );
}

function lighten(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return rgb;
  const [r, g, b] = m.map(Number);
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.45));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
