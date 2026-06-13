import { Payment, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { dateIndoWIB } from "../../configs/date.config";
import NotificationService from "../../services/notification/notification.service";

// export interface IPaymentInput
//   extends Omit<Payment, "createdAt" | "updatedAt" | "laundries"> {}

@BindAllMethods
class PaymentService extends BaseService {
  private notificationService = new NotificationService();

  constructor() {
    super();
    this.table = {
      name: "tb_payments",
      primaryKey: "payment_id",
      lengthPKValue: 7,
    };
  }

  /**
   * Resolve memberId from customerId via Customer → Member relation.
   */
  private async getMemberIdFromCustomerId(
    customerId: string,
  ): Promise<string | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { customerId },
      include: { Member: true },
    });
    return customer?.Member?.memberId || null;
  }

  public async getAll(
    options?: Prisma.PaymentFindManyArgs,
  ): Promise<Payment[] | void> {
    try {
      const data = await this.prisma.payment.findMany(options);
      return data;
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllPayment");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<Payment | void | null> {
    try {
      const result = await this.prisma.payment.findUnique({
        where: { paymentId: id },
        include: {
          user: true,
          laundryQueue: {
            include: { customer: true },
          },
        },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getPaymentById");
      this.throwError(error);
    }
  }

  public async getByInvoice(invoice: string): Promise<Payment | void | null> {
    try {
      const result = await this.prisma.payment.findUnique({
        where: { invoice: invoice },
        include: {
          user: true,
          laundryQueue: {
            include: {
              customer: true,
              laundryRoom: true,
              laundries: { include: { historyService: true } },
            },
          },
        },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getByInvoice");
      this.throwError(error);
    }
  }

  public async create(
    payload: Pick<
      Payment,
      "paid" | "laundryQueueId" | "paymentMethod" | "userId"
    > & {
      code: string;
    },
  ) {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const laundryQueue = await tx.laundryQueue.findUnique({
          where: { laundryQueueId: payload.laundryQueueId },
          include: {
            laundryRoom: true,
            laundries: {
              include: {
                historyService: true,
              },
            },
            customer: { include: { customerLevel: true } },
            _count: { select: { laundries: true } },
          },
        });

        const roomTotalPrice = Number(laundryQueue?.laundryRoom?.total);
        const customerDiscount = Number(
          laundryQueue?.customer?.customerLevel?.discount,
        );
        let discount = (roomTotalPrice * customerDiscount) / 100;

        // const promo = await tx.promo.findUnique({
        //   where: { code: payload.code?.trim() },
        // });

        // if (promo) {
        //   discount =
        //     (roomTotalPrice * customerDiscount) / 100 +
        //     ((roomTotalPrice - (roomTotalPrice * customerDiscount) / 100) *
        //       promo.discount) /
        //       100;
        // }

        const paymentId = await this.createPrimaryKeyValue();
        const paymentInvoice = await this.generateIncField({
          prismaTx: tx,
          tableName: "tb_payments",
          customPrefix: dateIndoWIB().format("DDMMYY"),
          field: "invoice",
        });

        const createdPayment = await tx.payment.create({
          data: {
            paymentId: paymentId,
            invoice: paymentInvoice,
            laundryQueueId: payload.laundryQueueId,
            totalLaundry: laundryQueue?._count.laundries as number,
            price: roomTotalPrice,
            discount: discount,
            totalPrice: roomTotalPrice - discount,
            paid: payload.paid,
            cashback: Number(payload.paid) - (roomTotalPrice - discount),
            paymentMethod: payload.paymentMethod,
            userId: payload.userId,
            createdAt: dateIndoWIB().format(),
            updatedAt: dateIndoWIB().format(),
          },
        });

        const countCashflow = await tx.cashFlow.count();
        let sumCashflow = 0;

        if (countCashflow > 0) {
          const argSumExp = await tx.cashFlow.aggregate({
            _sum: { total: true },
          });
          sumCashflow = Number(argSumExp._sum.total);
        }

        const cashflowId = await this.generateIncField({
          prismaTx: tx,
          tableName: "tb_cashflow",
          field: "cashflow_id",
          length: 7,
        });
        const cashflowInvoice = paymentInvoice;
        // const cashflowInvoice = await this.generateIncField({
        //   prismaTx: tx,
        //   tableName: "tb_cashflow",
        //   field: "cashflow_invoice",
        //   customPrefix: dateIndoWIB().format("DDMMYY"),
        //   length: 12,
        // });

        const createdCashflow = await tx.cashFlow.create({
          data: {
            cashflowId: cashflowId,
            cashflowInvoice: cashflowInvoice,
            description: "Pembayaran Cucian",
            cashflowType: "IN",
            total: roomTotalPrice - discount,
            balance: Number(sumCashflow) + Number(roomTotalPrice - discount),
          },
        });

        const updatedLaunryQueue = await tx.laundryQueue.update({
          where: { laundryQueueId: payload.laundryQueueId },
          data: {
            queuePaymentStatus: "FINISHED",
          },
        });

        return {
          laundryQueue: updatedLaunryQueue,
          payment: createdPayment,
          cashflow: createdCashflow,
        };
      });

      // Notify member and admins after payment completion.
      if (result) {
        const orderNumber = result.laundryQueue.laundryQueueId;
        // const totalPrice = result.payment.totalPrice;

        const memberId = await this.getMemberIdFromCustomerId(
          result.laundryQueue.customerId,
        );
        if (memberId) {
          await this.notificationService.notifyMember(
            memberId,
            "PAYMENT_COMPLETED",
            { orderNumber },
          );
        }

        await this.notificationService.notifyAllUsers("NEW_PAYMENT", {
          orderNumber,
        });
      }

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] createPayment");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.PaymentCountArgs) {
    try {
      return await this.prisma.payment.count({ ...args });
    } catch (error) {
      this.logger.error("[EXCEPTION] countPayment");
      this.throwError(error);
    }
  }

  public async accPayment(payload: { payment: Payment; userId: string }) {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const laundryQueue = await tx.laundryQueue.findUnique({
          where: { laundryQueueId: payload.payment.laundryQueueId },
          include: {
            laundryRoom: true,
            laundries: {
              include: {
                historyService: true,
              },
            },
            customer: { include: { customerLevel: true } },
            _count: { select: { laundries: true } },
          },
        });

        const roomTotalPrice = Number(laundryQueue?.laundryRoom?.total);
        const customerDiscount = Number(
          laundryQueue?.customer?.customerLevel?.discount,
        );
        let discount = (roomTotalPrice * customerDiscount) / 100;

        const paid = roomTotalPrice - discount;
        const cashback = paid - (roomTotalPrice - discount);

        const updatedPayment = await tx.payment.update({
          where: { paymentId: payload?.payment.paymentId as string },
          data: {
            totalLaundry: laundryQueue?._count.laundries as number,
            price: roomTotalPrice,
            discount: discount,
            totalPrice: roomTotalPrice - discount,
            paid: paid,
            cashback: cashback,
            userId: payload.userId,
            createdAt: dateIndoWIB().format(),
            updatedAt: dateIndoWIB().format(),
          },
        });

        const countCashflow = await tx.cashFlow.count();
        let sumCashflow = 0;

        if (countCashflow > 0) {
          const argSumExp = await tx.cashFlow.aggregate({
            _sum: { total: true },
          });
          sumCashflow = Number(argSumExp._sum.total);
        }

        const cashflowId = await this.generateIncField({
          prismaTx: tx,
          tableName: "tb_cashflow",
          field: "cashflow_id",
          length: 7,
        });

        const cashflowInvoice = updatedPayment.invoice;

        // const cashflowInvoice = await this.generateIncField({
        //   prismaTx: tx,
        //   tableName: "tb_cashflow",
        //   field: "cashflow_invoice",
        //   customPrefix: dateIndoWIB().format("DDMMYY"),
        //   length: 12,
        // });

        const createdCashflow = await tx.cashFlow.create({
          data: {
            cashflowId: cashflowId,
            cashflowInvoice: cashflowInvoice,
            description: "Pembayaran Cucian",
            cashflowType: "IN",
            total: roomTotalPrice - discount,
            balance: Number(sumCashflow) + Number(roomTotalPrice - discount),
          },
        });

        const updatedLaunryQueue = await tx.laundryQueue.update({
          where: { laundryQueueId: laundryQueue?.laundryQueueId },
          data: {
            queuePaymentStatus: "FINISHED",
          },
        });

        return {
          laundryQueue: updatedLaunryQueue,
          payment: updatedPayment,
          cashflow: createdCashflow,
        };
      });

      // Notify member after payment is accepted.
      if (result) {
        const orderNumber = result.laundryQueue.laundryQueueId;
        const memberId = await this.getMemberIdFromCustomerId(
          result.laundryQueue.customerId,
        );
        if (memberId) {
          await this.notificationService.notifyMember(
            memberId,
            "PAYMENT_COMPLETED",
            { orderNumber },
          );
        }
      }

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] accPayment");
      this.throwError(error);
    }
  }

  // public async updateFinished(
  //   id: string,
  //   laundryQueueId: string
  // ): Promise<{ payment: Payment; laundryQueue: LaundryQueue } | undefined> {
  //   try {
  //     const result = await this.prisma.$transaction(async tx => {
  //       const updatedlaundryQueue = await tx.laundryQueue.update({
  //         where: {
  //           laundryQueueId: laundryQueueId,
  //         },
  //         data: {
  //           status: "FINISHED",
  //           finishedAt: dateIndoWIB().toDate(),
  //         },
  //       });

  //       const updatedpayment = await tx.payment.update({
  //         where: { paymentId: id },
  //         data: {
  //           status: "FINISHED",
  //         },
  //       });

  //       return {
  //         payment: updatedpayment,
  //         laundryQueue: updatedlaundryQueue,
  //       };
  //     });

  //     return result;
  //   } catch (error) {
  //     this.logger.error("[EXCEPTION] updateFinished");
  //     this.throwError(error);
  //   }
  // }

  // public async count(args?: Prisma.PaymentCountArgs) {
  //   try {
  //     const result = await this.prisma.payment.count({ ...args });
  //     return result;
  //   } catch (error) {
  //     this.logger.error("[EXCEPTION] countLaundryQueue");
  //     this.throwError(error);
  //   }
  // }
}

export default PaymentService;
