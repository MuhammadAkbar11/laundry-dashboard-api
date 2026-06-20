import { NextFunction, Request, Response } from "express";
import { LaundryQueue, Prisma } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import Pagination from "../../helpers/pagination.helper";
import LaundryQueueService from "./laundryQueue.service";
import {
  CreateLaundryQueuePayload,
  DeleteLaundryQueuePayload,
  ReadByIDLaundryQueuePayload,
  ReadLaundryQueuePayload,
  UpdateLaundryQueueDeliveredPayload,
  UpdateLaundryQueueStatusPayload,
} from "./laundryQueue.schema";
import CustomerService from "../customer/customer.service";
import AuditLogService from "../auditLog/auditLog.service";
import { isNumericQuery, parsingResult } from "../../utils/utils";
import { SortingTypes } from "../../utils/types/types";
import LaundryItemService from "../laundryItem/laundryItem.service";

@BindAllMethods
class LaundryQueueController extends BaseController {
  private readonly service = new LaundryQueueService();
  private readonly customerService = new CustomerService();
  private readonly laundryItemService = new LaundryItemService();
  private readonly auditLogService = new AuditLogService();

  constructor() {
    super();
  }

  private sorting(
    orderBy: string,
    sortBy: Prisma.SortOrder
  ): SortingTypes<Prisma.LaundryQueueOrderByWithRelationAndSearchRelevanceInput> {
    let sortingOptions: SortingTypes<Prisma.LaundryQueueOrderByWithRelationAndSearchRelevanceInput> =
      {
        [`${orderBy || "createdAt"}`]: sortBy || "desc",
      };

    if (!orderBy) {
      sortingOptions = [{ status: "asc" }, { createdAt: "desc" }];
    }

    if (orderBy?.includes("customerName")) {
      sortingOptions = {
        customer: {
          name: sortBy as Prisma.SortOrder,
        },
      };
    } else if (orderBy?.trim() === "total") {
      sortingOptions = {
        laundryRoom: {
          total: sortBy as Prisma.SortOrder,
        },
      };
    }

    return sortingOptions;
  }

