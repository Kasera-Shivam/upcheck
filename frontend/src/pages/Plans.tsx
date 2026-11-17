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

  const currentPlan = user?.plan;
  const isCurrentValid =
    !!currentPlan &&
    (!currentPlan.currentPeriodEnd ||
      new Date(currentPlan.currentPeriodEnd).getTime() > Date.now());

  const remainingDays =
    isCurrentValid && currentPlan?.currentPeriodEnd
      ? Math.max(
          0,
          Math.ceil(
            (new Date(currentPlan.currentPeriodEnd).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;

  const upgrade = async (plan: any) => {
    if (busy) return;
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
          setBusy(plan.id);
          try {
            await api.post("/plan/verify-payment", { planId: plan.id, ...r });
            await refresh();
            setOk(
              remainingDays > 0
                ? `You are now on the ${plan.name} plan (30 days + ${remainingDays} remaining days added).`
                : `You are now on the ${plan.name} plan.`,
            );
          } catch (x: any) {
            setErr(x.message);
          } finally {
            setBusy("");
          }
        },
        modal: { ondismiss: () => setBusy("") },
      }).open();
    } catch (x: any) {
      setErr(x.message);
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
          <p className="muted">
            Each paid plan adds 30 days (remaining paid days carry over on
            upgrade).
          </p>
        </div>
      </div>
      <Err msg={err} />
      {ok && <p className="ok">{ok}</p>}
      <div className="plans">
        {plans.map((p) => {
          const isCurrent = isCurrentValid && currentPlan?.id === p.id;
          const isLowerTier =
            isCurrentValid &&
            typeof currentPlan?.priceMonthly === "number" &&
            p.priceMonthly < currentPlan.priceMonthly;
          const canUpgrade = !isCurrent && !isLowerTier && p.priceMonthly > 0;

          return (
            <div
              key={p.id}
              className={"panel plan" + (isCurrent ? " current" : "")}
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
              {isCurrent ? (
                <p className="muted">
                  Current plan
                  {currentPlan.currentPeriodEnd &&
                    ` · ends ${new Date(currentPlan.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              ) : isLowerTier ? (
                <p className="muted">Included in your current plan</p>
              ) : canUpgrade ? (
                <button
                  className="btn"
                  disabled={!!busy}
                  onClick={() => upgrade(p)}
                >
                  {busy === p.id
                    ? "Processing…"
                    : remainingDays > 0
                      ? `Upgrade to ${p.name} (+${remainingDays}d carry-over)`
                      : `Upgrade to ${p.name}`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
