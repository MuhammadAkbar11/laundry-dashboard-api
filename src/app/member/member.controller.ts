import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import {
  DELIVERY_TYPE,
  ENV_STATIC_FOLDER_NAME,
  ENV_STATIC_FOLDER_PATH,
  LAUNDRY_ROOM_STATUS,
  LQ_STATUS,
  PAYMENT_METHODS,
} from "../../configs/vars.config";
import { BaseController } from "../../core";
import { isNumericQuery, parsingResult, searchArray } from "../../utils/utils";
import _ from "lodash";
import MemberService from "./member.service";
import {
  MemberOrderPayload,
  PostPaymentPayload,
  ReadMemberLaundryQueueByIDPayload,
  ReadMemberLaundryQueuePayload,
  ReadMemberLaundryRoomDetailPayload,
  ReadMemberPaymentByInvoicePayload,
  ReadMemberTrxPayload,
  UpdateMemberProfilePayload,
} from "./member.schema";
import {
  DeliveryType,
  LaundryQueue,
  LaundryQueueStatus,
  LaundryRoom,
  LaundryRoomStatus,
  Payment,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import Pagination from "../../helpers/pagination.helper";
import { SortingTypes } from "../../utils/types/types";
import { ReadLaundryRoomPayload } from "../laundryRoom/laundryRoom.schema";
import FileHelper from "../../helpers/file.helper";

@BindAllMethods
class MemberController extends BaseController {
  private readonly service = new MemberService();
  constructor() {
    super();
  }

  public async postLaundryQueueOrder(
    req: Request<{}, {}, MemberOrderPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { customerId: req.member?.customerId as string },
      });

      const laundryServices = await this.prisma.service.findMany({
        where: {
          serviceId: {
            in: req.body.services,
          },
        },
      });

      const order = await this.service.createLaundryQueueOrder({
        pickupAt: req.body.pickupAt,
        deliveryType: req.body.deliveryType,
        deliveryAddress: req.body.deliveryAddress,
        note: req.body.note,
        customerId: customer?.customerId as string,
        services: laundryServices,
      });
      return res.status(201).json({
        message: "Order berhasil dan sedang diproses",
        order: parsingResult(order),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  private sortingLaundryQueue(
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

    if (orderBy?.trim() === "total") {
      sortingOptions = {
        laundryRoom: {
          total: sortBy as Prisma.SortOrder,
        },
      };
    }

    return sortingOptions;
  }

  private searchingLaundryQueue(
    query: string
  ): Prisma.Enumerable<Prisma.LaundryQueueWhereInput> {
    const statusByQuery = searchArray<string>(Object.keys(LQ_STATUS), query);
    const deliveryTypeByQuery = searchArray<string>(
      Object.keys(DELIVERY_TYPE),
      query
    );
    const ORsearching: Prisma.Enumerable<Prisma.LaundryQueueWhereInput> = [
      {
        laundryQueueId: {
          contains: query,
        },
      },
      {
        customer: {
          name: { contains: query },
        },
      },
    ];

    if (isNumericQuery(query)) {
      ORsearching.push({
        laundryRoom: {
          total: { equals: +query },
        },
      });
    }

    if (statusByQuery.length !== 0) {
      ORsearching.push({
        status: { equals: statusByQuery[0] as LaundryQueueStatus },
      });
    }
    if (deliveryTypeByQuery.length !== 0) {
      ORsearching.push({
        deliveryType: {
          equals: deliveryTypeByQuery[0] as DeliveryType,
        },
      });
    }

    return ORsearching;
  }

  public async getLaundryQueue(
    req: Request<{}, {}, {}, ReadMemberLaundryQueuePayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let whereQuery: Prisma.LaundryQueueWhereInput = {};

      const paginated = new Pagination<LaundryQueue>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "laundryQueues",
      });

      const sorting = this.sortingLaundryQueue(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      const { limit, skip } = paginated.getPagination();

      if (_search) {
        whereQuery = {
          OR: this.searchingLaundryQueue(_search),
        };
      }

      // const laundryQueues = (await this.prisma.laundryQueue.findMany({
      //   where: { ...whereQuery, customerId: req.member?.customerId as string },
      //   skip,
      //   orderBy: sorting,
      //   take: limit,
      //   include: {
      //     laundryRoom: true,
      //     _count: {
      //       select: { laundries: true },
      //     },
      //   },
      // })) as LaundryQueue[];

      const laundryQueues = (await this.service.getLaundryQueueOrders({
        where: { ...whereQuery, customerId: req.member?.customerId as string },
        skip: skip,
        orderBy: sorting,
        take: limit,
      })) as LaundryQueue[];

      const totalLaundryQueues = (await this.prisma.laundryQueue.count({
        where: { ...whereQuery, customerId: req.member?.customerId as string },
      })) as number;

      const data = paginated.getPagingData(totalLaundryQueues, laundryQueues);

      res.status(200).json({
        message: this.getSuccessMessage("read", "Antrian Member"),
        data: { search: _search, ...parsingResult(data) },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  private sortingLaundryRoom(
    orderBy: string,
    sortBy: Prisma.SortOrder
  ): SortingTypes<Prisma.LaundryRoomOrderByWithRelationAndSearchRelevanceInput> {
    let sortingOptions: SortingTypes<Prisma.LaundryRoomOrderByWithRelationAndSearchRelevanceInput> =
      {
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
    }

    return sortingOptions;
  }

  private searchingLaundryRoom(
    query: string
  ): Prisma.Enumerable<Prisma.LaundryRoomWhereInput> {
    const statusByQuery = searchArray<string>(
      Object.keys(LAUNDRY_ROOM_STATUS),
      query
    );

    const ORsearching: Prisma.Enumerable<Prisma.LaundryRoomWhereInput> = [
      {
        laundryRoomId: {
          contains: query,
        },
      },
      {
        laundryQueueId: {
          contains: query,
        },
      },
    ];

    if (isNumericQuery(query)) {
      ORsearching.push({
        total: { equals: +query },
      });
    }

    if (statusByQuery.length !== 0) {
      ORsearching.push({
        status: { equals: statusByQuery[0] as LaundryRoomStatus },
      });
    }

    return ORsearching;
  }

  public async getLaundryRoom(
    req: Request<{}, {}, {}, ReadLaundryRoomPayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let whereQuery: Prisma.LaundryRoomWhereInput = {};

      const paginated = new Pagination<LaundryRoom>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "laundryRooms",
      });

      const sorting = this.sortingLaundryRoom(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      const { limit, skip } = paginated.getPagination();

      if (_search) {
        whereQuery = {
          OR: this.searchingLaundryRoom(_search),
        };
      }

      const result = (await this.prisma.laundryRoom.findMany({
        where: {
          ...whereQuery,
          laundryQueue: { customerId: req.member?.customerId as string },
        },
        orderBy: sorting,
        take: limit,
        skip,
        include: {
          laundryQueue: {
            include: {
              customer: true,
              _count: { select: { laundries: true } },
            },
          },
        },
      })) as LaundryRoom[];

      const total = (await this.prisma.laundryRoom.count({
        where: {
          ...whereQuery,
          laundryQueue: { customerId: req.member?.customerId as string },
        },
      })) as number;

      const data = paginated.getPagingData(total, result);

      const response = {
        message: this.getSuccessMessage("read", "Member Laundry Room"),
        data: { search: _search, ...parsingResult(data) },
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  public async getLaundryRoomByID(
    req: Request<ReadMemberLaundryRoomDetailPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { laundryQueueId } = req.params;

      const result = await this.service.getLaundryRoomById(laundryQueueId);

      if (!result) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Laundry", laundryQueueId)
        );
      }

      return res.status(200).json({
        message: this.getSuccessMessage("readById", "Laundry", laundryQueueId),
        laundryRoom: parsingResult(result),
      });
    } catch (error) {
      return next(error);
    }
  }

  public async getLaundryQueueByID(
    req: Request<ReadMemberLaundryQueueByIDPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const laundryQueue = await this.service.getLaundryQueueById(
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

  public async getLaundryItems(
    req: Request<ReadMemberLaundryQueueByIDPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const laundryQueue = await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: laundryQueueIdParam },
      });

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

      const laundries = await this.service.getLaundryItemByLaundryQueueID(
        laundryQueueIdParam
      );

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

  private sortingTrx(
    orderBy: string,
    sortBy: Prisma.SortOrder
  ): SortingTypes<Prisma.PaymentOrderByWithRelationAndSearchRelevanceInput> {
    let sortingOptions: SortingTypes<Prisma.PaymentOrderByWithRelationAndSearchRelevanceInput> =
      {
        [`${orderBy}`]: sortBy || "desc",
      };

    if (!orderBy) {
      sortingOptions = [{ createdAt: "desc" }];
    }

    return sortingOptions;
  }

  private searchingTrx(
    query: string
  ): Prisma.Enumerable<Prisma.PaymentWhereInput> {
    const paymentQuery = searchArray<string>(
      Object.keys(PAYMENT_METHODS),
      query
    );

    const ORsearching: Prisma.Enumerable<Prisma.PaymentWhereInput> = [
      { userId: { contains: query } },
      { invoice: { contains: query } },
      {
        laundryQueue: {
          customer: {
            name: { contains: query },
          },
        },
      },
    ];

    if (paymentQuery.length !== 0) {
      ORsearching.push({
        paymentMethod: { equals: paymentQuery[0] as PaymentMethod },
      });
    }

    if (isNumericQuery(query)) {
      ORsearching.push({
        totalPrice: { equals: +query },
      });
    }

    return ORsearching;
  }

  public async getMemberTransaction(
    req: Request<{}, {}, {}, ReadMemberTrxPayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let whereQuery: Prisma.PaymentWhereInput = {
        laundryQueue: {
          status: "FINISHED",
          customerId: req.member?.customerId as string,
          queuePaymentStatus: "FINISHED",
        },
      };

      const paginated = new Pagination<Payment>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "transactions",
      });

      const { limit, skip } = paginated.getPagination();

      const sorting = this.sortingTrx(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      if (_search) {
        whereQuery = {
          ...whereQuery,
          OR: this.searchingTrx(_search),
        };
      }

      const payments = await this.service.getMemberTrx({
        where: whereQuery,
        include: {
          laundryQueue: { include: { customer: true } },
        },
        skip,
        orderBy: sorting,
        take: limit,
      });

      const totalPayments = (await this.prisma.payment.count({
        where: whereQuery,
      })) as number;

      const data = paginated.getPagingData(
        totalPayments,
        payments as Payment[]
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Transaksi"),
        data: { search: _search, ...parsingResult(data) },
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async postPayment(
    req: Request<{}, {}, PostPaymentPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    const laundryQueueIdParam = req.body.laundryQueueId as string;

    const fileimgData = req.fileimg?.data;
    let proof = null;

    try {
      const laundryQueue = await this.service.getLaundryQueueById(
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

      if (fileimgData) {
        proof = fileimgData.path?.replace(ENV_STATIC_FOLDER_NAME, "");
      }

      console.log(fileimgData);

      const data = await this.service.createPayment({
        laundryQueueId: laundryQueue?.laundryQueueId,
        proof,
        paymentMethod: req.body.paymentMethod,
      });

      res.status(200).json({
        message: this.getSuccessMessage(
          "create",
          "Pembayaran",
          laundryQueueIdParam
        ),
        data: parsingResult(data),
      });
    } catch (error: any) {
      if (fileimgData) {
        FileHelper.unlinkFile(ENV_STATIC_FOLDER_PATH + proof, false);
      }
      this.nextError(next, error);
    }
  }

  public async getMemberInvoice(
    req: Request<ReadMemberPaymentByInvoicePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const invoiceParam = req.params.invoice as string;

    try {
      const invoice = await this.service.getMemberInvoice(invoiceParam);

      if (!invoice) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Invoice", invoiceParam)
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage("readById", "Invoice", invoiceParam),
        invoice: parsingResult(invoice),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async putMemberProfile(
    req: Request<{}, {}, UpdateMemberProfilePayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    const member = req.member;
    try {
      const member = req.member;
      if (!member) {
        return res.status(404).json({
          message: "Failed to get member profile",
          member: req.member,
        });
      }
      const memberIdParam = member.memberId as string;

      const { name, address, phone, username } = req.body;

      const existingMember = await this.service.getById(memberIdParam);

      if (!existingMember) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Pelanggan", memberIdParam)
        );
      }

      const result = await this.prisma.$transaction(async tx => {
        const updatedMember = await tx.member.update({
          where: { memberId: memberIdParam },
          data: {
            username: username,
          },
        });

        const updatedCustomer = await tx.customer.update({
          where: { customerId: existingMember?.customerId as string },
          data: {
            name: name,
            address: address,
            phone: phone,
          },
        });

        return {
          customer: updatedCustomer,
          member: updatedMember,
        };
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "Member Profile"),
        profile: parsingResult(result),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default MemberController;
