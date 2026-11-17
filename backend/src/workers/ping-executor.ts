import { validatePublicUrl } from "../utils/url-validator";

export interface PingResult {
  isUp: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
}

interface PingTarget {
  url: string;
  method: "GET" | "POST" | "HEAD";
  timeoutSeconds: number;
}

export const executeHttpPing = async ({
  url,
  method,
  timeoutSeconds,
}: PingTarget): Promise<PingResult> => {
  const urlCheck = await validatePublicUrl(url);
  if (!urlCheck.valid || !urlCheck.normalizedUrl)
    return {
      isUp: false,
      statusCode: null,
      responseTimeMs: null,
      errorMessage: urlCheck.reason ?? "Blocked by SSRF security policy.",
    };
  const controller = new AbortController();
  const timeoutMs = timeoutSeconds * 1000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = performance.now();
  try {
    const response = await fetch(urlCheck.normalizedUrl, {
      method,
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "User-Agent": "UptimeMonitorBot/1.0 (+https://yourapp.com)",
        Accept: "*/*",
      },
    });
    const responseTimeMs = Math.round(performance.now() - startTime);
    const statusCode = response.status;
    await response.body?.cancel().catch(() => {});
    const isUp = statusCode >= 200 && statusCode < 400;
    return {
      isUp,
      statusCode,
      responseTimeMs,
      errorMessage: isUp
        ? null
        : `HTTP ${statusCode} ${response.statusText || "Error"}`.trim(),
    };
  } catch (error: any) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    if (error?.name === "AbortError")
      return {
        isUp: false,
        statusCode: null,
        responseTimeMs,
        errorMessage: `Request timed out after ${timeoutSeconds}s`,
      };
    const causeCode = error?.cause?.code;
    const rawMessage =
      error?.cause?.message || error?.message || "Network error";
    return {
      isUp: false,
      statusCode: null,
      responseTimeMs,
      errorMessage: causeCode ? `${causeCode}: ${rawMessage}` : rawMessage,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
