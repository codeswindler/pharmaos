import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import inventoryRouter from "./inventory";
import dashboardRouter from "./dashboard";
import messagesRouter from "./messages";
import authRouter from "./auth";
import adminRouter from "./admin";
import adminSettingsRouter from "./admin-settings";
import staffRouter from "./staff";
import checkoutsRouter from "./checkouts";
import paymentsRouter from "./payments";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/payments", paymentsRouter);
router.use("/messages", messagesRouter);
router.use(requireAuth);
router.use("/admin/settings", adminSettingsRouter);
router.use("/admin", adminRouter);
router.use("/staff", staffRouter);
router.use("/products", productsRouter);
router.use("/inventory", inventoryRouter);
router.use("/checkouts", checkoutsRouter);
router.use("/dashboard", dashboardRouter);

export default router;
