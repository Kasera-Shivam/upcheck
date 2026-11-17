import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, qs } from "../api";
import { useAuth } from "../App";
import { Err, MonitorForm, Pager, Pill, Strip, ago, dur, when } from "../components";

function History({ id, kind }: { id: string; kind: "logs" | "incidents" }) {
  const [page, setPage] = useState(1); const [filter, setFilter] = useState(""); const [d, setD] = useState<any>(null);
  useEffect(() => { api.get(`/monitor/${id}/${kind}` + qs({ page, status: filter })).then((r) => setD(r.data)); }, [id, kind, page, filter]);
  const rows = d?.[kind] ?? [];
  return (
    <>
      <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
        {kind === "logs"
          ? <><option value="">All checks</option><option value="up">Up only</option><option value="down">Down only</option></>
          : <><option value="">All incidents</option><option value="open">Open</option><option value="resolved">Resolved</option></>}
      </select>
      <div className="table">
        {rows.map((r: any) =>
          kind === "logs" ? (
            <div key={r.id} className="tr"><span className={r.isUp ? "dot up" : "dot down"} /><span>{when(r.checkedAt)}</span><span>{r.statusCode ?? "—"}</span><span>{r.responseTimeMs ?? "—"} ms</span><span className="muted grow">{r.errorMessage}</span></div>
          ) : (
            <div key={r.id} className="tr"><span className={r.resolvedAt ? "dot up" : "dot down"} /><span>{when(r.startedAt)}</span><span>{r.resolvedAt ? `Resolved after ${dur(r.durationSeconds)}` : `Open for ${dur(r.durationSeconds)}`}</span><span className="muted grow">{r.cause}</span></div>
          ))}
        {d && !rows.length && <p className="empty">Nothing here yet.</p>}
      </div>
      <Pager p={d?.pagination} set={setPage} />
    </>
  );
}

export default function MonitorDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { user } = useAuth();
  const [d, setD] = useState<any>(null); const [tab, setTab] = useState<"logs" | "incidents">("logs");
  const [editing, setEditing] = useState(false); const [confirm, setConfirm] = useState(""); const [err, setErr] = useState("");
  const load = () => api.get(`/monitor/${id}/details`).then((r) => setD(r.data)).catch((e) => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [id]);
  if (err) return <p className="err">{err}</p>;
  if (!d) return <p className="muted">Loading…</p>;
  const { monitor: m, stats } = d;
  const toggle = async () => { await api.patch(`/monitor/${id}/toggle`); load(); };
  const remove = async () => { try { await api.del(`/monitor/${id}/delete`, { name: confirm }); nav("/"); } catch (x: any) { setErr(x.message); } };

  return (
    <>
      <p><Link to="/" className="muted">← All monitors</Link></p>
      <div className="head">
        <div><h2>{m.name} <Pill status={m.status} /></h2><p className="muted">{m.method} {m.url}</p></div>
        <div className="actions">
          <button className="btn ghost" onClick={toggle}>{m.isActive ? "Pause" : "Resume"}</button>
          <button className="btn ghost" onClick={() => setEditing(!editing)}>{editing ? "Close" : "Edit"}</button>
        </div>
      </div>
      {editing && <div className="panel"><MonitorForm initial={m} plan={user.plan} submitLabel="Save changes" onSubmit={async (b) => { await api.patch(`/monitor/${id}/update`, b); setEditing(false); load(); }} /></div>}
      <div className="stats">
        <div><b>{stats.uptimePercentage24h ?? "—"}{stats.uptimePercentage24h != null && "%"}</b><span>Uptime, last 24 h</span></div>
        <div><b>{stats.avgResponseTimeMs24h ?? "—"}{stats.avgResponseTimeMs24h != null && " ms"}</b><span>Average response</span></div>
        <div><b>{stats.totalPings24h}</b><span>Checks, last 24 h</span></div>
        <div><b>{ago(m.lastCheckedAt)}</b><span>Last checked</span></div>
      </div>
      <div className="panel"><Strip checks={d.recentLogs} /><p className="muted small">Newest check is on the right. Public status page: <Link to={`/status/${m.id}`}>/status/{m.id}</Link></p></div>
      <div className="tabs">
        <button className={tab === "logs" ? "on" : ""} onClick={() => setTab("logs")}>Check history</button>
        <button className={tab === "incidents" ? "on" : ""} onClick={() => setTab("incidents")}>Incidents</button>
      </div>
      <History key={tab} id={id!} kind={tab} />
      <div className="panel danger">
        <h3>Delete monitor</h3>
        <p className="muted">This removes its history too. Type the monitor name to confirm.</p>
        <div className="inline"><input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={m.name} /><button className="btn red" disabled={!confirm} onClick={remove}>Delete monitor</button></div>
        <Err msg={err} />
      </div>
    </>
  );
}
