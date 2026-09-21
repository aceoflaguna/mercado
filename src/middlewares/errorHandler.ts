import { Request, Response, NextFunction } from "express";
import { AppError } from "../types/errors";
import { env } from "../config/env";

interface PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

function isPgError(err: unknown): err is PgError {
  return err instanceof Error && typeof (err as PgError).code === "string";
}

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

function isJsonBodyParseError(err: unknown): err is BodyParserError {
  return (
    err instanceof SyntaxError &&
    (err as BodyParserError).status === 400 &&
    "body" in err
  );
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ status: "error", message: err.message });
    return;
  }

  // express.json() throws a SyntaxError for malformed request bodies — return
  // a clean 400 instead of letting it fall through to the generic 500 below.
  if (isJsonBodyParseError(err)) {
    res.status(400).json({ status: "error", message: "Malformed JSON in request body" });
    return;
  }

  // Translate common Postgres error codes into clean HTTP responses instead
  // of leaking raw DB errors to clients.
  if (isPgError(err)) {
    switch (err.code) {
      case "23505": // unique_violation
        res.status(409).json({ status: "error", message: "Resource already exists" });
        return;
      case "23503": // foreign_key_violation
        res.status(400).json({ status: "error", message: "Referenced resource does not exist" });
        return;
      case "23514": // check_violation
        res.status(400).json({ status: "error", message: "Invalid value for one or more fields" });
        return;
    }
  }

  console.error("Unexpected error:", err);
  res.status(500).json({
    status: "error",
    message: env.nodeEnv === "production" ? "Internal server error" : err.message,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: "error",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}
