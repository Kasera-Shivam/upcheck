import env from "../../config/env.config";
import constant from "../../config/constant.config";
import type { Context } from "../../@types";
import type {
  CreateAccountSchema,
  EmailSchema,
  VerifyAccountSchema,
  LoginSchema,
  ResetPasswordSchema,
} from "./auth.schema";
import createHttpError from "http-errors";
import { and, eq, sql } from "drizzle-orm";
import db from "../../db";
import {
  accounts,
  plans,
  sessions,
  userPlans,
  users,
  verificationTokens,
} from "../../db/schema";
import {
  createOtpPair,
  createTokenPair,
  hashPassword,
  hashToken,
  verifyPassword,
  verifyTokenHash,
} from "../../utils/crypto";
import { readTemplate } from "../../utils/template";
import { sendMail } from "../../lib/mailer";
import {
  activePlanSelect,
  mapActivePlan,
  planFieldsSelect,
} from "../../helpers/user.helper";
import type { NanoId } from "../../schemas/common.schema";

const createAccount = async ({
  firstName,
  lastName,
  email,
  password,
}: CreateAccountSchema) => {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) throw new createHttpError.Conflict("Email already exists.");
  const [existingToken] = await db
    .select({ createdAt: verificationTokens.createdAt })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.type, "signup_registration"),
      ),
    )
    .limit(1);
  if (existingToken) {
    const timeElapsed = Date.now() - existingToken.createdAt.getTime();
    if (timeElapsed < constant.COOLDOWN_MS) {
      const remainingSeconds = Math.ceil(
        (constant.COOLDOWN_MS - timeElapsed) / 1000,
      );
      throw new createHttpError.TooManyRequests(
        `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
      );
    }
  }
  const { otp, otpHash, expiresAt } = createOtpPair();
  const passwordHash = await hashPassword(password);
  const now = new Date();
  await db
    .insert(verificationTokens)
    .values({
      identifier: email,
      token: otpHash,
      type: "signup_registration",
      attempts: 0,
      payload: {
        firstName,
        lastName: lastName as string | undefined,
        passwordHash,
      },
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [verificationTokens.identifier, verificationTokens.type],
      set: {
        token: otpHash,
        attempts: 0,
        payload: {
          firstName,
          lastName: lastName as string | undefined,
          passwordHash,
        },
        expiresAt,
        createdAt: now,
      },
    });
  const template = readTemplate("EmailVerificationTemplate.html", {
    name: firstName,
    otp,
    expiredAt: 10,
    support_email: env.SMTP_USER,
  });
  sendMail({
    to: email,
    subject: "Email Verification | UpCheck",
    html: template,
  });
  return "Verification OTP sent to your email.";
};

const verifyAccount = async (
  { email, otp }: VerifyAccountSchema,
  context?: Context,
) => {
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.type, "signup_registration"),
      ),
    )
    .limit(1);
  if (!record || !record.payload)
    throw new createHttpError.BadRequest(
      "Invalid or expired verification request. Please sign up again.",
    );
  if (record.expiresAt.getTime() < Date.now()) {
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, record.id));
    throw new createHttpError.BadRequest(
      "OTP has expired. Please request a new one.",
    );
  }
  if (record.attempts >= constant.MAX_OTP_ATTEMPTS) {
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, record.id));
    throw new createHttpError.TooManyRequests(
      "Too many failed attempts. Please sign up again.",
    );
  }
  const isValidOtp = verifyTokenHash(otp, record.token);
  if (!isValidOtp) {
    const nextAttempts = record.attempts + 1;
    if (nextAttempts >= constant.MAX_OTP_ATTEMPTS) {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.id, record.id));
      throw new createHttpError.TooManyRequests(
        "Maximum attempts exceeded. Please request a new OTP.",
      );
    }
    await db
      .update(verificationTokens)
      .set({ attempts: sql`${verificationTokens.attempts} + 1` })
      .where(eq(verificationTokens.id, record.id));
    throw new createHttpError.BadRequest(
      `Invalid OTP. ${constant.MAX_OTP_ATTEMPTS - nextAttempts} attempts remaining.`,
    );
  }
  const { firstName, lastName, passwordHash } = record.payload;
  if (!firstName || !passwordHash)
    throw new createHttpError.InternalServerError(
      "Corrupted registration payload.",
    );
  const {
    token: sessionToken,
    tokenHash: sessionTokenHash,
    expiresAt,
  } = createTokenPair();
  const result = await db.transaction(async (tx) => {
    let activePlan = null;
    const [newUser] = await tx
      .insert(users)
      .values({
        firstName,
        lastName: lastName ?? null,
        email,
        isEmailVerified: true,
      })
      .returning();
    const [, , [freePlan]] = await Promise.all([
      tx.insert(accounts).values({
        provider: "credentials",
        providerId: email,
        password: passwordHash,
        userId: newUser!.id,
      }),
      tx.insert(sessions).values({
        token: sessionTokenHash,
        userId: newUser!.id,
        userAgent: context?.userAgent,
        ipAddress: context?.ipAddress,
        expiresAt,
      }),
      tx
        .select(planFieldsSelect)
        .from(plans)
        .where(eq(plans.slug, "free"))
        .limit(1),
      tx.delete(verificationTokens).where(eq(verificationTokens.id, record.id)),
    ]);
    if (freePlan) {
      const [insertedUserPlan] = await tx
        .insert(userPlans)
        .values({
          userId: newUser!.id,
          planId: freePlan.id,
          status: "active",
        })
        .returning();
      activePlan = {
        ...freePlan,
        status: insertedUserPlan!.status,
        currentPeriodEnd: insertedUserPlan!.currentPeriodEnd,
      };
    }
    return { ...newUser!, plan: activePlan };
  });
  return { user: result, sessionToken, expiresAt };
};

const resendOtp = async ({ email }: EmailSchema) => {
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.type, "signup_registration"),
      ),
    )
    .limit(1);
  if (!record || !record.payload)
    throw new createHttpError.BadRequest(
      "No pending registration found. Please sign up again.",
    );
  const timeElapsed = Date.now() - record.createdAt.getTime();
  if (timeElapsed < constant.COOLDOWN_MS) {
    const remainingSeconds = Math.ceil(
      (constant.COOLDOWN_MS - timeElapsed) / 1000,
    );
    throw new createHttpError.TooManyRequests(
      `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
    );
  }
  const { otp, otpHash, expiresAt } = createOtpPair();
  await db
    .update(verificationTokens)
    .set({ token: otpHash, attempts: 0, expiresAt, createdAt: new Date() })
    .where(eq(verificationTokens.id, record.id));
  const template = readTemplate("EmailVerificationTemplate.html", {
    name: record.payload.firstName,
    otp,
    expiredAt: 10,
    support_email: env.SMTP_USER,
  });
  sendMail({
    to: email,
    subject: "Email Verification | UpCheck",
    html: template,
  });
  return "A new verification OTP has been sent to your email.";
};