  public async get(
    req: Request<{}, {}, {}, ReadLaundryQueuePayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let where: Prisma.LaundryQueueWhereInput = {};

      const paginated = new Pagination<LaundryQueue>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "laundryQueues",
      });

      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      const { limit, skip } = paginated.getPagination();

      if (_search) {
        const ORsearching: Prisma.Enumerable<Prisma.LaundryQueueWhereInput> = [
          {
            laundryQueueId: {
              contains: _search,
            },
          },
          { customerId: { contains: _search } },
          {
            customer: {
              name: { contains: _search },
            },
          },
        ];

        if (isNumericQuery(_search)) {
          ORsearching.push({
            laundryRoom: {
              total: { equals: +_search },
            },
          });
        }

        where = {
          OR: ORsearching,
        };
      }

      const laundryQueues = (await this.service.getAll({
        where,
        skip,
        orderBy: sorting,
        take: limit,
        include: {
          customer: true,
          laundryRoom: true,
          _count: {
            select: { laundries: true },
          },
        },
      })) as LaundryQueue[];

      const totalLaundryQueues = (await this.service.count({
        where,
      })) as number;

      const data = paginated.getPagingData(totalLaundryQueues, laundryQueues);

      res.status(200).json({
        message: this.getSuccessMessage("read", "Antrian"),
        data: { search: _search, ...parsingResult(data) },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getId(
    req: Request<ReadByIDLaundryQueuePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const laundryQueue = await this.service.getByIdWithInclude(
        laundryQueueIdParam
      );

      if (!laundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam
          )
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Antrian",
          laundryQueueIdParam
        ),
        laundryQueue: parsingResult(laundryQueue),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async post(
    req: Request<{}, {}, CreateLaundryQueuePayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        customerId: customerIdParam,
        note,
        deliveryType,
        pickupAt,
        deliveryAddress,
      } = req.body;

      const customer = await this.customerService.getById(customerIdParam, {
        include: { customerLevel: true, laundryQueues: true },
      });

      if (!customer) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Pelanggan", customerIdParam)
        );
      }

      const newQueue = await this.service.create({
        customerId: customerIdParam,
        status: "ONHOLD",
        queuePaymentStatus: "PENDING",
        pickupAt: pickupAt,
        deliveryAddress: deliveryAddress,
        deliveryType: deliveryType || "PICKUP",
        note: note,
      });

      await this.auditLogService.create({
        action: "CREATE",
        entityType: "ORDER",
        entityId: (newQueue as any)?.laundryQueue?.laundryQueueId,
        actorId: req.user?.userId,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        metadata: {
          customerId: customerIdParam,
          status: (newQueue as any)?.laundryQueue?.status,
          queuePaymentStatus: (newQueue as any)?.laundryQueue?.queuePaymentStatus,
        },
      });

      res.status(201).json({
        message: this.getSuccessMessage("create", "Antrian"),
        laundryQueue: parsingResult(newQueue),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async putDelivered(
    req: Request<UpdateLaundryQueueDeliveredPayload["params"], {}, {}>,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const existingLaundryQueue = await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: laundryQueueIdParam },
        include: { laundries: true },
      });

      if (!existingLaundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam
          )
        );
      }

      if (existingLaundryQueue?.queuePaymentStatus !== "FINISHED") {
        throw this.error(
          "NOT_FOUND",
          400,
          `Gagal memperbaharui status ${
            existingLaundryQueue.deliveryType === "PICKUP"
              ? "pengambilan"
              : "pengantaran"
          } Antrian "${laundryQueueIdParam}", karena belum melakukan pembayaran`
        );
      }

      if (existingLaundryQueue?.laundries?.length === 0) {
        throw this.error(
          "BAD_REQUEST",
          this.methodStatus.BAD_REQUEST,
          `Belum ada cucian untuk Antrian '${laundryQueueIdParam}'. Silahkan tambahkan cucian terlebih dahulu`
        );
      }

      const updatedLaundryQueue = await this.service.updateDelivered(
        laundryQueueIdParam,
        existingLaundryQueue.customerId
      );

      res.status(201).json({
        message: this.getSuccessMessage(
          "update",
          "Antrian",
          laundryQueueIdParam
        ),
        laundryQueue: parsingResult(updatedLaundryQueue),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async putStatus(
    req: Request<
      UpdateLaundryQueueStatusPayload["params"],
      {},
      UpdateLaundryQueueStatusPayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const existingLaundryQueue = await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: laundryQueueIdParam },
        include: { laundries: true },
      });

      if (!existingLaundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam
          )
        );
      }

      if (
        existingLaundryQueue?.queuePaymentStatus !== "FINISHED" &&
        req.body.status === "FINISHED"
      ) {
        throw this.error(
          "NOT_FOUND",
          400,
          `Gagal memperbaharui status Antrian "${laundryQueueIdParam}", karena belum menyelesaikan pembayaran`
        );
      }

      if (
        existingLaundryQueue?.laundries?.length === 0 &&
        req.body.status === "FINISHED"
      ) {
        throw this.error(
          "BAD_REQUEST",
          this.methodStatus.BAD_REQUEST,
          `Belum ada cucian untuk Antrian '${laundryQueueIdParam}'. Silahkan tambahkan cucian terlebih dahulu`
        );
      }

      const updatedLaundryQueue = await this.service.updateStatus(
        laundryQueueIdParam,
        req.body.status
      );

      await this.auditLogService.create({
        action: "STATUS_CHANGE",
        entityType: "ORDER",
        entityId: laundryQueueIdParam,
        actorId: req.user?.userId,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        metadata: {
          before: { status: existingLaundryQueue.status },
          after: { status: req.body.status },
        },
      });

      res.status(201).json({
        message: this.getSuccessMessage(
          "update",
          "Antrian",
          laundryQueueIdParam
        ),
        laundryQueue: parsingResult(updatedLaundryQueue),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async delete(
    req: Request<DeleteLaundryQueuePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const laundryQueue = await this.service.getById(laundryQueueIdParam);

      if (!laundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam
          )
        );
      }

      const deletedLaundryQueue = await this.service.delete(
        laundryQueueIdParam
      );

      await this.auditLogService.create({
        action: "DELETE",
        entityType: "ORDER",
        entityId: laundryQueueIdParam,
        actorId: req.user?.userId,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        metadata: {
          customerId: laundryQueue.customerId,
          status: laundryQueue.status,
        },
      });

      res.status(200).json({
        message: this.getSuccessMessage(
          "delete",
          "Antrian",
          laundryQueueIdParam
        ),
        laundryQueue: parsingResult(deletedLaundryQueue),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getLaundryItems(
    req: Request<ReadByIDLaundryQueuePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const laundryQueue = await this.service.getByIdWithInclude(
        laundryQueueIdParam
      );

      if (!laundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam
          )
        );
      }

      const laundries = await this.laundryItemService.getAll({
        where: {
          laundryQueueId: laundryQueueIdParam,
        },
        include: {
          historyService: true,
        },
      });

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Cucian dari Antrian",
          laundryQueueIdParam
        ),
        laundries: parsingResult(laundries),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default LaundryQueueController;
