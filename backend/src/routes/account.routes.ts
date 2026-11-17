import express from "express";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { validateSchema } from "../middlewares/validate.middleware";
import accountSchema from "../modules/account/account.schema";
import accountController from "../modules/account/account.controller";
import { uploadAvatarMiddleware } from "../middlewares/upload.middleware";

const router = express.Router();

router.get("/me", isAuthenticated, accountController.getMe);

router.get(
  "/check-username",
  isAuthenticated({ optional: true }),
  validateSchema({ query: accountSchema.CheckUsernameQuerySchema }),
  accountController.checkUsernameAvailability,
);

router.patch(
  "/update",
  isAuthenticated,
  validateSchema({ body: accountSchema.UpdateAccountSchema }),
  accountController.updateAccount,
);

router.patch(
  "/avatar/update",
  isAuthenticated,
  uploadAvatarMiddleware,
  accountController.updateAvatar,
);

router.delete(
  "/avatar/delete",
  isAuthenticated,
  accountController.removeAvatar,
);

router.patch(
  "/change-password",
  isAuthenticated,
  validateSchema({ body: accountSchema.ChangePasswordSchema }),
  accountController.changePassword,
);

router.get("/security", isAuthenticated, accountController.getSecurityOverview);

router.delete(
  "/sessions",
  isAuthenticated,
  validateSchema({ query: accountSchema.RevokeSessionsQuerySchema }),
  accountController.revokeSessions,
);

export default router;
