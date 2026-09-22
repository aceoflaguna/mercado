import { Request, Response, NextFunction } from "express";
import { findSessionByToken, touchSession } from "../repositories/sessions.repository";
import { findUserById } from "../repositories/users.repository";
import { UnauthorizedError, ForbiddenError } from "../types/errors";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or malformed Authorization header"));
    return;
  }
  const token = header.slice("Bearer ".length);

  try {
    const session = await findSessionByToken(token);
    if (!session) {
      next(new UnauthorizedError("Invalid or expired session"));
      return;
    }
    // Role is read fresh from the DB on every request — no stale role baked into a token,
    // so become-seller (or any future role change) takes effect immediately.
    const user = await findUserById(session.user_id);
    if (!user) {
      next(new UnauthorizedError("Invalid or expired session"));
      return;
    }
    req.user = { sub: user.id, role: user.role };
    touchSession(session.id).catch(() => {}); // best-effort, don't block the request on this
    next();
  } catch (err) {
    next(err);
  }
}

/** Use after requireAuth. Restricts a route to one or more roles. */
export function requireRole(...roles: Array<"buyer" | "seller" | "admin">) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`Requires role: ${roles.join(" or ")}`));
      return;
    }
    next();
  };
}