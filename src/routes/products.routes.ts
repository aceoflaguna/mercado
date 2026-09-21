import { Router } from "express";
import {
  getProducts,
  getProductById,
  postProduct,
  patchProduct,
  removeProduct,
} from "../controllers/products.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from "../validators/product.validator";

const router = Router();

router.get("/", validate(listProductsQuerySchema, "query"), asyncHandler(getProducts));
router.get("/:id", asyncHandler(getProductById));

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

export default router;
