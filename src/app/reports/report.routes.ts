import express from "express";
import { BaseRouter } from "../../core";
import { requiredUser } from "../../middlewares/auth.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import {
  readReportTrxBetweenDateSchema,
  readReportTrxFullDateSchema,
  readReportTrxMonthsSchema,
} from "./report.schema";
import ReportController from "./report.controller";
import validateResource from "../../middlewares/validate.middleware";

@BindAllMethods
class ReportRouter extends BaseRouter<ReportController> {
  constructor(protected express: express.Express) {
    super(ReportController, express);
  }

  protected routes(): void {
    this.router.route("/transaction/:year").get(
      // requiredUser,
      [validateResource(readReportTrxMonthsSchema)],
      this.controller.getReportTrxMonth
    );
    this.router.route("/transaction/:year/:month").get(
      // requiredUser,
      [validateResource(readReportTrxMonthsSchema)],
      this.controller.getReportTrxDate
    );
    this.router.route("/transaction-beetween/:startDate/:endDate").get(
      // requiredUser,
      [validateResource(readReportTrxBetweenDateSchema)],
      this.controller.getReportTrxBetweenDate
    );
    this.router.route("/transaction").get(
      // requiredUser,
      // [validateResource(readReportTrxFullDateSchema)],
      this.controller.getReportTrx
    );
    this.router.route("/transaction-full").get(
      // requiredUser,
      [validateResource(readReportTrxFullDateSchema)],
      this.controller.getReportTrxFullDate
    );
  }
}

export default ReportRouter;
