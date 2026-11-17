import db from "../db";
import { plans } from "../db/schema";

export async function seedPlans() {
  const defaultPlans = [
    {
      name: "Free",
      slug: "free",
      description: "Ideal for personal projects and hobby websites.",
      priceMonthly: 0, // ₹0
      currency: "INR" as const,
      maxMonitors: 3,
      minIntervalMinutes: 5,
      logRetentionDays: 1,
      webhookAlertsEnabled: false,
      isActive: true,
    },
    {
      name: "Pro",
      slug: "pro",
      description: "Built for growing startups and production APIs.",
      priceMonthly: 49900, // ₹499.00
      currency: "INR" as const,
      maxMonitors: 15,
      minIntervalMinutes: 1,
      logRetentionDays: 30,
      webhookAlertsEnabled: true,
      isActive: true,
    },
    {
      name: "Scale",
      slug: "scale",
      description: "Maximum monitoring capacity for high-traffic applications.",
      priceMonthly: 109900, // ₹1,099.00
      currency: "INR" as const,
      maxMonitors: 50,
      minIntervalMinutes: 1,
      logRetentionDays: 90,
      webhookAlertsEnabled: true,
      isActive: true,
    },
  ];

  for (const plan of defaultPlans) {
    await db
      .insert(plans)
      .values(plan)
      .onConflictDoUpdate({
        target: plans.slug,
        set: {
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          currency: plan.currency,
          maxMonitors: plan.maxMonitors,
          minIntervalMinutes: plan.minIntervalMinutes,
          logRetentionDays: plan.logRetentionDays,
          webhookAlertsEnabled: plan.webhookAlertsEnabled,
          isActive: plan.isActive,
        },
      });
  }

  console.log("Plans seeded successfully.");
}

await seedPlans();