const login = async ({ email, password }: LoginSchema, context?: Context) => {
  const [row] = await db
    .select({
      user: users,
      password: accounts.password,
      plan: activePlanSelect,
    })
    .from(users)
    .innerJoin(
      accounts,
      and(eq(accounts.userId, users.id), eq(accounts.provider, "credentials")),
    )
    .leftJoin(
      userPlans,
      and(eq(userPlans.userId, users.id), eq(userPlans.status, "active")),
    )
    .leftJoin(plans, eq(userPlans.planId, plans.id))
    .where(eq(users.email, email))
    .limit(1);
  if (!row || !row.password)
    throw new createHttpError.Unauthorized("Invalid email or password.");
  const isPasswordValid = await verifyPassword(password, row.password);
  if (!isPasswordValid)
    throw new createHttpError.Unauthorized("Invalid email or password.");
  const { token: sessionToken, tokenHash, expiresAt } = createTokenPair();
  await db.insert(sessions).values({
    token: tokenHash,
    userId: row.user.id,
    userAgent: context?.userAgent,
    ipAddress: context?.ipAddress,
    expiresAt,
  });
  return {
    user: { ...row.user, plan: mapActivePlan(row.plan) },
    sessionToken,
    expiresAt,
  };
};

const forgotPassword = async ({ email }: EmailSchema) => {
  const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
  const message =
    "If an account with that email exists, a password reset link has been sent.";
  const [userAccount] = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      email: users.email,
    })
    .from(users)
    .innerJoin(
      accounts,
      and(eq(accounts.userId, users.id), eq(accounts.provider, "credentials")),
    )
    .where(eq(users.email, email))
    .limit(1);
  if (!userAccount) return message;
  const [existingToken] = await db
    .select({ createdAt: verificationTokens.createdAt })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.type, "password_reset"),
      ),
    )
    .limit(1);
  if (existingToken) {
    const timeElapsed = Date.now() - existingToken.createdAt.getTime();
    if (timeElapsed < constant.COOLDOWN_MS) {
      const remainingSeconds = Math.ceil(
        (constant.COOLDOWN_MS - timeElapsed) / 1000,
      );
      throw new createHttpError.TooManyRequests(
        `Please wait ${remainingSeconds} seconds before requesting another reset link.`,
      );
    }
  }
  const { token, tokenHash, expiresAt } = createTokenPair(
    RESET_TOKEN_EXPIRY_MS,
  );
  const now = new Date();
  await db
    .insert(verificationTokens)
    .values({
      identifier: email,
      token: tokenHash,
      type: "password_reset",
      attempts: 0,
      payload: { userId: userAccount.userId },
      expiresAt,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [verificationTokens.identifier, verificationTokens.type],
      set: {
        token: tokenHash,
        attempts: 0,
        payload: { userId: userAccount.userId },
        expiresAt,
        createdAt: now,
      },
    });
  const resetPasswordUrl = `${env.FRONTEND_URL}/account/reset-password?token=${token}`;
  const template = readTemplate("ResetPasswordRequest.html", {
    name: userAccount.firstName,
    resetPasswordUrl,
    expiredAt: 15,
    support_email: env.SMTP_USER,
  });
  sendMail({
    to: userAccount.email,
    subject: "Reset Password | UpCheck",
    html: template,
  });
  return message;
};

