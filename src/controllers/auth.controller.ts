import { Request, Response } from "express";
import { hashPassword, verifyPassword } from "../utils/argon";
import { createSession, deleteSessionByToken, deleteAllSessionsForUser } from "../repositories/sessions.repository";
import { sendEmail } from "../utils/mailer";
import { env } from "../config/env";
import {
  createVerificationToken,
  consumeVerificationToken,
  invalidateTokensForUser,
} from "../repositories/verification-tokens.repository";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserRole,
  updateUserProfile,
  updateUserPassword,
  markEmailVerified,
  toPublicUser,
} from "../repositories/users.repository";

import { UnauthorizedError, NotFoundError, BadRequestError } from "../types/errors";

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as { email: string; password: string; name: string };

  const passwordHash = await hashPassword(password);
  const user = await createUser({ email, passwordHash, name });
  const token = await createSession(user.id, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  const verifyToken = await createVerificationToken(user.id, "email_verification");
  sendEmail(
    user.email,
    "Verify your Mercado email",
    `<p>Welcome to Mercado! Confirm your email to finish setting up your account.</p>
     <p><a href="${env.frontendUrl}/#/verify-email?token=${verifyToken}">Verify my email</a></p>
     <p>This link expires in 24 hours.</p>`
  ).catch((err) => console.error("Failed to send verification email:", err));

  res.status(201).json({ status: "ok", data: { user: toPublicUser(user), token } });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const user = await findUserByEmail(email);
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }
  const validPassword = await verifyPassword(user.password_hash, password);
  if (!validPassword) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = await createSession(user.id, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  res.status(200).json({ status: "ok", data: { user: toPublicUser(user), token } });
}

export async function me(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  res.status(200).json({ status: "ok", data: toPublicUser(user) });
}

/**
 * Everyone registers as a plain "buyer" (email+password only, no role picker
 * at signup). This endpoint is the "start selling" upgrade path — a buyer
 * can promote their own account to "seller" so they can list products.
 * Issues a fresh token since the role is embedded in the JWT payload.
 */
export async function becomeSeller(req: Request, res: Response): Promise<void> {
  // throw new BadRequestError(`Seller promotion is temporarily disabled.`);
  const userId = req.user!.sub;
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (user.role !== "buyer") {
    throw new BadRequestError(`Account already has role "${user.role}"`);
  }

  const updated = await updateUserRole(userId, "seller");
  res.status(200).json({ status: "ok", data: { user: toPublicUser(updated!) } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const header = req.headers.authorization!; // requireAuth already validated this exists
  const token = header.slice("Bearer ".length);
  await deleteSessionByToken(token);
  res.status(204).send();
}

export async function patchProfile(req: Request, res: Response): Promise<void> {
  const { name } = req.body as { name: string };
  const updated = await updateUserProfile(req.user!.sub, name);
  if (!updated) throw new NotFoundError("User not found");
  res.status(200).json({ status: "ok", data: toPublicUser(updated) });
}

export async function patchPassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  const user = await findUserById(req.user!.sub);
  if (!user) throw new NotFoundError("User not found");

  const valid = await verifyPassword(user.password_hash, currentPassword);
  if (!valid) throw new UnauthorizedError("Current password is incorrect");
  if (currentPassword === newPassword) {
    throw new BadRequestError("New password must be different from the current password");
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUserPassword(user.id, passwordHash);

  // Changing the password invalidates every existing session (including this
  // one) as a security measure, then immediately issues a fresh session for
  // the device that just made the change, so the caller isn't logged out.
  await deleteAllSessionsForUser(user.id);
  const token = await createSession(user.id, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  res.status(200).json({ status: "ok", data: { token } });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body as { token: string };
  const record = await consumeVerificationToken(token, "email_verification");
  if (!record) {
    throw new BadRequestError("This verification link is invalid or has expired.");
  }
  await markEmailVerified(record.user_id);
  res.status(200).json({ status: "ok", message: "Email verified." });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const user = await findUserById(req.user!.sub);
  if (!user) throw new NotFoundError("User not found");
  if (user.email_verified_at) {
    throw new BadRequestError("Email is already verified.");
  }

  await invalidateTokensForUser(user.id, "email_verification");
  const token = await createVerificationToken(user.id, "email_verification");
  await sendEmail(
    user.email,
    "Verify your Mercado email",
    `<p><a href="${env.frontendUrl}/#/verify-email?token=${token}">Verify my email</a></p>`
  );
  res.status(200).json({ status: "ok", message: "Verification email sent." });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };
  const user = await findUserByEmail(email);

  // Always respond the same way whether or not the email is registered —
  // otherwise this endpoint becomes a way to enumerate valid accounts.
  if (user) {
    await invalidateTokensForUser(user.id, "password_reset");
    const token = await createVerificationToken(user.id, "password_reset");
    sendEmail(
      user.email,
      "Reset your Mercado password",
      `<p>Someone requested a password reset for this account. If this wasn't you, ignore this email.</p>
       <p><a href="${env.frontendUrl}/#/reset-password?token=${token}">Reset my password</a></p>
       <p>This link expires in 1 hour.</p>`
    ).catch((err) => console.error("Failed to send password reset email:", err));
  }

  res.status(200).json({ status: "ok", message: "If that email is registered, a reset link has been sent." });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body as { token: string; newPassword: string };

  const record = await consumeVerificationToken(token, "password_reset");
  if (!record) {
    throw new BadRequestError("This reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUserPassword(record.user_id, passwordHash);
  await deleteAllSessionsForUser(record.user_id); // same precedent as the change-password flow

  const sessionToken = await createSession(record.user_id, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  const user = await findUserById(record.user_id);

  res.status(200).json({ status: "ok", data: { user: toPublicUser(user!), token: sessionToken } });
}