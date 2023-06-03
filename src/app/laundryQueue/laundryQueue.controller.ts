import { NextFunction, Request, Response } from "express";
import {
  LaundryQueue,
  LaundryQueuePaymentStatus,
  LaundryQueueStatus,
  Prisma,
} from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import Pagination from "../../helpers/pagination.helper";
import LaundryQueueService from "./laundryQueue.service";
import {
  CreateLaundryQueuePayload,
  DeleteLaundryQueuePayload,
  ReadByIDLaundryQueuePayload,
  ReadLaundryQueuePayload,
  UpdateLaundryQueuePayload,
} from "./laundryQueue.schema";
import { dateIndoWIB } from "../../configs/date.config";
import CustomerService from "../customer/customer.service";
import { isNumericQuery } from "../../utils/utils";
import { SortingTypes } from "../../utils/types/types";

@BindAllMethods
class LaundryQueueController extends BaseController {
  private readonly service = new LaundryQueueService();
  private readonly customerService = new CustomerService();

  constructor() {
    super();
  }

  private sorting(
    orderBy: string,
    sortBy: Prisma.SortOrder
  ): SortingTypes<Prisma.LaundryQueueOrderByWithRelationAndSearchRelevanceInput> {
    let sortingOptions: SortingTypes<Prisma.LaundryQueueOrderByWithRelationAndSearchRelevanceInput> =
      {
        [`${orderBy || "laundryQueueId"}`]: sortBy || "desc",
      };

    if (!orderBy) {
      sortingOptions = [{ status: "asc" }, { laundryQueueId: "desc" }];
    }

    if (orderBy?.includes("customerName")) {
      sortingOptions = {
        customer: {
          name: sortBy as Prisma.SortOrder,
        },
      };
    } else if (orderBy?.trim() === "total") {
      sortingOptions = {
        laundryRooms: {
          total: sortBy as Prisma.SortOrder,
        },
      };
    } else if (orderBy?.trim() === "userName") {
      sortingOptions = {
        user: {
          name: sortBy as Prisma.SortOrder,
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
          {
            user: {
              name: {
                contains: _search,
              },
            },
          },
          { customerId: { contains: _search } },
          { userId: { contains: _search } },
          { userId: { contains: _search } },
          {
            customer: {
              name: { contains: _search },
            },
          },
        ];

        if (isNumericQuery(_search)) {
          ORsearching.push({
            laundryRooms: {
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
          user: true,
          laundryRooms: true,
          _count: {
            select: { laundries: true },
          },
        },
      })) as LaundryQueue[];

      const totalLaundryQueues = await this.service.count({ where });

      const data = paginated.getPagingData(totalLaundryQueues, laundryQueues);

      res.status(200).json({
        message: this.getSuccessMessage("read", "Antrian"),
        data: { search: _search, ...data },
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
        laundryQueue,
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
      const { customerId: customerIdParam, note, deliveryType } = req.body;

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
        userId: req?.user?.userId as string,
        status: "ONHOLD",
        queuePaymentStatus: "PENDING",
        deliveryType: deliveryType || "PICKUP",
        note: note,
      });

      res.status(201).json({
        message: this.getSuccessMessage("create", "Antrian"),
        laundryQueue: newQueue,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<
      UpdateLaundryQueuePayload["params"],
      {},
      UpdateLaundryQueuePayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const {
        queuePaymentStatus,
        status,
        finishedAt,
        deliveryAt,
        note,
        deliveryType,
      } = req.body;

      const existingLaundryQueue = await this.service.getById(
        laundryQueueIdParam
      );

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

      const updatedLaundryQueue = await this.service.update(
        laundryQueueIdParam,
        {
          queuePaymentStatus:
            (queuePaymentStatus as LaundryQueuePaymentStatus) ||
            existingLaundryQueue.queuePaymentStatus,
          status: (status as LaundryQueueStatus) || existingLaundryQueue.status,
          finishedAt:
            dateIndoWIB(finishedAt).toDate() || existingLaundryQueue.finishedAt,
          deliveryAt:
            dateIndoWIB(deliveryAt).toDate() || existingLaundryQueue.deliveryAt,
          deliveryType: deliveryType || "PICKUP",
          note: note,
        }
      );

      res.status(200).json({
        message: this.getSuccessMessage(
          "update",
          "Antrian",
          laundryQueueIdParam
        ),
        laundryQueue: updatedLaundryQueue,
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

      res.status(200).json({
        message: this.getSuccessMessage(
          "delete",
          "Antrian",
          laundryQueueIdParam
        ),
        laundryQueue: deletedLaundryQueue,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default LaundryQueueController;
