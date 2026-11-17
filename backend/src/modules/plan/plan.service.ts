import env from "../../config/env.config";
import type { UserWithPlan } from "../../@types";
import type { CreateOrderSchema, VerifyPaymentSchema } from "./plan.schema";
import crypto from "node:crypto";
import createHttpError from "http-errors";
import { razorpay } from "../../config/razorpay.config";
import { and, asc, eq } from "drizzle-orm";
import db from "../../db";
import { plans, userPlans } from "../../db/schema";
import { planFieldsSelect } from "../../helpers/user.helper";
import type { NanoId } from "../../schemas/common.schema";

const getAvailablePlans = async () =>
  await db
    .select({
      ...planFieldsSelect,
      description: plans.description,
      priceMonthly: plans.priceMonthly,
      currency: plans.currency,
    })
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.priceMonthly));

const createUpgradeOrder = async (
  user: UserWithPlan,
  { planId }: CreateOrderSchema,
) => {
  const [targetPlan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
    .limit(1);
  if (!targetPlan)
    throw new createHttpError.NotFound("Selected plan does not exist.");
  if (targetPlan.priceMonthly <= 0)
    throw new createHttpError.BadRequest(
      "Free plan does not require payment checkout.",
    );
  const [currentSub] = await db
    .select({
      subscription: userPlans,
      plan: plans,
    })
    .from(userPlans)
    .innerJoin(plans, eq(userPlans.planId, plans.id))
    .where(and(eq(userPlans.userId, user.id), eq(userPlans.status, "active")))
    .limit(1);
  const now = new Date();
  if (currentSub) {
    const isStillValid =
      !currentSub.subscription.currentPeriodEnd ||
      currentSub.subscription.currentPeriodEnd.getTime() > now.getTime();
    if (isStillValid) {
      if (currentSub.plan.id === targetPlan.id)
        throw new createHttpError.BadRequest(
          `You are already on the ${targetPlan.name} plan.`,
        );
      if (targetPlan.priceMonthly < currentSub.plan.priceMonthly)
        throw new createHttpError.BadRequest(
          `Cannot downgrade from ${currentSub.plan.name} to ${targetPlan.name} while your current plan is active.`,
        );
    }
  }
  const amountInSubunits = targetPlan.priceMonthly * 100;
  const order = await razorpay.orders.create({
    amount: amountInSubunits,
    currency: targetPlan.currency,
    receipt: `up_${user.id}_${Date.now()}`,
    notes: {
      userId: user.id,
      planId: targetPlan.id,
      planSlug: targetPlan.slug,
    },
  });
  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID,
    plan: {
      id: targetPlan.id,
      name: targetPlan.name,
      priceMonthly: targetPlan.priceMonthly,
      currency: targetPlan.currency,
    },
  };
};

const verifyAndActivatePlan = async (
  userId: NanoId,
  input: VerifyPaymentSchema,
) => {
  const { planId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    input;
  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
  const receivedBuffer = Buffer.from(razorpay_signature, "utf-8");
  const isSignatureValid =
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  if (!isSignatureValid)
    throw new createHttpError.BadRequest("Invalid payment signature.");
  const [existingPayment] = await db
    .select()
    .from(userPlans)
    .where(eq(userPlans.externalPaymentId, razorpay_payment_id))
    .limit(1);
  if (existingPayment) return existingPayment;
  const [targetPlan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
    .limit(1);
  if (!targetPlan) throw new createHttpError.NotFound("Plan not found.");
  const order = await razorpay.orders.fetch(razorpay_order_id);
  const orderNotes = (order.notes ?? {}) as Record<string, string>;
  if (orderNotes.userId !== userId || orderNotes.planId !== planId)
    throw new createHttpError.Forbidden(
      "Payment order does not match this user or selected plan.",
    );
  if (order.status !== "paid")
    throw new createHttpError.BadRequest(
      "Payment is not completed for this order.",
    );
  const expectedAmount = targetPlan.priceMonthly * 100;
  if (order.amount !== expectedAmount || order.currency !== targetPlan.currency)
    throw new createHttpError.BadRequest(
      "Payment amount or currency mismatch.",
    );
  try {
    return await db.transaction(async (tx) => {
      const [currentSub] = await tx
        .select({
          subscription: userPlans,
          plan: plans,
        })
        .from(userPlans)
        .innerJoin(plans, eq(userPlans.planId, plans.id))
        .where(
          and(eq(userPlans.userId, userId), eq(userPlans.status, "active")),
        )
        .for("update")
        .limit(1);
      const now = new Date();
      let remainingMs = 0;
      if (currentSub) {
        const periodEnd = currentSub.subscription.currentPeriodEnd;
        const isStillValid = !periodEnd || periodEnd.getTime() > now.getTime();
        if (isStillValid) {
          if (targetPlan.priceMonthly < currentSub.plan.priceMonthly)
            throw new createHttpError.BadRequest(
              `Cannot downgrade from ${currentSub.plan.name} to ${targetPlan.name} while current plan is active.`,
            );
          if (targetPlan.id === currentSub.plan.id)
            throw new createHttpError.BadRequest(
              `You are already on the ${targetPlan.name} plan.`,
            );
          if (periodEnd) remainingMs = periodEnd.getTime() - now.getTime();
        }
        await tx
          .update(userPlans)
          .set({ status: "expired" })
          .where(eq(userPlans.id, currentSub.subscription.id));
      }
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const newPeriodEnd = new Date(now.getTime() + thirtyDaysMs + remainingMs);
      const [created] = await tx
        .insert(userPlans)
        .values({
          userId,
          planId: targetPlan.id,
          status: "active",
          externalPaymentId: razorpay_payment_id,
          currentPeriodStart: now,
          currentPeriodEnd: newPeriodEnd,
        })
        .returning();
      return created;
    });
  } catch (error: any) {
    if (error?.code === "23505") {
      const [duplicatePayment] = await db
        .select()
        .from(userPlans)
        .where(eq(userPlans.externalPaymentId, razorpay_payment_id))
        .limit(1);
      if (duplicatePayment) return duplicatePayment;
    }
    throw error;
  }
};

export default { getAvailablePlans, createUpgradeOrder, verifyAndActivatePlan };
