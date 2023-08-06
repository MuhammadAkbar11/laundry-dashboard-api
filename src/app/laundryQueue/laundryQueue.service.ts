import {
  Prisma,
  LaundryQueue,
  Customer,
  LaundryRoom,
  LaundryQueuePaymentStatus,
  LaundryQueueStatus,
} from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import _ from "lodash";
import { dateIndoWIB } from "../../configs/date.config";

export interface ILaundryQueueInput
  extends Omit<Prisma.LaundryQueueCreateInput, "laundryQueueId" | "customer"> {
  customerId: string;
}

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
          laundryRoom: true,
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
      Prisma.LaundryQueueCreateInput,
      "laundryQueueId" | "customer"
    > & { customerId: string }
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
        // const laundryQueueId = await this.createPrimaryKeyValue(tx);
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
            queuePaymentStatus:
              input?.queuePaymentStatus as LaundryQueuePaymentStatus,
            deliveryType: input.deliveryType,
            status: input?.status as LaundryQueueStatus,
            customerId: input?.customerId,
            pickupAt: input?.pickupAt
              ? dateIndoWIB(input?.pickupAt).toDate()
              : null,
            deliveryAt: null,
            finishedAt: null,
            deliveryAddress: input?.deliveryAddress || "",
            note: input?.note as string,
          },
        });

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

  public async updateStatus(
    laundryQueueId: string,
    status: LaundryQueueStatus
  ): Promise<
    { laundryQueue: LaundryQueue; laundryRoom: LaundryRoom } | null | undefined
  > {
    try {
      let createdLaundryRoom: LaundryRoom;

      const result = await this.prisma.$transaction(async tx => {
        const laundryQueue = await tx.laundryQueue.update({
          where: { laundryQueueId: laundryQueueId },
          data: { status },
        });

        const existLaundryRoom = await tx.laundryRoom.findUnique({
          where: { laundryQueueId },
        });

        if (!existLaundryRoom) {
          if (status === "WASHED" || status === "ONHOLD") {
            const laundryRoomId = await this.generateIncField({
              prismaTx: tx,
              tableName: "tb_laundry_rooms",
              field: "laundry_room_id",
              customPrefix: dateIndoWIB().format("DDMMYY"),
              length: 6,
            });

            createdLaundryRoom = await tx.laundryRoom.create({
              data: {
                laundryRoomId: laundryRoomId,
                laundryQueueId: laundryQueue.laundryQueueId,
                total: 0,
                status: "READY",
              },
            });
          }
        }

        return { laundryQueue, laundryRoom: createdLaundryRoom };
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] updateLaundryQueueStatus");
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
