import z from "zod";

export const nanoIdSchema = z
  .string()
  .trim()
  .length(11, "Invalid ID format.")
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid ID characters.");

export const createIdParamSchema = <T extends string>(paramName: T) =>
  z.object({
    [paramName]: nanoIdSchema,
  }) as z.ZodObject<Record<T, typeof nanoIdSchema>>;

export type NanoId = z.infer<typeof nanoIdSchema>;
export type IdParam<T extends string> = Record<T, NanoId>;
