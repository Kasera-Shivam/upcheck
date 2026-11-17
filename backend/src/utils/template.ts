import fs from "node:fs";
import path from "node:path";
import dirname from "../../dirname";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const templateCache = new Map<string, string>();

export const readTemplate = (
  fileName: string,
  replacements: Record<string, unknown> = {},
): string => {
  let template = templateCache.get(fileName);
  if (template === undefined) {
    template = fs.readFileSync(
      path.join(dirname, "src", "templates", fileName),
      "utf8",
    );
    templateCache.set(fileName, template);
  }
  return template.replace(/{{(\w+)}}/g, (_, key: string) =>
    escapeHtml(String(replacements[key] ?? "")),
  );
};
