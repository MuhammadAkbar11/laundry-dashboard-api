import { NextFunction, Request, Response } from "express";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { CreatePaymentPayload } from "./payment.schema";
import PaymentService from "./payment.service";
import { parsingResult } from "../../utils/utils";

@BindAllMethods
class PaymentController extends BaseController {
  private readonly service = new PaymentService();

  constructor() {
    super();
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

      res.status(201).json({
        message: this.getSuccessMessage("create", "Pembayaran"),
        data: parsingResult(newPayment),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default PaymentController;
