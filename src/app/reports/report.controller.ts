import { Payment, PaymentMethod, Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
// import {
//   CreatePaymentPayload,
//   PostRespondPaymentPayload,
//   ReadPaymentByInvoicePayload,
//   ReadPaymentPayload,
// } from "./payment.schema";
// import PaymentService from "./payment.service";
import ReportService from "./report.service";
import { isNumericQuery, parsingResult, searchArray } from "../../utils/utils";
import { SortingTypes } from "../../utils/types/types";
import { PAYMENT_METHODS } from "../../configs/vars.config";
import Pagination from "../../helpers/pagination.helper";
import {
  ReadReportTrxBetweenDatePayload,
  ReadReportTrxDatePayload,
  ReadReportTrxFullDatePayload,
  ReadReportTrxMonthPayload,
  ReadReportTrxPayload,
} from "./report.schema";

type PaymentSorting =
  SortingTypes<Prisma.PaymentOrderByWithRelationAndSearchRelevanceInput>;

@BindAllMethods
class ReportController extends BaseController {
  private readonly service = new ReportService();

  constructor() {
    super();
  }

  // private sorting(orderBy: string, sortBy: Prisma.SortOrder): PaymentSorting {
  //   let sortingOptions: PaymentSorting = {
  //     [`${orderBy}`]: sortBy || "desc",
  //   };

  //   if (!orderBy) {
  //     sortingOptions = [{ createdAt: "desc" }];
  //   }

  //   if (orderBy?.includes("customerName")) {
  //     sortingOptions = {
  //       laundryQueue: {
  //         customer: {
  //           name: sortBy as Prisma.SortOrder,
  //         },
  //       },
  //     };
  //   }

  //   return sortingOptions;
  // }

  // private searching(
  //   query: string
  // ): Prisma.Enumerable<Prisma.PaymentWhereInput> {
  //   const paymentQuery = searchArray<string>(
  //     Object.keys(PAYMENT_METHODS),
  //     query
  //   );

  //   const ORsearching: Prisma.Enumerable<Prisma.PaymentWhereInput> = [
  //     { userId: { contains: query } },
  //     { invoice: { contains: query } },
  //     {
  //       user: {
  //         name: { contains: query },
  //       },
  //     },
  //     {
  //       laundryQueue: {
  //         customer: {
  //           name: { contains: query },
  //         },
  //       },
  //     },
  //   ];

  //   if (paymentQuery.length !== 0) {
  //     ORsearching.push({
  //       paymentMethod: { equals: paymentQuery[0] as PaymentMethod },
  //     });
  //   }

  //   if (isNumericQuery(query)) {
  //     ORsearching.push({
  //       totalPrice: { equals: +query },
  //     });
  //   }

  //   return ORsearching;
  // }

  public async getReportTrx(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await this.service.getReportTrxYears();

      res.status(200).json({
        message: this.getSuccessMessage("read", "Laporan Transaksi"),
        data: parsingResult(data),
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async getReportTrxMonth(
    req: Request<ReadReportTrxMonthPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await this.service.getReportTrxByMonth(
        Number(req.params?.year)
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Laporan Transaksi"),
        data: parsingResult(data),
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async getReportTrxDate(
    req: Request<ReadReportTrxDatePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await this.service.getReportTrxDate(
        Number(req.params?.year),
        Number(req.params?.month)
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Laporan Transaksi"),
        data: parsingResult(data),
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async getReportTrxFullDate(
    req: Request<{}, {}, {}, ReadReportTrxFullDatePayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await this.service.getReportTrxFullDate({
        year: Number(req.query?.year),
        month: Number(req.query?.month),
        day: Number(req.query?.day),
        page: Number(req.query?.page || 1),
        limit: Number(req.query?.limit || 10),
      });

      res.status(200).json({
        message: this.getSuccessMessage("read", "Laporan Transaksi"),
        ...parsingResult(data),
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async getReportTrxBetweenDate(
    req: Request<
      ReadReportTrxBetweenDatePayload["params"],
      {},
      {},
      ReadReportTrxBetweenDatePayload["query"]
    >,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await this.service.getReportTrxBetweenDate({
        startDate: req.params.startDate,
        endDate: req.params.endDate,
        page: Number(req.query?.page || 1),
        limit: Number(req.query?.limit || 10),
      });

      res.status(200).json({
        message: this.getSuccessMessage("read", "Laporan Transaksi"),
        ...parsingResult(data),
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }
}

export default ReportController;
