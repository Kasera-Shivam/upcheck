import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { api } from "./api";
import { Login, Signup, Forgot, Reset } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MonitorDetail from "./pages/MonitorDetail";
import Plans from "./pages/Plans";
import Settings from "./pages/Settings";
import Status from "./pages/Status";

type Ctx = { user: any; setUser: (u: any) => void; refresh: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

function Layout() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const logout = async () => { await api.post("/account/logout").catch(() => {}); setUser(null); nav("/login"); };
  return (
    <>
      <header className="bar">
        <Link to="/" className="brand">UpCheck</Link>
        <nav>
          <NavLink to="/" end>Monitors</NavLink>
          <NavLink to="/plans">Plans</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="who">
          {user.avatar ? <img src={user.avatar} alt="" /> : <span className="ava">{user.firstName[0]}</span>}
          <span className="plan-tag">{user.plan?.name ?? "No plan"}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="wrap"><Outlet /></main>
    </>
  );
}

function Protected() {
  const { user } = useAuth();
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  const [user, setUser] = useState<any>(undefined);
  const refresh = async () => {
    try { setUser((await api.get("/account/me")).data.user); } catch { setUser(null); }
  };
  useEffect(() => { refresh(); }, []);
  if (user === undefined) return <p className="center muted">Loading…</p>;
  return (
    <AuthCtx.Provider value={{ user, setUser, refresh }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
        <Route path="/forgot-password" element={<Forgot />} />
        <Route path="/account/reset-password" element={<Reset />} />
        <Route path="/status/:id" element={<Status />} />
        <Route element={<Protected />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/monitors/:id" element={<MonitorDetail />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthCtx.Provider>
  );
}
