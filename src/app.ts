import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { env } from "./config/env";
import { auditLog } from "./middlewares/audit.middleware";

export function createApp(): Application {
  const app = express();

  // Security & parsing middleware
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use(auditLog);
  
  // Routes
  app.use("/api", routes);

  app.get("/", (_req, res) => {
    res.json({ message: "Mercado API is running" });
  });

  // 404 + error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
