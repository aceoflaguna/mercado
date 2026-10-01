import { Router } from "express";
import { getAnnouncements, getAnnouncementById } from "../controllers/announcements.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { listAnnouncementsQuerySchema } from "../validators/announcement.validator";

const router = Router();

router.get("/", validate(listAnnouncementsQuerySchema, "query"), asyncHandler(getAnnouncements));
router.get("/:id", asyncHandler(getAnnouncementById));

export default router;