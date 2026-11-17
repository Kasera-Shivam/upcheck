import express from "express";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { validateSchema } from "../middlewares/validate.middleware";
import authSchema from "../modules/auth/auth.schema";
import authController from "../modules/auth/auth.controller";

const router = express.Router();

router.post(
  "/create",
  validateSchema({ body: authSchema.CreateAccountSchema }),
  authController.createAccount,
);

router.post(
  "/verify",
  validateSchema({ body: authSchema.VerifyAccountSchema }),
  authController.verifyAccount,
);

router.post(
  "/resend-otp",
  validateSchema({ body: authSchema.EmailSchema }),
  authController.resendOtp,
);

router.post(
  "/login",
  validateSchema({ body: authSchema.LoginSchema }),
  authController.login,
);

router.post(
  "/forgot-password",
  validateSchema({ body: authSchema.EmailSchema }),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  validateSchema({ body: authSchema.ResetPasswordSchema }),
  authController.resetPassword,
);

router.post(
  "/logout",
  isAuthenticated,
  validateSchema({ query: authSchema.LogoutQuerySchema }),
  authController.logout,
);

export default router;
