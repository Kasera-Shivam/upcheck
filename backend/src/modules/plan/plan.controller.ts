import type { NextFunction, Request, Response } from "express";
import type { CreateOrderSchema, VerifyPaymentSchema } from "./plan.schema";
import planService from "./plan.service";
import { sendSuccess } from "../../utils/response";

const getAvailablePlans = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plansList = await planService.getAvailablePlans();
    return sendSuccess(res, { data: { plans: plansList } });
  } catch (error) {
    next(error);
  }
};

const createUpgradeOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as CreateOrderSchema;
    const orderData = await planService.createUpgradeOrder(req.user!, body);
    return sendSuccess(res, {
      status: 201,
      message: "Upgrade order created successfully.",
      data: orderData,
    });
  } catch (error) {
    next(error);
  }
};

const verifyAndActivatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const body = req.body as VerifyPaymentSchema;
    const subscription = await planService.verifyAndActivatePlan(
      req.user!.id,
      body,
    );
    return sendSuccess(res, {
      message: "Plan upgraded successfully.",
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

export default { getAvailablePlans, createUpgradeOrder, verifyAndActivatePlan };
