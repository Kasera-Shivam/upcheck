import postgres from "postgres";
import type { PGWrappedError } from "../@types";

export const isPgError = (error: unknown): error is PGWrappedError => {
  if (!error || typeof error !== "object") return false;
  if (
    "cause" in error &&
    (error as { cause: unknown }).cause instanceof postgres.PostgresError
  )
    return true;
  return false;
};

export const isUniqueViolation = (error: unknown): error is PGWrappedError =>
  isPgError(error) && error.cause.code === "23505";

export const isForeignKeyViolation = (
  error: unknown,
): error is PGWrappedError => isPgError(error) && error.cause.code === "23503";
