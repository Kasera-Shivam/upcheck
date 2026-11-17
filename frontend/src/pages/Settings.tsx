import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../App";
import { Err, when } from "../components";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [p, setP] = useState({ firstName: user.firstName, lastName: user.lastName ?? "", username: user.username ?? "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [sec, setSec] = useState<any>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const note = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }));
  const loadSec = () => api.get("/account/security").then((r) => setSec(r.data));
  useEffect(() => { loadSec(); }, []);
  const run = (k: string, fn: () => Promise<string | void>) => async (e?: React.FormEvent) => {
    e?.preventDefault(); note(k, "");
    try { note(k, (await fn()) || ""); } catch (x: any) { note(k, "ERR:" + x.message); }
  };
  const Msg = ({ k }: { k: string }) => msg[k]?.startsWith("ERR:") ? <Err msg={msg[k].slice(4)} /> : msg[k] ? <p className="ok">{msg[k]}</p> : null;

  const saveProfile = run("profile", async () => {
    const body: any = { firstName: p.firstName, lastName: p.lastName || null };
    if (p.username) body.username = p.username;
    const r = await api.patch("/account/update", body); setUser({ ...user, ...r.data.user }); return r.message;
  });
  const checkName = run("username", async () => (await api.get(`/account/check-username?username=${encodeURIComponent(p.username)}`)).message);
  const upload = async (e: any) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("avatar", f);
    run("avatar", async () => { const r = await api.upload("/account/avatar/update", fd); setUser({ ...user, ...r.data.user }); return r.message; })();
  };
  const removeAvatar = run("avatar", async () => { const r = await api.del("/account/avatar/delete"); setUser({ ...user, ...r.data.user }); return r.message; });
  const changePw = run("pw", async () => {
    const body: any = { newPassword: pw.newPassword }; if (sec?.providers.hasCredentials) body.currentPassword = pw.currentPassword;
    const r = await api.patch("/account/change-password", body); setPw({ currentPassword: "", newPassword: "" }); loadSec(); return r.message;
  });
  const revoke = (q: string) => run("sessions", async () => { const r = await api.del("/account/sessions?" + q); loadSec(); return r.message; });

  return (
    <>
      <div className="head"><h2>Settings</h2></div>
      <section className="panel">
        <h3>Profile</h3>
        <div className="inline">
          {user.avatar ? <img className="big-ava" src={user.avatar} alt="" /> : <span className="big-ava ava">{user.firstName[0]}</span>}
          <label className="btn ghost">Upload photo<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label>
          {user.avatar && <button className="btn ghost" onClick={() => removeAvatar()}>Remove photo</button>}
        </div>
        <Msg k="avatar" />
        <form className="form grid2" onSubmit={saveProfile}>
          <label>First name<input required value={p.firstName} onChange={(e) => setP({ ...p, firstName: e.target.value })} /></label>
          <label>Last name<input value={p.lastName} onChange={(e) => setP({ ...p, lastName: e.target.value })} /></label>
          <label className="span2">Username
            <span className="inline"><input value={p.username} onChange={(e) => setP({ ...p, username: e.target.value })} /><button type="button" className="btn ghost" disabled={!p.username} onClick={() => checkName()}>Check</button></span>
          </label>
          <div className="span2"><Msg k="username" /><Msg k="profile" /><button className="btn">Save profile</button></div>
        </form>
        <p className="muted small">Signed in as {user.email}</p>
      </section>
      <section className="panel">
        <h3>{sec && !sec.providers.hasCredentials ? "Create a password" : "Change password"}</h3>
        <form className="form grid2" onSubmit={changePw}>
          {sec?.providers.hasCredentials && <label>Current password<input type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></label>}
          <label>New password (8+ characters)<input type="password" minLength={8} required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></label>
          <div className="span2"><Msg k="pw" /><button className="btn">Save password</button></div>
        </form>
      </section>
      <section className="panel">
        <div className="head"><h3>Active sessions</h3>{sec?.sessions.length > 1 && <button className="btn ghost" onClick={() => revoke("allOther=true")()}>Log out other devices</button>}</div>
        <Msg k="sessions" />
        <div className="table">
          {sec?.sessions.map((s: any) => (
            <div key={s.id} className="tr"><span className="grow small">{s.userAgent?.slice(0, 70) ?? "Unknown device"}<br /><span className="muted">{s.ipAddress} · started {when(s.createdAt)}</span></span>
              {s.isCurrent ? <span className="pill up">This device</span> : <button className="btn ghost" onClick={() => revoke("sessionId=" + s.id)()}>Revoke</button>}</div>
          ))}
        </div>
      </section>
    </>
  );
}
