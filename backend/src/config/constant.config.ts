const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SESSION_COOKIE_NAME = "upcheck_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const constant = {
  BASE62_CHARS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  COOLDOWN_MS,
  MAX_OTP_ATTEMPTS,
} as const;

export default constant;
