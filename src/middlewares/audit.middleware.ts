import { Request, Response, NextFunction } from "express";
import { insertAuditLog } from "../repositories/audit-logs.repository";

// Fields redacted wherever they appear, at any nesting depth, in a logged
// request body — never store raw credentials, even in an audit trail.
const SENSITIVE_KEYS = new Set(["password", "currentPassword", "newPassword", "password_hash", "token","fullAddress"]);

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : redact(val);
  }
  return result;
}

const EXCLUDED_PREFIXES = [
  "/api/health",
  "/api/conversations"
];

export function auditLog(req: Request, res: Response, next: NextFunction): void {
  let pathRequest = req.path;
  if (EXCLUDED_PREFIXES.some(p => pathRequest === p || pathRequest.startsWith(p + "/"))) {
    next();
    return;
  }

  const startedAt = Date.now();
  let path = req.path;
  // 'finish' fires after the response is fully sent — by then requireAuth
  // (if this route has it) has already run and set req.user, so it's safe
  // to read here even though this middleware itself runs before routing.
  res.on("finish", () => {
    insertAuditLog({
      userId: req.user?.sub ?? null,
      method: req.method,
      path: path,
      statusCode: res.statusCode,
      requestBody: req.body && Object.keys(req.body).length > 0 ? redact(req.body) : null,
      queryParams: req.query && Object.keys(req.query).length > 0 ? redact(req.query) : null,
      ipAddress: req.ip,
      userAgent: (req.headers["user-agent"] as string) ?? null,
      durationMs: Date.now() - startedAt,
    }).catch((err) => {
      // Never let a logging failure surface to the client or crash the process.
      console.error("Failed to write audit log:", err);
    });
  });

  next();
}