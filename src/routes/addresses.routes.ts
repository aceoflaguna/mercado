import { Router } from "express";
import { getAddresses, postAddress, patchAddress, removeAddress } from "../controllers/addresses.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth } from "../middlewares/auth.middleware";
import { createAddressSchema, updateAddressSchema } from "../validators/address.validator";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(getAddresses));
router.post("/", validate(createAddressSchema), asyncHandler(postAddress));
router.patch("/:id", validate(updateAddressSchema), asyncHandler(patchAddress));
router.delete("/:id", asyncHandler(removeAddress));

export default router;