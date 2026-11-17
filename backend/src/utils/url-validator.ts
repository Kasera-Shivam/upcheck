import dns from "node:dns/promises";
import net from "node:net";

const isPrivateIPv4 = (ip: string): boolean => {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  )
    return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 || // 0.0.0.0/8 (Current network)
    a === 10 || // 10.0.0.0/8 (Private network)
    a === 127 || // 127.0.0.0/8 (Loopback / localhost)
    (a === 169 && b === 254) || // 169.254.0.0/16 (Link-local & AWS/GCP Metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (Private network)
    (a === 192 && b === 168) || // 192.168.0.0/16 (Home/Office LAN)
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (Carrier-grade NAT)
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 (Benchmark testing)
    a >= 224 // 224.0.0.0+ (Multicast & Reserved)
  );
};

const isPrivateIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase().trim();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("::ffff:")) {
    const embeddedIpv4 = normalized.slice(7);
    if (net.isIPv4(embeddedIpv4)) return isPrivateIPv4(embeddedIpv4);
  }
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  )
    return true;
  return false;
};

export const isRestrictedIP = (ip: string): boolean => {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
};

export const validatePublicUrl = async (
  rawUrl: string,
): Promise<{
  valid: boolean;
  reason?: string;
  normalizedUrl?: string;
}> => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "Invalid URL format." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return {
      valid: false,
      reason: "Only HTTP and HTTPS protocols are allowed.",
    };
  if (parsed.username || parsed.password)
    return {
      valid: false,
      reason: "URLs with embedded credentials are not allowed.",
    };
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  )
    return {
      valid: false,
      reason: "Local or internal hostnames are not allowed.",
    };
  if (net.isIP(hostname) !== 0) {
    if (isRestrictedIP(hostname))
      return {
        valid: false,
        reason: "Private or reserved IP addresses are not allowed.",
      };
    return { valid: true, normalizedUrl: parsed.toString() };
  }
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0)
      return { valid: false, reason: "Domain could not be resolved." };
    for (const record of records)
      if (isRestrictedIP(record.address))
        return {
          valid: false,
          reason: "Domain resolves to a private or restricted IP address.",
        };
  } catch {
    return { valid: false, reason: "Unable to resolve domain DNS." };
  }
  return { valid: true, normalizedUrl: parsed.toString() };
};
