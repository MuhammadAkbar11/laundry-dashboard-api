import { NextFunction, Request, Response } from "express";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import LaundryServiceService from "../laundryService/laundryService.service";
import { parsingResult } from "../../utils/utils";
import CustomerLevelService from "../customerLevel/customerLevel.service";
import { ReadCustomerLevelPayload } from "../customerLevel/customerLevel.schema";

@BindAllMethods
class PublicController extends BaseController {
  private readonly laundryService = new LaundryServiceService();
  private readonly customerLevelService = new CustomerLevelService();

  constructor() {
    super();
  }

  public async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.laundryService.getAll({
        orderBy: {
          serviceId: "asc",
        },
      });
      return res.status(200).json({
        message: this.getSuccessMessage("read", "Layanan"),
        laundryService: parsingResult(result),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getCustomerLevel(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const levels = await this.customerLevelService.getAll();

      res.status(200).json({
        message: this.getSuccessMessage("read", "Level Pelanggan"),
        levels: parsingResult(levels),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getCustomerLevelById(
    req: Request<ReadCustomerLevelPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const customerLvlIdParam = req.params.customerLevelId as string;

    try {
      const customerLvl = await this.customerLevelService.getById(
        customerLvlIdParam
      );

      if (!customerLvl) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Level Pelanggan",
            customerLvlIdParam
          )
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Level Pelanggan",
          customerLvlIdParam
        ),
        level: parsingResult(customerLvl),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default PublicController;
