import { Router } from "express";
import {
  postCheckout,
  getOrders,
  getOrderById,
  getSellerPendingOrders,
  getSellerSoldItems,
  patchOrderStatus,
} from "../controllers/orders.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { checkoutSchema, updateOrderStatusSchema } from "../validators/order.validator";

const router = Router();

router.use(requireAuth);

router.post("/checkout", validate(checkoutSchema), asyncHandler(postCheckout));
router.get("/seller/pending", requireRole("seller", "admin"), asyncHandler(getSellerPendingOrders));
router.get("/seller/sold-items", requireRole("seller", "admin"), asyncHandler(getSellerSoldItems));
router.get("/", asyncHandler(getOrders));
router.get("/:id", asyncHandler(getOrderById));
router.patch("/:id/status", validate(updateOrderStatusSchema), asyncHandler(patchOrderStatus));



export default router;