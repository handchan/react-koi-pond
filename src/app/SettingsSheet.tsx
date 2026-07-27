import { useRef, useState } from "react";
import type { AppState, ReminderSettings, SyncSettings } from "./types";
import {
  notificationsSupported,
  permissionState,
  requestNotificationPermission,
  showNotification,
} from "./reminders";
import { downloadBackup, parseBackup } from "./backup";
import type { UseSync } from "./sync";

interface Props {
  reminders: ReminderSettings;
  onRemindersChange: (s: ReminderSettings) => void;
  state: AppState;
  onImport: (s: AppState) => void;
  nodeScale: number;
  onNodeScaleChange: (n: number) => void;
  sync: UseSync;
  syncPrefs: SyncSettings;
  onSyncPrefsChange: (s: SyncSettings) => void;
  onClose: () => void;
}

export default function SettingsSheet({
  reminders,
  onRemindersChange,
  state,
  onImport,
  nodeScale,
  onNodeScaleChange,
  sync,
  syncPrefs,
  onSyncPrefsChange,
  onClose,
}: Props) {
  const [perm, setPerm] = useState(permissionState());
  const supported = notificationsSupported();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const sharedCount = state.tanks.filter((t) => t.shared).length;
  const hours = Array.from({ length: 24 }, (_, i) => i);

  async function enableReminders() {
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") onRemindersChange({ ...reminders, enabled: true });
  }
  function toggleReminders() {
    if (!reminders.enabled) {
      if (perm !== "granted") return void enableReminders();
      onRemindersChange({ ...reminders, enabled: true });
    } else onRemindersChange({ ...reminders, enabled: false });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportErr(null);
    try {
      const text = await f.text();
      const next = parseBackup(text);
      if (
        confirm(
          `Import ${next.tanks.length} tanks? This replaces your current data on this device.`
        )
      )
        onImport(next);
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grabber" />
        <div className="sheet-head">
          <button onClick={onClose}>Close</button>
          <span className="t">Settings</span>
          <span style={{ width: 48 }} />
        </div>

        <div className="sheet-body">
          {/* ---------- Map ---------- */}
          <div className="section-title" style={{ marginTop: 4 }}>
            Map
          </div>
          <div className="field">
            <label>Icon size — {Math.round(nodeScale * 100)}%</label>
            <input
              type="range"
              className="slider"
              min={0.6}
              max={1.8}
              step={0.1}
              value={nodeScale}
              onChange={(e) => onNodeScaleChange(Number(e.target.value))}
            />
            <div className="setting-sub">
              Scales the tank/rack icons on the fishroom map.
            </div>
          </div>

          {/* ---------- Reminders ---------- */}
          <div className="section-title" style={{ marginTop: 22 }}>
            Reminders
          </div>
          {!supported && (
            <p className="note warn">
              This browser doesn't support notifications. On iPhone, add Fishroom
              to your Home Screen and open it from there.
            </p>
          )}
          <div className="setting-row">
            <div>
              <div className="setting-title">Water-change reminders</div>
              <div className="setting-sub">Get notified when tanks are due or overdue.</div>
            </div>
            <button
              className={"switch" + (reminders.enabled ? " on" : "")}
              role="switch"
              aria-checked={reminders.enabled}
              onClick={toggleReminders}
              disabled={!supported}
            >
              <span className="knob" />
            </button>
          </div>
          {perm === "denied" && (
            <p className="note warn">
              Notifications are blocked. Enable them for this app in your settings.
            </p>
          )}
          <div className="field" style={{ marginTop: 14 }}>
            <label>Daily summary time</label>
            <select
              value={reminders.hour}
              onChange={(e) =>
                onRemindersChange({ ...reminders, hour: Number(e.target.value) })
              }
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </div>
          <button
            className="ghost-btn"
            disabled={perm !== "granted"}
            onClick={() =>
              showNotification("🐟 Fishroom", "Reminders are working.", "test")
            }
          >
            Send a test notification
          </button>

          {/* ---------- Connect your site ---------- */}
          <div className="section-title" style={{ marginTop: 26 }}>
            Connect your site
          </div>
          <p className="note" style={{ marginTop: 0 }}>
            Securely publish a read-only feed of your <b>shared</b> tanks so
            hengchengyu.com/aquarium can read it. {sharedCount} tank
            {sharedCount === 1 ? "" : "s"} currently shared (toggle per tank in its
            editor).
          </p>

          {!sync.configured ? (
            <p className="note warn">
              Cloud sync isn't configured in this build. Add your Supabase keys
              (<code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>)
              and run the SQL in <b>docs/INTEGRATION.md</b> to enable it. Until
              then, your data stays fully on this device — use Backup below.
            </p>
          ) : !sync.signedIn ? (
            <>
              <div className="field">
                <label>Sign in to sync (owner only)</label>
                <input
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                className="ghost-btn"
                disabled={sync.busy || !email}
                onClick={() => sync.signIn(email)}
              >
                Email me a sign-in link
              </button>
            </>
          ) : (
            <>
              <div className="setting-row">
                <div>
                  <div className="setting-title">Signed in</div>
                  <div className="setting-sub">{sync.email}</div>
                </div>
                <button className="ghost-btn" style={{ width: "auto", margin: 0 }} onClick={sync.signOut}>
                  Sign out
                </button>
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Site slug (your site reads this)</label>
                <input
                  value={syncPrefs.slug}
                  placeholder="hengchengyu"
                  onChange={(e) =>
                    onSyncPrefsChange({ ...syncPrefs, slug: e.target.value })
                  }
                />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-title">Publish to my site</div>
                  <div className="setting-sub">
                    When on, your shared tanks are readable at the slug above.
                  </div>
                </div>
                <button
                  className={"switch" + (syncPrefs.publish ? " on" : "")}
                  role="switch"
                  aria-checked={syncPrefs.publish}
                  onClick={() =>
                    onSyncPrefsChange({ ...syncPrefs, publish: !syncPrefs.publish })
                  }
                >
                  <span className="knob" />
                </button>
              </div>
              <button className="ghost-btn" disabled={sync.busy} onClick={sync.pushNow}>
                {sync.busy ? "Syncing…" : "Sync now"}
              </button>
            </>
          )}
          {sync.message && <p className="note">{sync.message}</p>}
          {sync.error && <p className="note warn">{sync.error}</p>}

          {/* ---------- Backup ---------- */}
          <div className="section-title" style={{ marginTop: 26 }}>
            Backup
          </div>
          <p className="note" style={{ marginTop: 0 }}>
            Export everything to a JSON file, or restore from one. Works offline.
          </p>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button className="wc" onClick={() => downloadBackup(state)}>
              <span className="al">⬇️ Export</span>
              <span className="hint">save a .json backup</span>
            </button>
            <button className="feed" onClick={() => fileRef.current?.click()}>
              <span className="al">⬆️ Import</span>
              <span className="hint">restore from file</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={onFile}
          />
          {importErr && <p className="note warn">{importErr}</p>}

          <p className="note">All data lives on this device unless you publish it.</p>
        </div>
      </div>
    </>
  );
}

function fmtHour(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}
