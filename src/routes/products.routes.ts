import { Router } from "express";
import {
  getProducts, getProductById, postProduct, patchProduct, removeProduct,
  postProductImage, removeProductImage,
} from "../controllers/products.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from "../validators/product.validator";
import { addProductImageSchema } from "../validators/product-image.validator";
import rateLimit from "express-rate-limit";

// Slow down attacks without punishing normal use.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many login attempts. Try again later." },
});

const router = Router();

router.get("/", limiter, validate(listProductsQuerySchema, "query"), asyncHandler(getProducts));
router.get("/:id", limiter, asyncHandler(getProductById));

router.post(
  "/",
  requireAuth,
  requireRole("seller", "admin"),
  validate(createProductSchema),
  asyncHandler(postProduct)
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("seller", "admin"),
  validate(updateProductSchema),
  asyncHandler(patchProduct)
);
router.delete("/:id", requireAuth, requireRole("seller", "admin"), asyncHandler(removeProduct));
router.post(
  "/:id/images",
  requireAuth,
  requireRole("seller", "admin"),
  validate(addProductImageSchema),
  asyncHandler(postProductImage)
);
router.delete(
  "/:id/images/:imageId",
  requireAuth,
  requireRole("seller", "admin"),
  asyncHandler(removeProductImage)
);

export default router;
