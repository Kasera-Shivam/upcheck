import express from "express";
import authRouter from "./auth.routes";
import accountRouter from "./account.routes";
import monitorRouter from "./monitor.routes";
import planRouter from "./plan.routes";

const router = express.Router();

router.use("/account", authRouter);
router.use("/account", accountRouter);
router.use("/monitor", monitorRouter);
router.use("/plan", planRouter);

export default router;
