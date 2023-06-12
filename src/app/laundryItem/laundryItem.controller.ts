import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import LaundryItemService from "./laundryItem.service";
import {
  CreateLaundryItemPayload,
  DeleteLaundryItemPayload,
  ReadByIDLaundryItemPayload,
  UpdateLaundryItemPayload,
} from "./laundryItem.schema";
import { parsingResult } from "../../utils/utils";

@BindAllMethods
class LaundryItemController extends BaseController {
  private readonly service = new LaundryItemService();

  constructor() {
    super();
  }

  public async getByID(
    req: Request<ReadByIDLaundryItemPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { laundryItemId } = req.params;

      const result = await this.service.getById(laundryItemId);

      if (!result) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Cucian", laundryItemId)
        );
      }

      return res.status(200).json({
        message: this.getSuccessMessage("readById", "Cucian", laundryItemId),
        laundryItem: parsingResult(result),
      });
    } catch (error) {
      return next(error);
    }
  }

  public async post(
    req: Request<{}, {}, CreateLaundryItemPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const existService = await this.prisma.service.findUnique({
        where: { serviceId: req.body.serviceId },
      });

      if (!existService) {
        throw this.error(
          "NOT_FOUND",
          404,
          `Layanan laundry dengan ID "${req.body.serviceId}" tidak ditemukan.`
        );
      }

      const existLaundryQueue = await this.prisma.laundryQueue.findFirst({
        where: { laundryQueueId: req.body.laundryQueueId },
      });

      if (!existLaundryQueue) {
        throw this.error(
          "NOT_FOUND",
          this.methodStatus.NOT_FOUND,
          `Antrian laundry dengan ID "${req.body.serviceId}" tidak ditemukan.`
        );
      }

      if (existLaundryQueue.queuePaymentStatus === "FINISHED") {
        throw this.error(
          "BAD_REQUEST",
          this.methodStatus.BAD_REQUEST,
          `Tidak dapat menambahkan cucian baru karena antrian telah di lunas`
        );
      }

      const result = await this.service.create(
        {
          laundryQueueId: req.body.laundryQueueId,
          historyServiceId: req.body.serviceId,
          quantity: req.body.quantity,
          note: req.body?.note || null,
        },
        existService
      );

      return res.status(200).json({
        message: this.getSuccessMessage("create", "Cucian"),
        data: parsingResult(result),
      });
    } catch (error) {
      return next(error);
    }
  }

  public async put(
    req: Request<
      UpdateLaundryItemPayload["params"],
      {},
      UpdateLaundryItemPayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { laundryItemId } = req.params;

      const existingLaundryItem = await this.prisma.laundryItem.findUnique({
        where: { laundryId: laundryItemId },
      });

      if (!existingLaundryItem) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Cucian", laundryItemId)
        );
      }

      const existService = await this.prisma.service.findUnique({
        where: { serviceId: req.body.serviceId },
      });

      if (!existService) {
        throw this.error(
          "NOT_FOUND",
          404,
          `Layanan laundry dengan ID "${req.body.serviceId}" tidak ditemukan.`
        );
      }

      const result = await this.service.update(
        req.body,
        existingLaundryItem,
        existService
      );

      return res.status(200).json({
        message: this.getSuccessMessage("update", "Cucian", laundryItemId),
        laundryItem: parsingResult(result),
      });
    } catch (error) {
      return next(error);
    }
  }

  public async delete(
    req: Request<DeleteLaundryItemPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { laundryItemId } = req.params;

      const existingLaundryItem = await this.prisma.laundryItem.findUnique({
        where: { laundryId: laundryItemId },
      });

      if (!existingLaundryItem) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Cucian", laundryItemId)
        );
      }

      const result = await this.service.delete(existingLaundryItem);

      return res.status(200).json({
        message: this.getSuccessMessage("delete", "Cucian", laundryItemId),
        laundryItem: parsingResult(result),
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default LaundryItemController;
