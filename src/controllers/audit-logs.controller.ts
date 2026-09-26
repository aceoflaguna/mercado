import { Request, Response } from "express";
import { listAuditLogs } from "../repositories/audit-logs.repository";

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const { userId, method, path, page, pageSize } = req.query as unknown as {
    userId?: string;
    method?: string;
    path?: string;
    page: number;
    pageSize: number;
  };

  const { items, total } = await listAuditLogs({ userId, method, pathContains: path, page, pageSize });

  res.status(200).json({
    status: "ok",
    data: items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}