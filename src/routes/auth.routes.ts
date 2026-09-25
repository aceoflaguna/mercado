import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me, becomeSeller, logout, patchProfile, patchPassword } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireAuth } from "../middlewares/auth.middleware";
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from "../validators/auth.validator";

const router = Router();

// Slow down credential-guessing attacks without punishing normal use.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many login attempts. Try again later." },
});

router.post("/register", limiter, validate(registerSchema), asyncHandler(register));
router.post("/login", limiter, validate(loginSchema), asyncHandler(login));
router.patch("/me", requireAuth, validate(updateProfileSchema), asyncHandler(patchProfile));
router.patch("/me/password", requireAuth, validate(changePasswordSchema), asyncHandler(patchPassword));
router.post("/logout", requireAuth, asyncHandler(logout));
router.post("/become-seller", requireAuth, asyncHandler(becomeSeller));

export default router;
