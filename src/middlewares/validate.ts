import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { BadRequestError } from "../types/errors";

type Target = "body" | "params" | "query";

export function validate(schema: AnyZodObject, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors
          .map((e) => `${e.path.join(".") || target}: ${e.message}`)
          .join("; ");
        throw new BadRequestError(message);
      }
      throw err;
    }
  };
}
