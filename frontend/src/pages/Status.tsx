import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Pill, Strip, ago, dur, when } from "../components";

export default function Status() {
  const { id } = useParams(); const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { const l = () => api.get(`/monitor/public/${id}`).then((r) => setD(r.data)).catch((e) => setErr(e.message)); l(); const t = setInterval(l, 60000); return () => clearInterval(t); }, [id]);
  if (err) return <p className="center err">{err}</p>;
  if (!d) return <p className="center muted">Loading…</p>;
  const { monitor: m, stats } = d;
  return (
    <main className="wrap narrow">
      <h1 className="brand">UpCheck</h1>
      <div className="panel">
        <h2>{m.name} <Pill status={m.status} /></h2>
        <p className="muted">Checked every {m.intervalMinutes} min · last check {ago(m.lastCheckedAt)}</p>
        <Strip checks={d.recentChecks} />
        <div className="stats two"><div><b>{stats.uptimePercentage24h ?? "—"}{stats.uptimePercentage24h != null && "%"}</b><span>Uptime, last 24 h</span></div><div><b>{stats.avgResponseTimeMs24h ?? "—"}{stats.avgResponseTimeMs24h != null && " ms"}</b><span>Average response</span></div></div>
      </div>
      <h3>Recent incidents</h3>
      <div className="table">
        {d.recentIncidents.map((i: any) => <div key={i.id} className="tr"><span className={i.resolvedAt ? "dot up" : "dot down"} /><span>{when(i.startedAt)}</span><span>{i.resolvedAt ? `Resolved after ${dur(i.durationSeconds)}` : "Ongoing"}</span></div>)}
        {!d.recentIncidents.length && <p className="empty">No incidents reported.</p>}
      </div>
    </main>
  );
}
