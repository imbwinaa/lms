import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lmsRouter from "./lms";
import authRouter from "./auth";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/upload", uploadRouter);
router.use(lmsRouter);

export default router;
