import { Prisma, LaundryQueue, Laundry } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { replacerBigIntToNumber } from "../../utils/utils";
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
      const data = await this.prisma.laundryQueue.findMany(options);
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllLaundryQueues");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<LaundryQueue | void | null> {
    try {
      const data = await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: id },
      });
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryQueueById");
      this.throwError(error);
    }
  }

  public async getByIdWithInclude(
    id: string
  ): Promise<LaundryQueue | void | null> {
    try {
      const data = await this.prisma.laundryQueue.findUnique({
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
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryQueueById");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.LaundryQueueCountArgs) {
    try {
      const data = await this.prisma.laundryQueue.count({ ...args });
      return replacerBigIntToNumber(data);
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
  ): Promise<LaundryQueue | void | null> {
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

      // const result = await this.prisma.laundryQueue.create({ data });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] createLaundryQueue");
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    data: Omit<ILaundryQueueInput, "laundryQueueId" | "customerId" | "userId">
  ): Promise<LaundryQueue | undefined> {
    try {
      const result = await this.prisma.laundryQueue.update({
        where: { laundryQueueId: id },
        data,
      });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] updateLaundryQueue");
      this.throwError(error);
    }
  }

  public async delete(id: string): Promise<LaundryQueue | undefined> {
    try {
      const deleteLaundries = this.prisma.laundry.deleteMany({
        where: { laundryQueueId: id },
      });
      const deleteLaundryRoom = this.prisma.laundryRoom.delete({
        where: { laundryQueueId: id },
      });
      const deleteLaundryQueue = this.prisma.laundryQueue.delete({
        where: { laundryQueueId: id },
      });

      // const result = await this.prisma.laundryQueue.delete({ where: {laundryQueueId: id}, include :{
      //   laundries: true,
      //   laundryRooms: true
      // } });
      const result = await this.prisma.$transaction([
        deleteLaundries,
        deleteLaundryRoom,
        deleteLaundryQueue,
      ]);
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteLaundryQueue");
      this.throwError(error);
    }
  }
}

export default LaundryQueueService;
