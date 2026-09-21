import { env } from "./config/env";
import { createApp } from "./app";
import { pool } from "./config/db";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🚀 Mercado API running at http://localhost:${env.port}`);
});

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    console.log("Server and DB pool closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
