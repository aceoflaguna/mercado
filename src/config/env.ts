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

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  argon2: {
    memoryCost: process.env.ARGON2_MEMORY_COST ? Number(process.env.ARGON2_MEMORY_COST) : 19456,
    timeCost: process.env.ARGON2_TIME_COST ? Number(process.env.ARGON2_TIME_COST) : 2,
    parallelism: process.env.ARGON2_PARALLELISM ? Number(process.env.ARGON2_PARALLELISM) : 1,
  },
} as const;
