import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../App";
import { Err } from "../components";

const loadRazorpay = () =>
  new Promise<void>((ok, fail) => {
    if ((window as any).Razorpay) return ok();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok();
    s.onerror = () => fail(new Error("Could not load the payment window."));
    document.body.appendChild(s);
  });

export default function Plans() {
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    api.get("/plan/list").then((r) => setPlans(r.data.plans));
  }, []);
  const upgrade = async (plan: any) => {
    setErr("");
    setOk("");
    setBusy(plan.id);
    try {
      await loadRazorpay();
      const o = (await api.post("/plan/create-order", { planId: plan.id }))
        .data;
      new (window as any).Razorpay({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amount,
        currency: o.currency,
        name: "UpCheck",
        description: `${o.plan.name} plan, 30 days`,
        prefill: { name: user.name, email: user.email },
        handler: async (r: any) => {
          try {
            await api.post("/plan/verify-payment", { planId: plan.id, ...r });
            await refresh();
            setOk(`You are now on the ${plan.name} plan.`);
          } catch (x: any) {
            setErr(x.message);
          }
        },
        modal: { ondismiss: () => setBusy("") },
      }).open();
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy("");
    }
  };
  const money = (p: any) =>
    p.priceMonthly ? `₹${p.priceMonthly.toLocaleString("en-IN")}` : "₹0";
  return (
    <>
      <div className="head">
        <div>
          <h2>Plans</h2>
          <p className="muted">Each paid plan runs for 30 days from payment.</p>
        </div>
      </div>
      <Err msg={err} />
      {ok && <p className="ok">{ok}</p>}
      <div className="plans">
        {plans.map((p) => {
          const current = user.plan?.id === p.id;
          return (
            <div
              key={p.id}
              className={"panel plan" + (current ? " current" : "")}
            >
              <h3>{p.name}</h3>
              <p className="price">
                {money(p)}
                <small> / month</small>
              </p>
              <p className="muted">{p.description}</p>
              <ul>
                <li>{p.maxMonitors} monitors</li>
                <li>Checks as often as every {p.minIntervalMinutes} min</li>
                <li>{p.logRetentionDays}-day log history</li>
                <li>
                  {p.webhookAlertsEnabled
                    ? "Webhook alerts"
                    : "Email alerts only"}
                </li>
              </ul>
              {current ? (
                <p className="muted">
                  Current plan
                  {user.plan.currentPeriodEnd &&
                    ` · renews by ${new Date(user.plan.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              ) : p.priceMonthly > 0 ? (
                <button
                  className="btn"
                  disabled={!!busy}
                  onClick={() => upgrade(p)}
                >
                  {busy === p.id ? "Opening…" : `Upgrade to ${p.name}`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
