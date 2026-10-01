import { Router } from "express";
import { getUsers, patchUserStatus } from "../controllers/admin.controller";
import {
  getAdminAnnouncements,
  getAdminAnnouncementById,
  postAnnouncement,
  patchAnnouncement,
  removeAnnouncement,
} from "../controllers/announcements.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { updateUserStatusSchema, listUsersQuerySchema } from "../validators/admin.validator";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  listAnnouncementsQuerySchema,
} from "../validators/announcement.validator";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/users", validate(listUsersQuerySchema, "query"), asyncHandler(getUsers));
router.patch("/users/:id/status", validate(updateUserStatusSchema), asyncHandler(patchUserStatus));

router.get("/announcements", validate(listAnnouncementsQuerySchema, "query"), asyncHandler(getAdminAnnouncements));
router.get("/announcements/:id", asyncHandler(getAdminAnnouncementById));
router.post("/announcements", validate(createAnnouncementSchema), asyncHandler(postAnnouncement));
router.patch("/announcements/:id", validate(updateAnnouncementSchema), asyncHandler(patchAnnouncement));
router.delete("/announcements/:id", asyncHandler(removeAnnouncement));

export default router;