import { NextFunction, Request, Response } from "express";
import { LaundryRoom, Prisma } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import Pagination from "../../helpers/pagination.helper";
import LaundryRoomService from "./laundryRoom.service";
import {
  ReadByIDLaundryRoomPayload,
  ReadLaundryRoomPayload,
  UpdateLaundryRoomFinishedPayload,
} from "./laundryRoom.schema";
import { SortingTypes } from "../../utils/types/types";
import { isNumericQuery } from "../../utils/utils";

type LaundryRoomSorting =
  SortingTypes<Prisma.LaundryRoomOrderByWithRelationAndSearchRelevanceInput>;

@BindAllMethods
class LaundryRoomController extends BaseController {
  private readonly service = new LaundryRoomService();

  constructor() {
    super();
  }

  private sorting(
    orderBy: string,
    sortBy: Prisma.SortOrder
  ): LaundryRoomSorting {
    let sortingOptions: LaundryRoomSorting = {
      [`${orderBy || "laundryRoomId"}`]: sortBy || "desc",
    };

    if (!orderBy) {
      sortingOptions = [{ status: "asc" }, { laundryRoomId: "desc" }];
    }

    if (orderBy?.includes("customerName")) {
      sortingOptions = {
        laundryQueue: {
          customer: {
            name: sortBy as Prisma.SortOrder,
          },
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

  private searching(
    query: string
  ): Prisma.Enumerable<Prisma.LaundryRoomWhereInput> {
    const ORsearching: Prisma.Enumerable<Prisma.LaundryRoomWhereInput> = [
      {
        laundryRoomId: {
          contains: query,
        },
      },
      {
        userId: {
          contains: query,
        },
      },
      {
        laundryQueueId: {
          contains: query,
        },
      },
      {
        laundryQueue: {
          customer: {
            name: { contains: query },
          },
        },
      },
      {
        laundryQueue: {
          customerId: { contains: query },
        },
      },
    ];

    if (isNumericQuery(query)) {
      ORsearching.push({
        total: { equals: +query },
      });
    }

    return ORsearching;
  }

  public async get(
    req: Request<{}, {}, {}, ReadLaundryRoomPayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let where: Prisma.LaundryRoomWhereInput = {};

      const paginated = new Pagination<LaundryRoom>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "laundryRooms",
      });

      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      const { limit, skip } = paginated.getPagination();

      if (_search) {
        where = {
          OR: this.searching(_search),
        };
      }

      const result = (await this.service.getAll({
        where,
        orderBy: sorting,
        take: limit,
        skip,
        include: {
          user: true,
          laundryQueue: {
            include: {
              customer: true,
              _count: { select: { laundries: true } },
            },
          },
        },
      })) as LaundryRoom[];

      const total = await this.service.count({ where });

      const data = paginated.getPagingData(total, result);

      const response = {
        message: this.getSuccessMessage("read", "Room"),
        data: { search: _search, ...data },
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  public async getByID(
    req: Request<ReadByIDLaundryRoomPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { laundryRoomId } = req.params;

      const result = await this.service.getById(laundryRoomId);

      if (!result) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Antrian", laundryRoomId)
        );
      }

      return res.status(200).json({
        message: this.getSuccessMessage("readById", "Room", laundryRoomId),
        laundryRoom: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  public async putStatusFinished(
    req: Request<
      UpdateLaundryRoomFinishedPayload["params"],
      {},
      UpdateLaundryRoomFinishedPayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { laundryRoomId } = req.params;
      const { laundryQueueId } = req.body;

      const existingLaundryRoom = await this.prisma.laundryRoom.findUnique({
        where: { laundryQueueId, laundryRoomId },
        include: { laundryQueue: true },
      });

      if (!existingLaundryRoom) {
        throw this.error(
          "NOT_FOUND",
          404,
          `Gagal menemukan data Room dengan ID '${laundryRoomId}' dan Antrian ID '${laundryQueueId}'.`
        );
      }

      const countLaundryItems = await this.prisma.laundryItem.count({
        where: { laundryQueueId },
      });

      if (countLaundryItems === 0) {
        throw this.error(
          "BAD_REQUEST",
          this.methodStatus.BAD_REQUEST,
          `Belum ada cucian untuk Room '${laundryRoomId}'. Silahkan tambahkan cucian terlebih dahulu`
        );
      }

      const result = await this.service.updateFinished(
        laundryRoomId,
        laundryQueueId
      );

      return res.status(200).json({
        message: this.getSuccessMessage("update", "Room"),
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default LaundryRoomController;
