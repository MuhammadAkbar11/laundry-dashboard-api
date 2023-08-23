import express from "express";
import { BaseRouter } from "../../core";
import { requiredUser } from "../../middlewares/auth.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import {
  readReportTrxPeriodDateSchema,
  readReportTrxFullDateSchema,
  readReportTrxMonthsSchema,
  readReportCashflowSchema,
} from "./report.schema";
import ReportController from "./report.controller";
import validateResource from "../../middlewares/validate.middleware";

@BindAllMethods
class ReportRouter extends BaseRouter<ReportController> {
  constructor(protected express: express.Express) {
    super(ReportController, express);
  }

  protected routes(): void {
    this.router
      .route("/transaction/:year")
      .get(
        requiredUser,
        [validateResource(readReportTrxMonthsSchema)],
        this.controller.getReportTrxMonth
      );
    this.router
      .route("/transaction/:year/:month")
      .get(
        requiredUser,
        [validateResource(readReportTrxMonthsSchema)],
        this.controller.getReportTrxDate
      );
    this.router
      .route("/transaction-period/:startDate/:endDate")
      .get(
        requiredUser,
        [validateResource(readReportTrxPeriodDateSchema)],
        this.controller.getReportTrxPeriodDate
      );
    this.router.route("/transaction").get(
      requiredUser,
      // [validateResource(readReportTrxFullDateSchema)],
      this.controller.getReportTrx
    );
    this.router
      .route("/transaction-cashflow")
      .get(
        requiredUser,
        [validateResource(readReportCashflowSchema)],
        this.controller.getReportCashFlow
      );
    this.router
      .route("/transaction-full")
      .get(
        requiredUser,
        [validateResource(readReportTrxFullDateSchema)],
        this.controller.getReportTrxFullDate
      );
  }
}

export default ReportRouter;
