import { useState } from "react";

export const ago = (d?: string | null) => {
  if (!d) return "Never";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString();
};
export const dur = (s: number) =>
  s < 60
    ? `${s}s`
    : s < 3600
      ? `${Math.round(s / 60)}m`
      : `${(s / 3600).toFixed(1)}h`;
export const when = (d: string) => new Date(d).toLocaleString();

export const Pill = ({ status }: { status: string }) => (
  <span className={`pill ${status}`}>{status}</span>
);

// Oldest check on the left, newest on the right.
export const Strip = ({
  checks,
}: {
  checks: { isUp: boolean; checkedAt: string; responseTimeMs?: number }[];
}) => (
  <div className="strip" aria-label="Recent checks">
    {[...checks].reverse().map((c, i) => (
      <i
        key={i}
        className={c.isUp ? "up" : "down"}
        title={`${when(c.checkedAt)} · ${c.isUp ? "Up" : "Down"}${c.responseTimeMs ? ` · ${c.responseTimeMs} ms` : ""}`}
      />
    ))}
    {!checks.length && <span className="muted">No checks yet.</span>}
  </div>
);

export const Pager = ({ p, set }: { p?: any; set: (n: number) => void }) =>
  p && p.totalPages > 1 ? (
    <div className="pager">
      <button
        className="btn ghost"
        disabled={!p.hasPrevPage}
        onClick={() => set(p.page - 1)}
      >
        Previous
      </button>
      <span className="muted">
        Page {p.page} of {p.totalPages}
      </span>
      <button
        className="btn ghost"
        disabled={!p.hasNextPage}
        onClick={() => set(p.page + 1)}
      >
        Next
      </button>
    </div>
  ) : null;

export const Err = ({ msg }: { msg?: string }) =>
  msg ? (
    <p className="err" role="alert">
      {msg}
    </p>
  ) : null;

// Plan limits come from /me, so the form only offers what the plan allows.
export function MonitorForm({
  initial,
  plan,
  onSubmit,
  submitLabel,
}: {
  initial?: any;
  plan: any;
  onSubmit: (v: any) => Promise<void>;
  submitLabel: string;
}) {
  const [v, setV] = useState({
    name: "",
    url: "https://",
    method: "GET",
    intervalMinutes: plan?.minIntervalMinutes ?? 5,
    timeoutSeconds: 10,
    failureThreshold: 2,
    alertEmail: "",
    ...initial,
    webhookUrl: initial?.webhookUrl ?? "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setV({ ...v, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body: any = { ...v, webhookUrl: v.webhookUrl.trim() || null };
    if (!body.alertEmail) delete body.alertEmail;
    try {
      await onSubmit(body);
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form grid2" onSubmit={submit}>
      <label className="span2">
        Name
        <input
          required
          value={v.name}
          onChange={set("name")}
          placeholder="Marketing site"
        />
      </label>
      <label className="span2">
        URL to check
        <input required type="url" value={v.url} onChange={set("url")} />
      </label>
      <label>
        Method
        <select value={v.method} onChange={set("method")}>
          <option>GET</option>
          <option>POST</option>
          <option>HEAD</option>
        </select>
      </label>
      <label>
        Check every (min)
        <input
          type="number"
          min={plan?.minIntervalMinutes ?? 1}
          max={60}
          value={v.intervalMinutes}
          onChange={set("intervalMinutes")}
        />
      </label>
      <label>
        Timeout (sec)
        <input
          type="number"
          min={3}
          max={30}
          value={v.timeoutSeconds}
          onChange={set("timeoutSeconds")}
        />
      </label>
      <label>
        Alert after failures
        <input
          type="number"
          min={1}
          max={10}
          value={v.failureThreshold}
          onChange={set("failureThreshold")}
        />
      </label>
      <label className="span2">
        Alert email (defaults to your account email)
        <input type="email" value={v.alertEmail} onChange={set("alertEmail")} />
      </label>
      {plan?.webhookAlertsEnabled ? (
        <label className="span2">
          Webhook URL (optional)
          <input type="url" value={v.webhookUrl} onChange={set("webhookUrl")} />
        </label>
      ) : (
        <p className="muted span2">
          Webhook alerts are not part of the {plan?.name ?? "current"} plan.
        </p>
      )}
      <div className="span2">
        <Err msg={err} />
        <button className="btn" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
