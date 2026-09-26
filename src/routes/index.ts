import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import categoriesRoutes from "./categories.routes";
import productsRoutes from "./products.routes";
import cartRoutes from "./cart.routes";
import ordersRoutes from "./orders.routes";
import addressesRoutes from "./addresses.routes";
import auditLogsRoutes from "./audit-logs.routes";
import conversationsRoutes from "./conversations.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/categories", categoriesRoutes);
router.use("/products", productsRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", ordersRoutes);
router.use("/addresses", addressesRoutes);
router.use("/audit-logs", auditLogsRoutes);
router.use("/conversations", conversationsRoutes);

export default router;
