import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../utils/response";
import accountService from "./account.service";
import type {
  ChangePasswordSchema,
  CheckUsernameQuerySchema,
  RevokeSessionsQuerySchema,
  UpdateAccountSchema,
} from "./account.schema";

const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    return sendSuccess(res, { data: { user } });
  } catch (error) {
    next(error);
  }
};

const checkUsernameAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    const { username } = res.locals["query"] as CheckUsernameQuerySchema;
    const { available } = await accountService.checkUsernameAvailability(
      username,
      userId,
    );
    const message = available
      ? "Username is available."
      : "Username is not available.";
    return sendSuccess(res, { message });
  } catch (error) {
    next(error);
  }
};

const updateAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const body = req.body as UpdateAccountSchema;
    const user = await accountService.updateAccount(userId, body);
    return sendSuccess(res, {
      message: "Account updated successfully.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const updateAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await accountService.updateAvatar(req.user!.id, req.file);
    return sendSuccess(res, {
      message: "Avatar updated successfully.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const removeAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await accountService.removeAvatar(req.user!.id);
    return sendSuccess(res, {
      message: "Avatar removed successfully.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as ChangePasswordSchema;
    const { isNewlyCreated } = await accountService.changePassword(
      req.user!,
      body,
      req.sessionId,
    );
    return sendSuccess(res, {
      message: isNewlyCreated
        ? "Password created successfully."
        : "Password changed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const getSecurityOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await accountService.getSecurityOverview(
      req.user!.id,
      req.sessionId,
    );
    return sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

const revokeSessions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = res.locals["query"] as RevokeSessionsQuerySchema;
    const message = await accountService.revokeSessions(
      req.user!.id,
      query,
      req.sessionId,
    );
    return sendSuccess(res, { message });
  } catch (error) {
    next(error);
  }
};

export default {
  getMe,
  checkUsernameAvailability,
  updateAccount,
  updateAvatar,
  removeAvatar,
  changePassword,
  getSecurityOverview,
  revokeSessions,
};
