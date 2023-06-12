import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import CustomerLevelService from "./customerLevel.service";
import {
  CreateCustomerLevelPayload,
  DeleteCustomerLevelPayload,
  ReadCustomerLevelPayload,
  UpdateCustomerLevelPayload,
} from "./customerLevel.schema";
import { parsingResult } from "../../utils/utils";

@BindAllMethods
class CustomerLevelController extends BaseController {
  private readonly service = new CustomerLevelService();

  constructor() {
    super();
  }

  public async get(req: Request, res: Response, next: NextFunction) {
    try {
      const levels = await this.service.getAll();

      res.status(200).json({
        message: this.getSuccessMessage("read", "Level Pelanggan"),
        levels: parsingResult(levels),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getId(
    req: Request<ReadCustomerLevelPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const customerLvlIdParam = req.params.customerLevelId as string;

    try {
      const customerLvl = await this.service.getById(customerLvlIdParam);

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

  public async post(
    req: Request<{}, {}, CreateCustomerLevelPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const newCustomerLevel = await this.service.create({
        ...req.body,
        point: BigInt(req.body.point),
      });

      res.status(200).json({
        message: this.getSuccessMessage("create", "Level Pelanggan"),
        level: parsingResult(newCustomerLevel),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<
      UpdateCustomerLevelPayload["params"],
      {},
      UpdateCustomerLevelPayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    const customerLvlIdParam = req.params.customerLevelId as string;

    try {
      const customerLvl = await this.service.getById(customerLvlIdParam);

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

      const name = req.body?.name || customerLvl.name;
      const point = BigInt(req.body?.point as number) || customerLvl.point;
      const discount = req.body?.discount || customerLvl.discount;

      const newLevel = await this.service.update(customerLvlIdParam, {
        name,
        point,
        discount,
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "Level Pelanggan"),
        level: parsingResult(newLevel),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async delete(
    req: Request<
      DeleteCustomerLevelPayload["params"],
      {},
      UpdateCustomerLevelPayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    const customerLvlIdParam = req.params.customerLevelId as string;

    try {
      const customerLvl = await this.service.getById(customerLvlIdParam);

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

      const deletedLevel = await this.service.delete(customerLvlIdParam);

      res.status(200).json({
        message: this.getSuccessMessage(
          "delete",
          "Level Pelanggan",
          customerLvlIdParam
        ),
        level: parsingResult(deletedLevel),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default CustomerLevelController;
