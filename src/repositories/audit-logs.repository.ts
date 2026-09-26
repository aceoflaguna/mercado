import { query } from "../config/db";

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  method: string;
  path: string;
  status_code: number;
  request_body: unknown;
  query_params: unknown;
  ip_address: string | null;
  user_agent: string | null;
  duration_ms: number;
  created_at: Date;
}

export interface AuditLogWithUser extends AuditLogRow {
  user_email: string | null;
  user_name: string | null;
}

export async function insertAuditLog(params: {
  userId: string | null;
  method: string;
  path: string;
  statusCode: number;
  requestBody: unknown;
  queryParams: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  durationMs: number;
}): Promise<void> {
  const { userId, method, path, statusCode, requestBody, queryParams, ipAddress, userAgent, durationMs } = params;
  // jsonb columns need an explicit JSON.stringify on write — pg only auto-parses on read, not on write.
  await query(
    `INSERT INTO audit_logs
       (user_id, method, path, status_code, request_body, query_params, ip_address, user_agent, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId,
      method,
      path,
      statusCode,
      requestBody ? JSON.stringify(requestBody) : null,
      queryParams ? JSON.stringify(queryParams) : null,
      ipAddress,
      userAgent,
      durationMs,
    ]
  );
}

export interface ListAuditLogsParams {
  userId?: string;
  method?: string;
  pathContains?: string;
  page: number;
  pageSize: number;
}

export async function listAuditLogs(
  params: ListAuditLogsParams
): Promise<{ items: AuditLogWithUser[]; total: number }> {
  const { userId, method, pathContains, page, pageSize } = params;
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (userId) {
    values.push(userId);
    conditions.push(`a.user_id = $${values.length}`);
  }
  if (method) {
    values.push(method.toUpperCase());
    conditions.push(`a.method = $${values.length}`);
  }
  if (pathContains) {
    values.push(`%${pathContains}%`);
    conditions.push(`a.path ILIKE $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM audit_logs a ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  values.push(pageSize, (page - 1) * pageSize);
  const itemsResult = await query<AuditLogWithUser>(
    `SELECT a.id, a.user_id, u.email AS user_email, u.name AS user_name,
            a.method, a.path, a.status_code, a.request_body, a.query_params,
            a.ip_address, a.user_agent, a.duration_ms, a.created_at
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { items: itemsResult.rows, total };
}