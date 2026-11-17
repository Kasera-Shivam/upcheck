import env from "../config/env.config";
import constant from "../config/constant.config";
import type { CookieOptions, Response } from "express";
import { StatusCodes } from "http-status-codes";

const isProd = env.NODE_ENV === "production";

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/",
};

export const sendSuccess = (
  res: Response,
  {
    status = 200,
    message,
    data,
  }: {
    status?: StatusCodes;
    message?: string;
    data?: Record<string, unknown>;
  } = {},
) => res.status(status).json({ message, data });

export const setSessionCookie = (
  res: Response,
  token: string,
  expiresAt: Date,
): Response =>
  res.cookie(constant.SESSION_COOKIE_NAME, token, {
    ...baseCookieOptions,
    expires: expiresAt,
  });

export const clearSessionCookie = (res: Response): Response =>
  res.clearCookie(constant.SESSION_COOKIE_NAME, baseCookieOptions);
