import { Payment, PaymentMethod, Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import {
  CreatePaymentPayload,
  PostRespondPaymentPayload,
  ReadPaymentByInvoicePayload,
  ReadPaymentPayload,
} from "./payment.schema";
import PaymentService from "./payment.service";
import AuditLogService from "../auditLog/auditLog.service";
import { isNumericQuery, parsingResult, searchArray } from "../../utils/utils";
import { SortingTypes } from "../../utils/types/types";
import { PAYMENT_METHODS } from "../../configs/vars.config";
import Pagination from "../../helpers/pagination.helper";

type PaymentSorting =
  SortingTypes<Prisma.PaymentOrderByWithRelationAndSearchRelevanceInput>;

@BindAllMethods
class PaymentController extends BaseController {
  private readonly service = new PaymentService();
  private readonly auditLogService = new AuditLogService();

  constructor() {
    super();
  }

  private sorting(orderBy: string, sortBy: Prisma.SortOrder): PaymentSorting {
    let sortingOptions: PaymentSorting = {
      [`${orderBy}`]: sortBy || "desc",
    };

    if (!orderBy) {
      sortingOptions = [{ createdAt: "desc" }];
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

  private searching(
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
        user: {
          name: { contains: query },
        },
      },
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

  public async get(
    req: Request<{}, {}, {}, ReadPaymentPayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        _type,
        _search,
        _page = 1,
        _limit = 10,
        _orderBy,
        _sortBy,
      } = req.query;

      let whereQuery: Prisma.PaymentWhereInput = {
        laundryQueue: {
          status: "FINISHED",
          queuePaymentStatus: "FINISHED",
        },
      };

      const paginated = new Pagination<Payment>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: _type,
      });

      const { limit, skip } = paginated.getPagination();

      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      if (_type === "histories") {
        whereQuery = {
          ...whereQuery,
          userId: req.user?.userId,
        };
      }

      if (_search) {
        whereQuery = {
          ...whereQuery,
          OR: this.searching(_search),
        };
      }

      const payments = await this.service.getAll({
        where: whereQuery,
        include: {
          user: true,
          laundryQueue: { include: { customer: true } },
        },
        skip,
        orderBy: sorting,
        take: limit,
      });

      const totalPayments = (await this.service.count({
        where: whereQuery,
      })) as number;

      const data = paginated.getPagingData(
        totalPayments,
        payments as Payment[]
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Transaksi"),
        data: { search: _search, type: _type, ...parsingResult(data) },
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async getByInvoice(
    req: Request<ReadPaymentByInvoicePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const invoiceParam = req.params.invoice as string;

    try {
      const invoice = await this.service.getByInvoice(invoiceParam);

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

  public async post(
    req: Request<{}, {}, CreatePaymentPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { paidAmount, paymentMethod, laundryQueueId, promoCode } = req.body;

      const existingLaundryQueue = await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: laundryQueueId },
        include: { laundries: true },
      });

      if (!existingLaundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Antrian", laundryQueueId)
        );
      }

      const newPayment = await this.service.create({
        paid: BigInt(paidAmount),
        laundryQueueId: laundryQueueId,
        code: promoCode || "",
        paymentMethod: paymentMethod || "CASH",
        userId: req?.user?.userId as string,
      });

      await this.auditLogService.create({
        action: "CREATE",
        entityType: "PAYMENT",
        entityId: (newPayment as any)?.payment?.paymentId,
        actorId: req.user?.userId,
        actorName: req.user?.name,
        actorRole: req.user?.role,
        metadata: {
          invoice: (newPayment as any)?.payment?.invoice,
          laundryQueueId,
          paidAmount,
          paymentMethod,
        },
      });

      res.status(201).json({
        message: this.getSuccessMessage("create", "Pembayaran"),
        data: parsingResult(newPayment),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async postRespond(
    req: Request<
      PostRespondPaymentPayload["params"],
      {},
      PostRespondPaymentPayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      const paymentId = req.params.paymentId as string;
      const { type } = req.body;

      const existingPayment = await this.prisma.payment.findUnique({
        where: { paymentId: paymentId },
      });

      if (!existingPayment) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Pembayaran", paymentId)
        );
      }

      if (type === "ACCEPT") {
        const data = await this.service.accPayment({
          payment: existingPayment,
          userId: req?.user?.userId as string,
        });
        await this.auditLogService.create({
          action: "UPDATE",
          entityType: "PAYMENT",
          entityId: paymentId,
          actorId: req.user?.userId,
          actorName: req.user?.name,
          actorRole: req.user?.role,
          metadata: {
            invoice: existingPayment.invoice,
            laundryQueueId: existingPayment.laundryQueueId,
            type: "ACCEPT",
            before: {
              totalPrice: Number(existingPayment.totalPrice),
              paid: Number(existingPayment.paid),
            },
            after: {
              totalPrice: Number((data as any)?.payment?.totalPrice),
              paid: Number((data as any)?.payment?.paid),
            },
          },
        });
        return res.status(201).json({
          message: this.getSuccessMessage("update", "Pembayaran"),
          data: parsingResult(data),
        });
      }

      res.status(201).json({
        message: this.getSuccessMessage("update", "Pembayaran"),
        data: type,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default PaymentController;
