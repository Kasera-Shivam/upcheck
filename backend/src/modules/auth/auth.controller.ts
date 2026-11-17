import type { NextFunction, Request, Response } from "express";
import type {
  CreateAccountSchema,
  EmailSchema,
  LoginSchema,
  LogoutQuerySchema,
  ResetPasswordSchema,
  VerifyAccountSchema,
} from "./auth.schema";
import authService from "./auth.service";
import {
  clearSessionCookie,
  sendSuccess,
  setSessionCookie,
} from "../../utils/response";

const createAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as CreateAccountSchema;
    const message = await authService.createAccount(body);
    return sendSuccess(res, { message });
  } catch (error) {
    next(error);
  }
};

const verifyAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as VerifyAccountSchema;
    const { user, sessionToken, expiresAt } = await authService.verifyAccount(
      body,
      { userAgent: req.header("user-agent"), ipAddress: req.ip },
    );
    setSessionCookie(res, sessionToken, expiresAt);
    return sendSuccess(res, {
      status: 201,
      message: "Account created successfully.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as EmailSchema;
    const message = await authService.resendOtp(body);
    return sendSuccess(res, { message });
  } catch (error) {
    next(error);
  }
};

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as LoginSchema;
    const { user, sessionToken, expiresAt } = await authService.login(body, {
      userAgent: req.header("user-agent"),
      ipAddress: req.ip,
    });
    setSessionCookie(res, sessionToken, expiresAt);
    return sendSuccess(res, { message: "Login successfully.", data: { user } });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as EmailSchema;
    const message = await authService.forgotPassword(body);
    return sendSuccess(res, { message });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as ResetPasswordSchema;
    const message = await authService.resetPassword(body);
    return sendSuccess(res, { message });
  } catch (error) {
    next(error);
  }
};

const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const sessionId = req.sessionId!;
    const { all } = res.locals["query"] as LogoutQuerySchema;
    const message = await authService.logout(userId, sessionId, all);
    clearSessionCookie(res);
    return sendSuccess(res, { message });
  } catch (error) {
    next(error);
  }
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
