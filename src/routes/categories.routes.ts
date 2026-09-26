import { Router } from "express";
import { getCategories, postCategory } from "../controllers/categories.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { createCategorySchema } from "../validators/category.validator";
import rateLimit from "express-rate-limit";
import { getCategories, postCategory, patchCategory } from "../controllers/categories.controller";
import { createCategorySchema, updateCategorySchema } from "../validators/category.validator";

// Slow down attacks without punishing normal use.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many login attempts. Try again later." },
});

const router = Router();

router.get("/", limiter, asyncHandler(getCategories));
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(createCategorySchema),
  asyncHandler(postCategory)
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(updateCategorySchema),
  asyncHandler(patchCategory)
);

export default router;
