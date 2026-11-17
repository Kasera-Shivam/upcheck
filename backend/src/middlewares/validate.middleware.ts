import type { Schemas } from "../@types";
import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";

export const validateSchema =
  (schemas: Schemas) => (req: Request, res: Response, next: NextFunction) => {
    const sources = {
      query: req.query,
      params: req.params,
      body: req.body ?? {},
    } as const;
    for (const key of ["query", "params", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(sources[key]);
      if (!result.success) {
        const issue = result.error.issues[0];
        const message = issue ? issue.message : "Something went wrong.";
        return next(new createHttpError.BadRequest(message));
      }
      if (key === "body") req.body = result.data;
      else res.locals[key] = result.data;
    }
    next();
  };
