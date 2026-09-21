import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.pgSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  // Errors on idle clients in the pool — log and let the process supervisor decide.
  console.error("Unexpected error on idle Postgres client", err);
});

/**
 * Run a single parameterized query against the pool.
 * Always use parameterized queries ($1, $2, ...) — never string-concatenate user input into SQL.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Run a callback inside a transaction. Commits on success, rolls back on error.
 * Use this for any multi-statement write that must be atomic (e.g. checkout).
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
