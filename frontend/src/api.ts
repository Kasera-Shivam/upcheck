type Opts = { method?: string; body?: unknown; form?: FormData };

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

async function req<T = any>(
  path: string,
  { method = "GET", body, form }: Opts = {},
) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw Object.assign(new Error(json.message || "Something went wrong."), {
      status: res.status,
    });
  return json as { message?: string; data: T };
}

export const api = {
  get: <T = any>(p: string) => req<T>(p),
  post: <T = any>(p: string, body?: unknown) =>
    req<T>(p, { method: "POST", body }),
  patch: <T = any>(p: string, body?: unknown) =>
    req<T>(p, { method: "PATCH", body }),
  del: <T = any>(p: string, body?: unknown) =>
    req<T>(p, { method: "DELETE", body }),
  upload: <T = any>(p: string, form: FormData) =>
    req<T>(p, { method: "PATCH", form }),
};

export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(
    ([k, v]) =>
      v !== undefined && v !== "" && v !== null && p.set(k, String(v)),
  );
  const s = p.toString();
  return s ? "?" + s : "";
};
