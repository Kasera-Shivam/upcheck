import constant from "../config/constant.config";
import crypto from "node:crypto";

const OUR_EPOCH = 1704067200000n;
const MAX_RANDOM_4_CHARS = 14_776_336;

export const toBase62 = (val: bigint | number | string): string => {
  let q = BigInt(val);
  if (q === 0n) return "0";
  let result = "";
  const base = 62n;
  while (q > 0n) {
    const remainder = Number(q % base);
    result = constant.BASE62_CHARS[remainder] + result;
    q = q / base;
  }
  return result;
};

export const generateNanoId = (): string => {
  const nowMillis = BigInt(Date.now()) - OUR_EPOCH;
  const timePart = toBase62(nowMillis).padStart(7, "0").slice(-7);
  const randomNum = crypto.randomInt(0, MAX_RANDOM_4_CHARS);
  const randomPart = toBase62(randomNum).padStart(4, "0").slice(-4);
  return timePart + randomPart;
};

export const generateNumericSlug = (): string => {
  const nowMillis = (BigInt(Date.now()) - OUR_EPOCH).toString();
  const randomDigits = crypto.randomInt(1000, 10000).toString();
  return `${nowMillis}${randomDigits}`;
};

export const generateToken = (): string =>
  crypto.randomBytes(32).toString("base64url");

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const generateOtp = (digits = 6): string => {
  const max = 10 ** digits;
  return crypto.randomInt(0, max).toString().padStart(digits, "0");
};

export const createTokenPair = (expiresInMs = constant.SESSION_MAX_AGE_MS) => {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiresInMs);
  return { token, tokenHash, expiresAt };
};

export const createOtpPair = (expiresInMs = 10 * 60 * 1000) => {
  const otp = generateOtp();
  const otpHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + expiresInMs);
  return { otp, otpHash, expiresAt };
};

export const verifyTokenHash = (
  rawToken: string,
  storedHash: string,
): boolean => {
  const inputHash = hashToken(rawToken);
  const inputBuffer = Buffer.from(inputHash, "hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  if (inputBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(inputBuffer, storedBuffer);
};

export const hashPassword = async (password: string): Promise<string> =>
  await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => await Bun.password.verify(password, hash, "bcrypt");
