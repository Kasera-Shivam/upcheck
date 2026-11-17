import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Err } from "../components";
import { useAuth } from "../App";

const Shell = ({ title, sub, children }: any) => (
  <div className="auth">
    <aside><h1>UpCheck</h1><p>Know when your site goes down before your users do.</p></aside>
    <section><h2>{title}</h2>{sub && <p className="muted">{sub}</p>}{children}</section>
  </div>
);

function useSubmit(fn: () => Promise<any>) {
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const run = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await fn(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return { err, busy, run };
}

export function Login() {
  const { setUser } = useAuth();
  const [f, setF] = useState({ email: "", password: "" });
  const { err, busy, run } = useSubmit(async () => setUser((await api.post("/account/login", f)).data.user));
  return (
    <Shell title="Log in">
      <form className="form" onSubmit={run}>
        <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <Err msg={err} />
        <button className="btn" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="muted"><Link to="/forgot-password">Forgot password?</Link> · <Link to="/signup">Create an account</Link></p>
    </Shell>
  );
}

export function Signup() {
  const { setUser } = useAuth();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [otp, setOtp] = useState(""); const [step, setStep] = useState<"form" | "otp">("form"); const [note, setNote] = useState("");
  const a = useSubmit(async () => { await api.post("/account/create", { ...f, lastName: f.lastName || null }); setStep("otp"); });
  const b = useSubmit(async () => setUser((await api.post("/account/verify", { email: f.email, otp })).data.user));
  const resend = async () => { try { setNote((await api.post("/account/resend-otp", { email: f.email })).message!); } catch (x: any) { setNote(x.message); } };
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  if (step === "otp")
    return (
      <Shell title="Check your email" sub={`We sent a 6-digit code to ${f.email}.`}>
        <form className="form" onSubmit={b.run}>
          <label>Verification code<input required inputMode="numeric" maxLength={6} pattern="\d{6}" value={otp} onChange={(e) => setOtp(e.target.value)} /></label>
          <Err msg={b.err} />{note && <p className="muted">{note}</p>}
          <button className="btn" disabled={b.busy}>Verify and create account</button>
          <button type="button" className="btn ghost" onClick={resend}>Send a new code</button>
        </form>
      </Shell>
    );
  return (
    <Shell title="Create your account" sub="The Free plan includes 3 monitors.">
      <form className="form" onSubmit={a.run}>
        <div className="grid2"><label>First name<input required value={f.firstName} onChange={set("firstName")} /></label><label>Last name<input value={f.lastName} onChange={set("lastName")} /></label></div>
        <label>Email<input type="email" required value={f.email} onChange={set("email")} /></label>
        <label>Password (8+ characters)<input type="password" minLength={8} required value={f.password} onChange={set("password")} /></label>
        <Err msg={a.err} />
        <button className="btn" disabled={a.busy}>{a.busy ? "Sending code…" : "Continue"}</button>
      </form>
      <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(""); const [done, setDone] = useState("");
  const { err, busy, run } = useSubmit(async () => setDone((await api.post("/account/forgot-password", { email })).message!));
  return (
    <Shell title="Reset your password">
      {done ? <p>{done}</p> : (
        <form className="form" onSubmit={run}>
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <Err msg={err} /><button className="btn" disabled={busy}>Send reset link</button>
        </form>
      )}
      <p className="muted"><Link to="/login">Back to log in</Link></p>
    </Shell>
  );
}

export function Reset() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const [password, setPassword] = useState("");
  const { err, busy, run } = useSubmit(async () => { await api.post("/account/reset-password", { token: sp.get("token") ?? "", password }); nav("/login"); });
  return (
    <Shell title="Choose a new password">
      <form className="form" onSubmit={run}>
        <label>New password (8+ characters)<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <Err msg={err} /><button className="btn" disabled={busy}>Save new password</button>
      </form>
    </Shell>
  );
}
