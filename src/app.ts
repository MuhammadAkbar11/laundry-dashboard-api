import express from "express";
import cors from "cors";
import helmet from "helmet";
import useragent from "express-useragent";
import requestIp from "request-ip";
import cookieParser from "cookie-parser";
import DemoRouter from "./app/demo/demo.routes";
import pinoHttpLogger from "./middlewares/logging.middleware";
import {
  correlationIdMiddleware,
  correlationIdResponseHeaderMiddleware,
} from "./middlewares/correlation.middleware";
import { ENV_STATIC_FOLDER_PATH, STATIC_FOLDER } from "./configs/vars.config";
import * as ENV from "./configs/vars.config";
import {
  logErrorMiddleware,
  returnError404Middleware,
  returnErrorMiddleware,
} from "./middlewares/error.middleware";
import { deserializeUser } from "./middlewares/auth.middleware";
import AuthRouter from "./app/auth/auth.routes";
import ProfileRouter from "./app/profile/profile.routes";
import EmailRouter from "./app/email/email.routes";
import CustomerRouter from "./app/customer/customer.routes";
import CustomerLevelRouter from "./app/customerLevel/customerLevel.routes";
import LaundryServiceRouter from "./app/laundryService/laundryService.routes";
import LaundryQueueRouter from "./app/laundryQueue/laundryQueue.routes";
import LaundryRoomRouter from "./app/laundryRoom/laundryRoom.routes";
import LaundryItemRouter from "./app/laundryItem/laundryItem.routes";
import PaymentRouter from "./app/payment/payment.routes";
import UserRouter from "./app/user/user.routes";
import AuthMemberRouter from "./app/authMember/authMember.routes";
import PublicRouter from "./app/public/public.routes";
import MemberRouter from "./app/member/member.routes";
import SettingRouter from "./app/setting/setting.routes";
import ReportRouter from "./app/reports/report.routes";
import ExpensesRouter from "./app/expenses/expenses.routes";
import DashboardRouter from "./app/dashboard/dashboard.routes";
import NotificationTemplateRouter from "./app/notificationTemplate/notificationTemplate.routes";
import AuditLogRouter from "./app/auditLog/auditLog.routes";
import logger from "./configs/logger.config";

class App {
  public server;
  constructor() {
    this.server = express();
    this.middlewares();
    this.routes();
    this.errorMiddlewares();
  }

  middlewares() {
    // --- CORS -------------------------------------------------------
    // Origins are driven by the ALLOWED_ORIGINS env var. Multiple
    // origins are separated by "|" (e.g. "https://example.com|http://localhost:3379").
    // Fallback is http://localhost:3379 (the default Next.js dev port).
    // credentials: true  — required because the API sets httpOnly cookies
    //   for JWT auth. When credentials is true the browser MUST receive
    //   an explicit origin (not "*"), so the wildcard value is rejected.
    const origins = ENV.ALLOWED_ORIGINS.includes("|")
      ? ENV.ALLOWED_ORIGINS?.split("|")
      : ENV.ALLOWED_ORIGINS;

    logger.info(`[SERVER] CORS origins: ${ENV.ALLOWED_ORIGINS}`);

    if (!process.env.ALLOWED_ORIGINS) {
      logger.warn(
        "[SERVER] ALLOWED_ORIGINS env var is not set — falling back to default (http://localhost:3379). " +
          "Set ALLOWED_ORIGINS in your .env file to match your deployment.",
      );
    }

    this.server.use(
      cors({
        origin: origins,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        exposedHeaders: ["X-Correlation-ID"],
        credentials: true,
      }),
    );

    // Helmet: standard HTTP security headers. Registered globally so every
    // response carries the baseline protections. CSP is intentionally left
    // disabled (tracked in issue 008 as a future consideration). CORP is
    // relaxed to "cross-origin" so the separate Next.js client (port 3379)
    // can still load uploaded images and static assets from this API
    // (port 3001) without being blocked by the browser.
    this.server.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      }),
    );

    // Correlation ID: generates a UUID per request, or reuses an incoming
    // X-Correlation-ID header. Registered before request-aware middleware
    // and pinoHttpLogger so logs can include the same correlationId.
    this.server.use(correlationIdMiddleware);
    this.server.use(correlationIdResponseHeaderMiddleware);

    this.server.use(express.urlencoded({ extended: false }));
    this.server.use(express.json());
    this.server.use(cookieParser());
    this.server.use(useragent.express());
    this.server.use(requestIp.mw({ attributeName: "clientIp" }));

    this.server.use(deserializeUser);
    // this.server.use(deserializeMember);
    this.server.use(pinoHttpLogger);
    this.server.use(express.static(STATIC_FOLDER));
    if (ENV.MODE !== "production") {
      this.server.use(express.static(ENV_STATIC_FOLDER_PATH));
    }
  }

  routes() {
    this.server.use("/", new DemoRouter(this.server).getRouter());
    this.server.use("/auth", new AuthMemberRouter(this.server).getRouter());
    this.server.use("/auth", new AuthRouter(this.server).getRouter());
    this.server.use("/public", new PublicRouter(this.server).getRouter());
    this.server.use("/customer", new CustomerRouter(this.server).getRouter());
    this.server.use("/member", new MemberRouter(this.server).getRouter());
    this.server.use("/payment", new PaymentRouter(this.server).getRouter());
    this.server.use("/report", new ReportRouter(this.server).getRouter());
    this.server.use("/profile", new ProfileRouter(this.server).getRouter());
    this.server.use("/user", new UserRouter(this.server).getRouter());
    this.server.use("/setting", new SettingRouter(this.server).getRouter());
    this.server.use(
      "/laundry/service",
      new LaundryServiceRouter(this.server).getRouter(),
    );
    this.server.use(
      "/laundry/queue",
      new LaundryQueueRouter(this.server).getRouter(),
    );
    this.server.use(
      "/laundry/item",
      new LaundryItemRouter(this.server).getRouter(),
    );
    this.server.use(
      "/laundry/room",
      new LaundryRoomRouter(this.server).getRouter(),
    );
    this.server.use(
      "/level/customer",
      new CustomerLevelRouter(this.server).getRouter(),
    );
    this.server.use("/expenses", new ExpensesRouter(this.server).getRouter());
    this.server.use("/email", new EmailRouter(this.server).getRouter());
    this.server.use("/dashboard", new DashboardRouter(this.server).getRouter());
    this.server.use(
      "/notification/template",
      new NotificationTemplateRouter(this.server).getRouter(),
    );
    this.server.use(
      "/audit-log",
      new AuditLogRouter(this.server).getRouter(),
    );
  }

  errorMiddlewares() {
    this.server.use(logErrorMiddleware);
    this.server.use(returnError404Middleware);
    this.server.use(returnErrorMiddleware);
  }
}

export default new App().server;
