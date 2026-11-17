import env from "../config/env.config";
import type { Request, Response, NextFunction } from "express";
import { isHttpError } from "http-errors";
import { StatusCodes } from "http-status-codes";
import multer from "multer";

const MULTER_ERROR_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: "File size exceeds the allowed limit (max 3MB).",
  LIMIT_FILE_COUNT: "Too many files uploaded.",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field name.",
};

export const errorMiddleware = async (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (env.NODE_ENV !== "production") console.error(err);
  if (err instanceof multer.MulterError) {
    const message =
      MULTER_ERROR_MESSAGES[err.code] ?? err.message ?? "File upload error.";
    return res.status(StatusCodes.BAD_REQUEST).json({ message });
  }
  if (isHttpError(err))
    return res.status(err.status).json({ message: err.message });
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ message: "Something went wrong." });
};
