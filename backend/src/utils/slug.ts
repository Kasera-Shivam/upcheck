import { generateNanoId } from "./crypto";

export const generateUniqueSlug = (name: string): string => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return `${baseSlug || "monitor"}-${generateNanoId()}`;
};
