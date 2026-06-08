import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import customersRouter from "./customers";
import inventoryRouter from "./inventory";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import messagesRouter from "./messages";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/products", productsRouter);
router.use("/customers", customersRouter);
router.use("/inventory", inventoryRouter);
router.use("/transactions", transactionsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/messages", messagesRouter);

export default router;
