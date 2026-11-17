import type { NanoId } from "../../schemas/common.schema";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import db from "../../db";
import { accounts, sessions, users } from "../../db/schema";
import type {
  ChangePasswordSchema,
  RevokeSessionsQuerySchema,
  UpdateAccountSchema,
} from "./account.schema";
import createHttpError from "http-errors";
import { isUniqueViolation } from "../../utils/pg-error";
import {
  deleteAvatarFromCloudinary,
  uploadAvatarToCloudinary,
} from "../../config/cloudinary.config";
import { hashPassword, verifyPassword } from "../../utils/crypto";

const checkUsernameAvailability = async (
  username: string,
  currentUserId?: NanoId,
) => {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      currentUserId
        ? and(
            sql`LOWER(${users.username}) = LOWER(${username})`,
            ne(users.id, currentUserId),
          )
        : sql`LOWER(${users.username}) = LOWER(${username})`,
    )
    .limit(1);
  return { existing, available: !existing };
};

const updateAccount = async (userId: NanoId, input: UpdateAccountSchema) => {
  if (input.username) {
    const { available } = await checkUsernameAvailability(
      input.username,
      userId,
    );
    if (!available)
      throw new createHttpError.Conflict("This username is already taken.");
  }
  try {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...(input.username !== undefined && { username: input.username }),
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!updatedUser) throw new createHttpError.NotFound("User not found.");
    return updatedUser;
  } catch (error) {
    if (isUniqueViolation(error))
      throw new createHttpError.Conflict("This username is already taken.");
    throw error;
  }
};

const updateAvatar = async (userId: NanoId, file?: Express.Multer.File) => {
  if (!file)
    throw new createHttpError.BadRequest("Avatar image file is required.");
  const avatarUrl = await uploadAvatarToCloudinary(file.buffer, userId);
  const [updatedUser] = await db
    .update(users)
    .set({ avatar: avatarUrl })
    .where(eq(users.id, userId))
    .returning();
  if (!updatedUser) throw new createHttpError.NotFound("User not found.");
  return updatedUser;
};

const removeAvatar = async (userId: NanoId) => {
  await deleteAvatarFromCloudinary(userId);
  const [updatedUser] = await db
    .update(users)
    .set({ avatar: null })
    .where(eq(users.id, userId))
    .returning();
  if (!updatedUser) throw new createHttpError.NotFound("User not found.");
  return updatedUser;
};

const changePassword = async (
  user: { id: NanoId; email: string },
  input: ChangePasswordSchema,
  currentSessionId?: NanoId,
) => {
  const [credentialAccount] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.provider, "credentials"), eq(accounts.userId, user.id)),
    )
    .limit(1);
  const newPasswordHash = await hashPassword(input.newPassword);
  if (!credentialAccount || !credentialAccount.password) {
    await db.insert(accounts).values({
      userId: user.id,
      provider: "credentials",
      providerId: user.email,
      password: newPasswordHash,
    });
    return { isNewlyCreated: true };
  }
  if (!input.currentPassword)
    throw new createHttpError.BadRequest("Current password is required.");
  const isPasswordMatch = await verifyPassword(
    input.currentPassword,
    credentialAccount.password,
  );
  if (!isPasswordMatch)
    throw new createHttpError.Unauthorized("Current password is incorrect.");
  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ password: newPasswordHash })
      .where(eq(accounts.id, credentialAccount.id));
    if (currentSessionId)
      await tx
        .delete(sessions)
        .where(
          and(eq(sessions.userId, user.id), ne(sessions.id, currentSessionId)),
        );
  });
  return { isNewlyCreated: false };
};

const getSecurityOverview = async (
  userId: NanoId,
  currentSessionId?: NanoId,
) => {
  const [linkedAccounts, activeSessions] = await Promise.all([
    db
      .select({
        id: accounts.id,
        provider: accounts.provider,
        providerId: accounts.providerId,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId)),
    db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())),
      )
      .orderBy(desc(sessions.createdAt)),
  ]);
  const providers = linkedAccounts.map((acc) => acc.provider);
  return {
    providers: {
      hasGoogle: providers.includes("google"),
      hasCredentials: providers.includes("credentials"),
      accounts: linkedAccounts,
    },
    sessions: activeSessions.map((session) => ({
      ...session,
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    })),
  };
};

const revokeSessions = async (
  userId: NanoId,
  query: RevokeSessionsQuerySchema,
  currentSessionId?: NanoId,
) => {
  if (query.allOther) {
    if (!currentSessionId)
      throw new createHttpError.BadRequest("Current session not found.");
    await db
      .delete(sessions)
      .where(
        and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)),
      );
    return "All other sessions revoked successfully.";
  }
  if (currentSessionId && query.sessionId === currentSessionId)
    throw new createHttpError.BadRequest(
      "Cannot revoke your current active session. Use logout instead.",
    );
  const [deleted] = await db
    .delete(sessions)
    .where(and(eq(sessions.id, query.sessionId!), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  if (!deleted) throw new createHttpError.NotFound("Session not found.");
  return "Session revoked successfully.";
};

export default {
  checkUsernameAvailability,
  updateAccount,
  updateAvatar,
  removeAvatar,
  changePassword,
  getSecurityOverview,
  revokeSessions,
};
