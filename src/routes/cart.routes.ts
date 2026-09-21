import { Router } from "express";
import { getCart, postCartItem, patchCartItem, deleteCartItem } from "../controllers/cart.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth.middleware";
import { addToCartSchema, updateCartItemSchema } from "../validators/cart.validator";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(getCart));
router.post("/items", validate(addToCartSchema), asyncHandler(postCartItem));
router.patch("/items/:productId", validate(updateCartItemSchema), asyncHandler(patchCartItem));
router.delete("/items/:productId", asyncHandler(deleteCartItem));

export default router;
