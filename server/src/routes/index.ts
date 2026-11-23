import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import uploadRouter from "./upload";
import lmsRouter from "./lms";
import accountsRouter from "./accounts";
import contentRouter from "./content";
import studioRouter from "./studio";
import sessionsRouter from "./sessions";
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
router.use(accountsRouter);
router.use(contentRouter);
router.use(studioRouter);
router.use(sessionsRouter);
router.use(notFoundHandler);

export default router;
