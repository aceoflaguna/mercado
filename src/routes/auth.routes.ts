import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, me, becomeSeller } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireAuth } from "../middlewares/auth.middleware";
import { registerSchema, loginSchema } from "../validators/auth.validator";

const router = Router();

// Slow down credential-guessing attacks without punishing normal use.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many login attempts. Try again later." },
});

router.post("/register", validate(registerSchema), asyncHandler(register));
router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.post("/become-seller", requireAuth, asyncHandler(becomeSeller));

export default router;
