import { Router } from "express";
import { postCheckout, getOrders, getOrderById } from "../controllers/orders.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth.middleware";
import { checkoutSchema } from "../validators/order.validator";

const router = Router();

router.use(requireAuth);

router.post("/checkout", validate(checkoutSchema), asyncHandler(postCheckout));
router.get("/", asyncHandler(getOrders));
router.get("/:id", asyncHandler(getOrderById));

export default router;
