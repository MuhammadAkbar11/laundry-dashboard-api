import express from "express";
import cors from "cors";
import useragent from "express-useragent";
import requestIp from "request-ip";
import cookieParser from "cookie-parser";
import DemoRouter from "./app/demo/demo.routes";
import pinoHttpLogger from "./middlewares/logging.middleware";
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
    const origins = ENV.ALLOWED_ORIGINS.includes("|")
      ? ENV.ALLOWED_ORIGINS?.split("|")
      : ENV.ALLOWED_ORIGINS;

    if (ENV.MODE === "development") {
      logger.info(`[SERVER] origin ${ENV.ALLOWED_ORIGINS}`);
      this.server.use(
        cors({
          origin: origins,
          methods: ["GET", "POST", "PUT", "DELETE"],
          // allowedHeaders: ["Content-Type"],
          // exposedHeaders: ["*", "Authorization"],
          credentials: true,
        })
      );
    } else {
      this.server.use(
        cors({
          origin: origins,
          methods: ["GET", "POST", "PUT", "DELETE"],
          credentials: true,
        })
      );
    }

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
      new LaundryServiceRouter(this.server).getRouter()
    );
    this.server.use(
      "/laundry/queue",
      new LaundryQueueRouter(this.server).getRouter()
    );
    this.server.use(
      "/laundry/item",
      new LaundryItemRouter(this.server).getRouter()
    );
    this.server.use(
      "/laundry/room",
      new LaundryRoomRouter(this.server).getRouter()
    );
    this.server.use(
      "/level/customer",
      new CustomerLevelRouter(this.server).getRouter()
    );
    this.server.use("/expenses", new ExpensesRouter(this.server).getRouter());
    this.server.use("/email", new EmailRouter(this.server).getRouter());
  }

  errorMiddlewares() {
    this.server.use(logErrorMiddleware);
    this.server.use(returnError404Middleware);
    this.server.use(returnErrorMiddleware);
  }
}

export default new App().server;
