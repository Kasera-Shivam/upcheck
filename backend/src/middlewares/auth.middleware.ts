import constant from "../config/constant.config";
import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { and, eq } from "drizzle-orm";
import db from "../db";
import { plans, sessions, userPlans, users } from "../db/schema";
import { hashToken } from "../utils/crypto";
import { clearSessionCookie } from "../utils/response";
import { activePlanSelect, mapActivePlan } from "../helpers/user.helper";

interface AuthOptions {
  optional?: boolean;
}

const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
  optional = false,
) => {
  try {
    const rawToken = req.cookies?.[constant.SESSION_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== "string") {
      if (optional) return next();
      throw new createHttpError.Unauthorized("Authentication required.");
    }
    const tokenHash = hashToken(rawToken);
    const [row] = await db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        user: users,
        plan: activePlanSelect,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .leftJoin(
        userPlans,
        and(eq(userPlans.userId, users.id), eq(userPlans.status, "active")),
      )
      .leftJoin(plans, eq(userPlans.planId, plans.id))
      .where(eq(sessions.token, tokenHash))
      .limit(1);
    if (!row) {
      clearSessionCookie(res);
      if (optional) return next();
      throw new createHttpError.Unauthorized("Invalid or expired session.");
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await db.delete(sessions).where(eq(sessions.id, row.sessionId));
      clearSessionCookie(res);
      if (optional) return next();
      throw new createHttpError.Unauthorized(
        "Session expired. Please log in again.",
      );
    }
    req.user = { ...row.user, plan: mapActivePlan(row.plan) };
    req.sessionId = row.sessionId;
    next();
  } catch (error) {
    next(error);
  }
};

export function isAuthenticated(
  options: AuthOptions,
): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void>;
export function isAuthenticated(
  reqOrOptions: Request | AuthOptions,
  res?: Response,
  next?: NextFunction,
) {
  if (res && next)
    return authenticateRequest(reqOrOptions as Request, res, next, false);
  const { optional = false } = (reqOrOptions as AuthOptions) ?? {};
  return (req: Request, response: Response, nextFn: NextFunction) =>
    authenticateRequest(req, response, nextFn, optional);
}
