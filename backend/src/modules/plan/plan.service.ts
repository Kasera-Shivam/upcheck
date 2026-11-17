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
  if (user.plan?.id === targetPlan.id && user.plan.status === "active")
    throw new createHttpError.BadRequest(
      `You are already on the ${targetPlan.name} plan.`,
    );
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
  const receivedBuffer = Buffer.from(razorpay_signature, "utf8");
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
  const [targetPlan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
    .limit(1);
  if (!targetPlan) throw new createHttpError.NotFound("Plan not found.");
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const newSubscription = await db.transaction(async (tx) => {
    await tx
      .update(userPlans)
      .set({ status: "expired" })
      .where(and(eq(userPlans.userId, userId), eq(userPlans.status, "active")));
    const [created] = await tx
      .insert(userPlans)
      .values({
        userId,
        planId: targetPlan.id,
        status: "active",
        externalPaymentId: razorpay_payment_id,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .returning();
    return created;
  });
  return newSubscription;
};

export default { getAvailablePlans, createUpgradeOrder, verifyAndActivatePlan };
