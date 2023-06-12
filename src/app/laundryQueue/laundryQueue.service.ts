import {
  Prisma,
  LaundryQueue,
  LaundryItem,
  Customer,
  LaundryRoom,
} from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import _ from "lodash";
import { dateIndoWIB } from "../../configs/date.config";

export interface ILaundryQueueInput
  extends Omit<LaundryQueue, "createdAt" | "updatedAt" | "laundries"> {}

@BindAllMethods
class LaundryQueueService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_laundry_queues",
      primaryKey: "laundry_queue_id",
      lengthPKValue: 7,
    };
  }

  public async getAll(
    options?: Prisma.LaundryQueueFindManyArgs
  ): Promise<LaundryQueue[] | void> {
    try {
      return await this.prisma.laundryQueue.findMany(options);
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllLaundryQueues");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<LaundryQueue | void | null> {
    try {
      return await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: id },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryQueueById");
      this.throwError(error);
    }
  }

  public async getByIdWithInclude(
    id: string
  ): Promise<LaundryQueue | void | null> {
    try {
      return await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: id },
        include: {
          customer: true,
          user: true,
          laundryRooms: true,
          laundries: true,
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

  public async count(
    args?: Prisma.LaundryQueueCountArgs
  ): Promise<number | undefined> {
    try {
      return await this.prisma.laundryQueue.count({ ...args });
    } catch (error) {
      this.logger.error("[EXCEPTION] countLaundryQueue");
      this.throwError(error);
    }
  }

  public async create(
    input: Omit<
      ILaundryQueueInput,
      "laundryQueueId" | "deliveryAt" | "finishedAt"
    >
  ): Promise<
    | {
        laundryRoom: LaundryRoom;
        laundryQueue: LaundryQueue;
      }
    | null
    | undefined
  > {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const laundryQueueId = await this.createPrimaryKeyValue(tx);
        const data: ILaundryQueueInput = {
          laundryQueueId: laundryQueueId,
          queuePaymentStatus: input.queuePaymentStatus,
          deliveryType: input.deliveryType,
          status: input.status,
          userId: input.userId,
          customerId: input.customerId,
          deliveryAt: null,
          finishedAt: null,
          note: input.note,
        };

        const createdLaundryQueue = await tx.laundryQueue.create({ data });

        const laundryRoomId = await this.generateIncField({
          prismaTx: tx,
          tableName: "tb_laundry_rooms",
          field: "laundry_room_id",
          customPrefix: dateIndoWIB().format("DDMMYY"),
          length: 6,
        });

        const createdLaundryRoom = await tx.laundryRoom.create({
          data: {
            laundryRoomId: laundryRoomId,
            laundryQueueId: createdLaundryQueue.laundryQueueId,
            userId: input.userId,
            total: 0,
            status: "READY",
          },
        });

        return {
          laundryQueue: createdLaundryQueue,
          laundryRoom: createdLaundryRoom,
        };
      });

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] createLaundryQueue");
      this.throwError(error);
    }
  }

  public async updateDelivered(
    id: string,
    customerId: string
  ): Promise<
    | {
        customer: Customer;
        laundryQueue: LaundryQueue;
      }
    | null
    | undefined
  > {
    try {
      const result = this.prisma.$transaction(async tx => {
        const updatedLaundryQueue = await tx.laundryQueue.update({
          where: { laundryQueueId: id },
          data: {
            deliveryAt: dateIndoWIB().toDate(),
          },
        });
        const customer = await tx.customer.findUnique({
          where: { customerId: customerId },
          include: { customerLevel: true },
        });

        const updateCustomer = await tx.customer.update({
          where: { customerId: customer?.customerId },
          data: {
            point:
              Number(customer?.point) + Number(customer?.customerLevel?.point),
          },
        });
        return { laundryQueue: updatedLaundryQueue, customer: updateCustomer };
      });

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] updateDelivered");
      this.throwError(error);
    }
  }

  public async delete(id: string) {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const deleteLaundries = await tx.laundryItem.deleteMany({
          where: { laundryQueueId: id },
        });
        const deleteLaundryRoom = await tx.laundryRoom.delete({
          where: { laundryQueueId: id },
        });
        const deleteLaundryQueue = await tx.laundryQueue.delete({
          where: { laundryQueueId: id },
        });

        return { deleteLaundries, deleteLaundryRoom, deleteLaundryQueue };
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteLaundryQueue");
      this.throwError(error);
    }
  }
}

export default LaundryQueueService;
