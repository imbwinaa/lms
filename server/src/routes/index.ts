import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import uploadRouter from "./upload";
import lmsRouter from "./lms";
import learnersRouter from "./learners";
import contentRouter from "./content";
import { authenticate } from "../middlewares/auth";
import { notFoundHandler } from "../lib/http";

const router: IRouter = Router();

// Công khai
router.use(healthRouter);
router.use("/auth", authRouter); // /auth/me, /auth/logout tự yêu cầu đăng nhập
router.use("/upload", uploadRouter); // tự yêu cầu đăng nhập (trừ proxy R2)

// Mọi endpoint còn lại yêu cầu đăng nhập
router.use(authenticate);
router.use(lmsRouter);
router.use(learnersRouter);
router.use(contentRouter);
router.use(notFoundHandler);

export default router;
