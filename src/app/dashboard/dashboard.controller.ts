import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import DashboardService from "./dashboard.service";
import { parsingResult } from "../../utils/utils";

@BindAllMethods
class DashboardController extends BaseController {
  private readonly service = new DashboardService();
  constructor() {
    super();
  }

  public async getAdminDashboard(
    req: Request<{}, {}, {}, { period?: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const period = req.query.period;
      const data = await this.service.getAdminDashboard(period);
      res.status(200).json({
        message: this.getSuccessMessage("read", "Dashboard"),
        data: parsingResult(data),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getRevenueAnalytics(
    req: Request<{}, {}, {}, { period?: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await this.service.getRevenueAnalytics(
        req.query.period || "7"
      );
      res.status(200).json({
        message: this.getSuccessMessage("read", "Dashboard"),
        data: parsingResult(data),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getFinancialAnalytics(
    req: Request<{}, {}, {}, { period?: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await this.service.getFinancialAnalytics(
        req.query.period || "7"
      );
      res.status(200).json({
        message: this.getSuccessMessage("read", "Dashboard"),
        data: parsingResult(data),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getRevenueByService(
    req: Request<{}, {}, {}, { period?: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await this.service.getRevenueByService(
        req.query.period || "7"
      );
      res.status(200).json({
        message: this.getSuccessMessage("read", "Dashboard"),
        data: parsingResult(data),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getMemberDashboard(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const memberId = req.member?.memberId as string;
      const data = await this.service.getMemberDashboard(memberId);
      res.status(200).json({
        message: this.getSuccessMessage("read", "Dashboard Member"),
        data: parsingResult(data),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default DashboardController;
