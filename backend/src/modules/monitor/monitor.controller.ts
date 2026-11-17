import type { NextFunction, Request, Response } from "express";
import type {
  CreateMonitorSchema,
  DeleteMonitorSchema,
  GetMonitorIncidentsQuerySchema,
  GetMonitorListQuerySchema,
  GetMonitorLogsQuerySchema,
  UpdateMonitorSchema,
} from "./monitor.schema";
import monitorService from "./monitor.service";
import { sendSuccess } from "../../utils/response";
import type { IdParam } from "../../schemas/common.schema";

const createMonitor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const body = req.body as CreateMonitorSchema;
    const monitor = await monitorService.createMonitor(user, body);
    return sendSuccess(res, {
      status: 201,
      message: "Monitor created successfully.",
      data: { monitor },
    });
  } catch (error) {
    next(error);
  }
};

const getMonitorList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const query = res.locals["query"] as GetMonitorListQuerySchema;
    const data = await monitorService.getMonitorList(userId, query);
    return sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

const getMonitorDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const { monitor_id } = res.locals["params"] as IdParam<"monitor_id">;
    const data = await monitorService.getMonitorDetails(userId, monitor_id);
    return sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

const getMonitorLogs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { monitor_id } = req.params as IdParam<"monitor_id">;
    const query = res.locals["query"] as GetMonitorLogsQuerySchema;
    const data = await monitorService.getMonitorLogs(
      req.user!,
      monitor_id,
      query,
    );
    return sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

const getMonitorIncidents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { monitor_id } = req.params as IdParam<"monitor_id">;
    const query = res.locals["query"] as GetMonitorIncidentsQuerySchema;
    const data = await monitorService.getMonitorIncidents(
      req.user!.id,
      monitor_id,
      query,
    );
    return sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

const getPublicMonitorStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { monitor_id } = req.params as IdParam<"monitor_id">;
    const data = await monitorService.getPublicMonitorStatus(monitor_id);
    return sendSuccess(res, { data });
  } catch (error) {
    next(error);
  }
};

const updateMonitor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const { monitor_id } = res.locals["params"] as IdParam<"monitor_id">;
    const body = req.body as UpdateMonitorSchema;
    const monitor = await monitorService.updateMonitor(user, monitor_id, body);
    return sendSuccess(res, {
      message: "Monitor updated successfully.",
      data: { monitor },
    });
  } catch (error) {
    next(error);
  }
};

const toggleMonitor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const { monitor_id } = res.locals["params"] as IdParam<"monitor_id">;
    const monitor = await monitorService.toggleMonitor(userId, monitor_id);
    return sendSuccess(res, {
      message: monitor!.isActive
        ? "Monitor resumed successfully."
        : "Monitor paused successfully.",
      data: { monitor },
    });
  } catch (error) {
    next(error);
  }
};

const deleteMonitor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { monitor_id } = req.params as IdParam<"monitor_id">;
    const body = req.body as DeleteMonitorSchema;
    await monitorService.deleteMonitor(req.user!.id, monitor_id, body);
    return sendSuccess(res, { message: "Monitor deleted successfully." });
  } catch (error) {
    next(error);
  }
};

export default {
  createMonitor,
  getMonitorList,
  getMonitorDetails,
  getMonitorLogs,
  getMonitorIncidents,
  getPublicMonitorStatus,
  updateMonitor,
  toggleMonitor,
  deleteMonitor,
};
