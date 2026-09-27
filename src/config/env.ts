import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  corsOrigin: process.env.CORS_ORIGIN ?? "*",

  databaseUrl: required("DATABASE_URL"),
  pgSsl: process.env.PGSSL === "true",

  sessionTtlDays: process.env.SESSION_TTL_DAYS ? Number(process.env.SESSION_TTL_DAYS) : 7,

  argon2: {
    memoryCost: process.env.ARGON2_MEMORY_COST ? Number(process.env.ARGON2_MEMORY_COST) : 19456,
    timeCost: process.env.ARGON2_TIME_COST ? Number(process.env.ARGON2_TIME_COST) : 2,
    parallelism: process.env.ARGON2_PARALLELISM ? Number(process.env.ARGON2_PARALLELISM) : 1,
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Mercado <no-reply@mercado.test>",
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
} as const;
