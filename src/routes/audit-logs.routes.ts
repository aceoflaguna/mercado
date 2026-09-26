import { Router } from "express";
import { getAuditLogs } from "../controllers/audit-logs.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { listAuditLogsQuerySchema } from "../validators/audit-log.validator";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", validate(listAuditLogsQuerySchema, "query"), asyncHandler(getAuditLogs));

export default router;