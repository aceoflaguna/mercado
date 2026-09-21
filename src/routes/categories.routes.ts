import { Router } from "express";
import { getCategories, postCategory } from "../controllers/categories.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { createCategorySchema } from "../validators/category.validator";

const router = Router();

router.get("/", asyncHandler(getCategories));
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(createCategorySchema),
  asyncHandler(postCategory)
);

export default router;
