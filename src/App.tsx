import { useEffect, useMemo, useRef, useState } from "react";
import FishroomMap from "./app/FishroomMap";
import ListView from "./app/ListView";
import TankSheet from "./app/TankSheet";
import RackSheet from "./app/RackSheet";
import SettingsSheet from "./app/SettingsSheet";
import { newStack, newTank, useFishroom } from "./app/storage";
import { getStatus, STATUS_COLORS, stackMembers } from "./app/status";
import { useReminders } from "./app/reminders";
import { useSync } from "./app/sync";
import type { Stack, Tank } from "./app/types";

type View = "map" | "list";
interface Editing {
  tank: Tank;
  isNew: boolean;
  ensureStack?: Stack;
}

export default function App() {
  const fr = useFishroom();
  const [view, setView] = useState<View>("map");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [openStackId, setOpenStackId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editRoom, setEditRoom] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { tanks, stacks, room, reminders } = fr.state;
  useReminders(tanks, reminders, now);
  const sync = useSync(fr.state, now);

  const summary = useMemo(() => {
    let overdue = 0;
    let due = 0;
    for (const t of tanks) {
      const lvl = getStatus(t, now).level;
      if (lvl === "never" || lvl === "overdue") overdue++;
      else if (lvl === "due") due++;
    }
    return { overdue, due, total: tanks.length };
  }, [tanks, now]);

  function flash(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1700);
  }

  function quickChange(t: Tank) {
    fr.addLog(t.id, {
      date: new Date().toISOString(),
      type: "water_change",
      percent: t.defaultChangePercent,
    });
    flash(`💧 Water change logged · ${t.name}`);
  }
  function quickFeed(t: Tank) {
    fr.addLog(t.id, { date: new Date().toISOString(), type: "feeding" });
    flash(`🍤 Fed · ${t.name}`);
  }

  function addNewRack() {
    const stack = newStack(0.5, 0.55);
    setOpenStackId(null);
    setEditing({ tank: newTank(stack.id, 0), isNew: true, ensureStack: stack });
  }

  function addTankToStack(stackId: string) {
    const members = stackMembers(tanks, stackId);
    const nextShelf = members.reduce((m, t) => Math.max(m, t.shelf), -1) + 1;
    setOpenStackId(null);
    setEditing({ tank: newTank(stackId, nextShelf), isNew: true });
  }

  function feedAllTanks() {
    if (tanks.length === 0) return;
    if (window.confirm(`Mark all ${tanks.length} tanks as fed right now?`)) {
      fr.feedAll();
      flash(`🍤 Fed all ${tanks.length} tanks`);
    }
  }

  // Re-read the edited tank from state so history reflects quick logs.
  const liveEditing: Editing | null = editing
    ? {
        ...editing,
        tank: tanks.find((t) => t.id === editing.tank.id) ?? editing.tank,
      }
    : null;

  const openStack = openStackId
    ? stacks.find((s) => s.id === openStackId)
    : undefined;
  const openMembers = openStack ? stackMembers(tanks, openStack.id) : [];

  // Room editing helpers
  const roomPts = room?.points ?? [];

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>
            <span aria-hidden>🐟</span> Fishroom
          </h1>
          <div className="sub">
            {summary.total} tanks ·{" "}
            {summary.overdue > 0 ? (
              <span style={{ color: STATUS_COLORS.overdue }}>
                {summary.overdue} need attention
              </span>
            ) : (
              <span style={{ color: STATUS_COLORS.fresh }}>all good 🎉</span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            aria-label="Reminders & settings"
          >
            🔔
          </button>
          <button className="icon-btn" onClick={addNewRack} aria-label="Add tank">
            +
          </button>
        </div>
      </div>

      <div className="segment">
        <button
          className={view === "map" ? "active" : ""}
          onClick={() => {
            setView("map");
          }}
        >
          🗺️ Map
        </button>
        <button
          className={view === "list" ? "active" : ""}
          onClick={() => {
            setView("list");
            setEditRoom(false);
          }}
        >
          📋 List
        </button>
      </div>

      <div className="summary">
        <div className="chip">
          <div className="n">{summary.total}</div>
          <div className="l">Tanks</div>
        </div>
        <div className="chip">
          <div className="n" style={{ color: STATUS_COLORS.due }}>
            {summary.due}
          </div>
          <div className="l">Due soon</div>
        </div>
        <div className="chip">
          <div className="n" style={{ color: STATUS_COLORS.overdue }}>
            {summary.overdue}
          </div>
          <div className="l">Overdue</div>
        </div>
      </div>

      {tanks.length > 0 && (
        <div className="toolbar">
          <button
            className="feed-all"
            onClick={feedAllTanks}
            disabled={editRoom}
          >
            🍤 Feed all tanks
          </button>
        </div>
      )}

      <div className="content">
        {view === "map" ? (
          <>
            {tanks.length === 0 ? (
              <div className="empty">
                <div className="big">🪣</div>
                <p>No tanks yet. Tap + to add your first aquarium.</p>
              </div>
            ) : (
              <FishroomMap
                stacks={stacks}
                tanks={tanks}
                room={room}
                now={now}
                editRoom={editRoom}
                onOpenStack={(s) => setOpenStackId(s.id)}
                onMoveStack={fr.moveStack}
                onRoomChange={fr.setRoom}
              />
            )}

            {/* Map tools */}
            {!editRoom ? (
              <button
                className="map-tool"
                onClick={() => setEditRoom(true)}
                aria-label="Draw room shape"
              >
                ✏️ Draw room
              </button>
            ) : (
              <div className="room-tools">
                <span className="room-tip">
                  {roomPts.length === 0
                    ? "Tap anywhere in the map to drop the first corner"
                    : roomPts.length < 3
                    ? `Tap to add corners — ${3 - roomPts.length} more for a room`
                    : "Drag dots to shape · tap to add more corners"}
                </span>
                <div className="room-tool-btns">
                  <button
                    onClick={() => fr.setRoom(roomPts.slice(0, -1))}
                    disabled={roomPts.length === 0}
                  >
                    Undo
                  </button>
                  <button
                    onClick={() => fr.setRoom([])}
                    disabled={roomPts.length === 0}
                  >
                    Clear
                  </button>
                  <button
                    className="done"
                    onClick={() => {
                      // Discard an unfinished outline (needs ≥3 corners).
                      if (roomPts.length < 3) fr.setRoom([]);
                      setEditRoom(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {!editRoom && (
              <button className="fab" onClick={addNewRack} aria-label="Add tank">
                +
              </button>
            )}
          </>
        ) : (
          <ListView
            tanks={tanks}
            now={now}
            onOpen={(t) => setEditing({ tank: t, isNew: false })}
            onLogChange={quickChange}
            onLogFeed={quickFeed}
          />
        )}

        {view === "list" && (
          <button className="fab" onClick={addNewRack} aria-label="Add tank">
            +
          </button>
        )}
      </div>

      {view === "map" && tanks.length > 0 && !editRoom && (
        <div
          className="legend"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
        >
          <span>
            <i style={{ background: STATUS_COLORS.fresh }} /> Fresh
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.due }} /> Due
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.overdue }} /> Overdue
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.never }} /> Needs change
          </span>
        </div>
      )}

      {openStack && !editing && (
        <RackSheet
          stack={openStack}
          members={openMembers}
          now={now}
          onRename={(label) => fr.setStackLabel(openStack.id, label)}
          onEditTank={(t) => {
            setOpenStackId(null);
            setEditing({ tank: t, isNew: false });
          }}
          onQuickChange={quickChange}
          onQuickFeed={quickFeed}
          onAddTank={() => addTankToStack(openStack.id)}
          onClose={() => setOpenStackId(null)}
        />
      )}

      {liveEditing && (
        <TankSheet
          tank={liveEditing.tank}
          isNew={liveEditing.isNew}
          now={now}
          onSave={(t) => {
            fr.upsertTank(t, liveEditing.ensureStack);
            setEditing(null);
            flash(liveEditing.isNew ? "🪣 Tank added" : "✓ Saved");
          }}
          onDelete={(id) => {
            fr.removeTank(id);
            setEditing(null);
            flash("Tank deleted");
          }}
          onAddLog={(id, entry) => {
            fr.addLog(id, entry);
            flash(
              entry.type === "water_change"
                ? "💧 Water change logged"
                : entry.type === "temp_test"
                ? `🌡️ Temp logged${entry.tempF != null ? ` · ${entry.tempF}°F` : ""}`
                : "🍤 Fed"
            );
          }}
          onRemoveLog={fr.removeLog}
          onClose={() => setEditing(null)}
        />
      )}

      {showSettings && (
        <SettingsSheet
          reminders={reminders}
          onRemindersChange={fr.setReminders}
          state={fr.state}
          onImport={(s) => {
            fr.replaceState(s);
            setShowSettings(false);
            flash("✓ Data imported");
          }}
          sync={sync}
          syncPrefs={fr.state.sync ?? { slug: "", publish: false }}
          onSyncPrefsChange={fr.setSync}
          onClose={() => setShowSettings(false)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
