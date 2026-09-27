import { Router } from "express";
import { getUsers, patchUserStatus } from "../controllers/admin.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { updateUserStatusSchema, listUsersQuerySchema } from "../validators/admin.validator";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/users", validate(listUsersQuerySchema, "query"), asyncHandler(getUsers));
router.patch("/users/:id/status", validate(updateUserStatusSchema), asyncHandler(patchUserStatus));

export default router;