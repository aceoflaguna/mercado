import { Router } from "express";
import {
  postStartConversation,
  postStartConversationFromOrder,
  getConversations,
  getConversationMessages,
  postConversationMessage,
} from "../controllers/conversations.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";
import { startConversationSchema, messageBodySchema } from "../validators/message.validator";

const router = Router();
router.use(requireAuth);

router.post("/", validate(startConversationSchema), asyncHandler(postStartConversation));
router.post(
  "/from-order/:orderId",
  requireRole("seller", "admin"),
  asyncHandler(postStartConversationFromOrder)
);
router.get("/", asyncHandler(getConversations));
router.get("/:id/messages", asyncHandler(getConversationMessages));
router.post("/:id/messages", validate(messageBodySchema), asyncHandler(postConversationMessage));

export default router;