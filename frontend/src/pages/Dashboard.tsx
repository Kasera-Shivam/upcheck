import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, qs } from "../api";
import { useAuth } from "../App";
import { MonitorForm, Pager, Pill, ago } from "../components";

export default function Dashboard() {
  const { user } = useAuth();
  const [q, setQ] = useState({ search: "", status: "", page: 1 });
  const [data, setData] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const load = () => api.get("/monitor/list" + qs({ ...q, limit: 10 })).then((r) => setData(r.data)).catch((e) => setErr(e.message));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [q]);
  const total = data?.pagination.totalItems ?? 0;

  return (
    <>
      <div className="head">
        <div><h2>Monitors</h2><p className="muted">{total} of {user.plan?.maxMonitors ?? 0} used on the {user.plan?.name ?? "current"} plan</p></div>
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? "Close" : "Add monitor"}</button>
      </div>
      {adding && (
        <div className="panel">
          <MonitorForm plan={user.plan} submitLabel="Create monitor" onSubmit={async (b) => { await api.post("/monitor/create", b); setAdding(false); load(); }} />
        </div>
      )}
      <div className="filters">
        <input placeholder="Search by name or URL" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value, page: 1 })} />
        <select value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value, page: 1 })}>
          <option value="">All statuses</option><option value="up">Up</option><option value="down">Down</option><option value="pending">Pending</option><option value="paused">Paused</option>
        </select>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="list">
        {data?.monitors.map((m: any) => (
          <Link key={m.id} to={`/monitors/${m.id}`} className="row">
            <Pill status={m.status} />
            <div className="grow"><strong>{m.name}</strong><div className="muted url">{m.method} {m.url}</div></div>
            <div className="muted right">Every {m.intervalMinutes} min<br />Checked {ago(m.lastCheckedAt)}</div>
          </Link>
        ))}
        {data && !data.monitors.length && <p className="empty">No monitors match. Add one to start checking a URL.</p>}
      </div>
      <Pager p={data?.pagination} set={(page) => setQ({ ...q, page })} />
    </>
  );
}
