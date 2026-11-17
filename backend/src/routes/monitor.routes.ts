import express from "express";
import { isAuthenticated } from "../middlewares/auth.middleware";
import { validateSchema } from "../middlewares/validate.middleware";
import monitorSchema from "../modules/monitor/monitor.schema";
import monitorController from "../modules/monitor/monitor.controller";
import { createIdParamSchema } from "../schemas/common.schema";

const router = express.Router();

router.post(
  "/create",
  isAuthenticated,
  validateSchema({ body: monitorSchema.CreateMonitorSchema }),
  monitorController.createMonitor,
);

router.get(
  "/list",
  isAuthenticated,
  validateSchema({ query: monitorSchema.GetMonitorListQuerySchema }),
  monitorController.getMonitorList,
);

router.get(
  "/:monitor_id/details",
  isAuthenticated,
  validateSchema({ params: createIdParamSchema("monitor_id") }),
  monitorController.getMonitorDetails,
);

router.get(
  "/:monitor_id/logs",
  isAuthenticated,
  validateSchema({
    params: createIdParamSchema("monitor_id"),
    query: monitorSchema.GetMonitorLogsQuerySchema,
  }),
  monitorController.getMonitorLogs,
);

router.get(
  "/:monitor_id/incidents",
  isAuthenticated,
  validateSchema({
    params: createIdParamSchema("monitor_id"),
    query: monitorSchema.GetMonitorIncidentsQuerySchema,
  }),
  monitorController.getMonitorIncidents,
);

router.get(
  "/public/:monitor_id",
  validateSchema({ params: createIdParamSchema("monitor_id") }),
  monitorController.getPublicMonitorStatus,
);

router.patch(
  "/:monitor_id/update",
  isAuthenticated,
  validateSchema({
    params: createIdParamSchema("monitor_id"),
    body: monitorSchema.UpdateMonitorSchema,
  }),
  monitorController.updateMonitor,
);

router.patch(
  "/:monitor_id/toggle",
  isAuthenticated,
  validateSchema({ params: createIdParamSchema("monitor_id") }),
  monitorController.toggleMonitor,
);

router.delete(
  "/:monitor_id/delete",
  isAuthenticated,
  validateSchema({
    params: createIdParamSchema("monitor_id"),
    body: monitorSchema.DeleteMonitorSchema,
  }),
  monitorController.deleteMonitor,
);

export default router;
