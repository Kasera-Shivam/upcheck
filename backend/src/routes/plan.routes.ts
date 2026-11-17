import express from "express";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { validateSchema } from "../middlewares/validate.middleware";
import planSchema from "../modules/plan/plan.schema";
import planController from "../modules/plan/plan.controller";

const router = express.Router();

router.get("/list", planController.getAvailablePlans);

router.post(
  "/create-order",
  isAuthenticated,
  validateSchema({ body: planSchema.CreateOrderSchema }),
  planController.createUpgradeOrder,
);

router.post(
  "/verify-payment",
  isAuthenticated,
  validateSchema({ body: planSchema.VerifyPaymentSchema }),
  planController.verifyAndActivatePlan,
);

export default router;
