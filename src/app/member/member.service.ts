import _ from "lodash";
import {
  Prisma,
  DeliveryType,
  Service,
  LaundryItem,
  LaundryRoom,
  Payment,
  LaundryQueue,
  Member,
  PaymentMethod,
} from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseService } from "../../core";
import { dateIndoWIB } from "../../configs/date.config";
import { MemberOrderPayload, PostPaymentPayload } from "./member.schema";

@BindAllMethods
class MemberService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_members",
      primaryKey: "member_id",
      lengthPKValue: 6,
    };
  }

  public async getAll(
    options?: Prisma.MemberFindManyArgs
  ): Promise<Member[] | void> {
    try {
      const result = await this.prisma.member.findMany(options);
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllMembers");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.MemberCountArgs) {
    try {
      const result = await this.prisma.member.count({ ...args });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllMembers");
      this.throwError(error);
    }
  }

  public async getById(
    id: string,
    options?: Omit<Prisma.MemberFindUniqueArgs, "where">
  ): Promise<Member | void | null> {
    try {
      const result = await this.prisma.member.findUnique({
        ...options,
        where: { memberId: id },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getMemberById");
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    data: Omit<Prisma.MemberUpdateInput, "memberId">
  ): Promise<Member | undefined> {
    try {
      const result = await this.prisma.member.update({
        where: { memberId: id },
        data,
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] updateMember");
      this.throwError(error);
    }
  }

  public async delete(id: string): Promise<Member | undefined> {
    try {
      const result = await this.prisma.member.delete({
        where: { memberId: id },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteMember");
      this.throwError(error);
    }
  }

  public async createLaundryQueueOrder(
    payload: Omit<MemberOrderPayload["body"], "services"> & {
      services: Service[];
      customerId: string;
    }
  ) {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const laundryQueueId = await this.generateIncField({
          prismaTx: tx,
          tableName: "tb_laundry_queues",
          field: "laundry_queue_id",
          customPrefix: dateIndoWIB().format("DDMMYY"),
          length: 11,
        });

        const createdLaundryQueue = await tx.laundryQueue.create({
          data: {
            laundryQueueId: laundryQueueId,
            queuePaymentStatus: "PENDING",
            deliveryType: payload.deliveryType as DeliveryType,
            status: "PENDING",
            customerId: payload?.customerId,
            pickupAt: payload?.pickupAt
              ? dateIndoWIB(payload?.pickupAt).toDate()
              : null,
            deliveryAt: null,
            finishedAt: null,
            deliveryAddress: payload?.deliveryAddress || "",
            note: payload?.note as string,
          },
        });

        const createdLaundryItems = [];
        for (const laundryService of payload.services) {
          const laundryItemId = await this.createPrimaryKeyValue(tx);
          const totalPrice = Number(laundryService?.price) * 0;

          const createdHistoryService = await tx.historyService.create({
            data: {
              historyServiceId: await this.generateIncField({
                prismaTx: tx,
                tableName: "tb_history_services",
                field: "history_service_id",
                length: 7,
              }),
              ..._.omit(laundryService, "createdAt", "updatedAt"),
            },
          });

          const newLaundryItem: Omit<LaundryItem, "createdAt" | "updatedAt"> = {
            laundryId: laundryItemId,
            laundryQueueId: laundryQueueId,
            historyServiceId: createdHistoryService.historyServiceId,
            totalPrice: BigInt(totalPrice),
            note: "",
            quantity: 0,
          };

          const createdLaundryItem = await tx.laundryItem.create({
            data: newLaundryItem,
          });

          createdLaundryItems.push(createdLaundryItem);
        }

        return {
          laundryQueue: createdLaundryQueue,
          laundryItems: createdLaundryItems,
        };
      });

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] createLaundryQueue");
      this.throwError(error);
    }
  }

  public async createPayment(
    payload: PostPaymentPayload["body"] & { proof?: string | null }
  ) {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const laundryQueue = await tx.laundryQueue.findUnique({
          where: { laundryQueueId: payload.laundryQueueId },
          include: {
            _count: { select: { laundries: true } },
          },
        });

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
            price: 0,
            discount: 0,
            totalPrice: 0,
            paid: 0,
            cashback: 0,
            proof: payload.proof,
            paymentMethod: payload.paymentMethod as PaymentMethod,
            userId: null,
            createdAt: dateIndoWIB().format(),
            updatedAt: dateIndoWIB().format(),
          },
        });

        const updatedLaunryQueue = await tx.laundryQueue.update({
          where: { laundryQueueId: payload.laundryQueueId },
          data: {
            queuePaymentStatus: "PROCESSED",
          },
        });

        return {
          laundryQueue: updatedLaunryQueue,
          payment: createdPayment,
        };
      });

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] createPayment");
      this.throwError(error);
    }
  }

  public async getLaundryQueueOrders(
    options: Prisma.LaundryQueueFindManyArgs
  ): Promise<LaundryQueue[] | void | null> {
    try {
      const result = await this.prisma.laundryQueue.findMany({
        where: options.where,
        skip: options.skip,
        orderBy: options.orderBy,
        take: options.take,
        include: {
          laundryRoom: true,
          _count: {
            select: { laundries: true },
          },
        },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryQueueOrders");
      this.throwError(error);
    }
  }

  public async getLaundryRoomById(
    laundryQueueId: string
  ): Promise<LaundryRoom | void | null> {
    try {
      const result = await this.prisma.laundryRoom.findUnique({
        where: { laundryQueueId: laundryQueueId },
        include: {
          laundryQueue: {
            include: { customer: true },
          },
        },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryRoomById");
      this.throwError(error);
    }
  }

  public async getLaundryQueueById(
    id: string
  ): Promise<LaundryQueue | void | null> {
    try {
      return await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: id },
        include: {
          customer: { include: { customerLevel: true } },
          laundryRoom: true,
          _count: {
            select: { laundries: true },
          },
        },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryQueueById");
      this.throwError(error);
    }
  }

  public async getLaundryItemByLaundryQueueID(
    laundryQueueId: string
  ): Promise<LaundryItem[] | void | null> {
    try {
      return await this.prisma.laundryItem.findMany({
        where: { laundryQueueId: laundryQueueId },
        include: {
          historyService: true,
        },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryItemByLaundryQueueID");
      this.throwError(error);
    }
  }

  public async getMemberTrx(
    options?: Prisma.PaymentFindManyArgs
  ): Promise<Payment[] | void> {
    try {
      const data = await this.prisma.payment.findMany(options);
      return data;
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllTrx");
      this.throwError(error);
    }
  }
}

export default MemberService;