const resetPassword = async ({ token, password }: ResetPasswordSchema) => {
  const tokenHash = hashToken(token);
  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, tokenHash),
        eq(verificationTokens.type, "password_reset"),
      ),
    )
    .limit(1);
  if (!record || !record.payload?.userId)
    throw new createHttpError.BadRequest(
      "Invalid or expired password reset link.",
    );
  if (record.expiresAt.getTime() < Date.now()) {
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.id, record.id));
    throw new createHttpError.BadRequest("Password reset link has expired.");
  }
  const userId = record.payload.userId;
  const newPasswordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await Promise.all([
      tx
        .update(accounts)
        .set({ password: newPasswordHash })
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.provider, "credentials"),
          ),
        ),
      tx.delete(verificationTokens).where(eq(verificationTokens.id, record.id)),
      tx.delete(sessions).where(eq(sessions.userId, userId)),
    ]);
  });
  return "Password reset successfully. Please log in with your new password.";
};

const logout = async (
  userId: NanoId,
  sessionId: NanoId,
  all: boolean = false,
) => {
  if (all) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    return "Logged out from all devices successfully.";
  }
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  return "Logged out successfully.";
};

export default {
  createAccount,
  verifyAccount,
  resendOtp,
  login,
  forgotPassword,
  resetPassword,
  logout,
};
