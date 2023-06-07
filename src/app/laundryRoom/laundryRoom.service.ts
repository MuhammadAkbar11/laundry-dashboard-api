import { LaundryQueue, LaundryRoom, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { replacerBigIntToNumber } from "../../utils/utils";
import { BindAllMethods } from "../../utils/decorators.utils";
import { dateIndoWIB } from "../../configs/date.config";

// export interface ILaundryRoomInput
//   extends Omit<LaundryRoom, "createdAt" | "updatedAt" | "laundries"> {}

@BindAllMethods
class LaundryRoomService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_laundry_rooms",
      primaryKey: "laundry_room_id",
      lengthPKValue: 21,
    };
  }

  public async getAll(
    options?: Prisma.LaundryRoomFindManyArgs
  ): Promise<LaundryRoom[] | void> {
    try {
      const data = await this.prisma.laundryRoom.findMany(options);
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllLaundryRoom");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<LaundryRoom | void | null> {
    try {
      const data = await this.prisma.laundryRoom.findUnique({
        where: { laundryRoomId: id },
        include: {
          user: true,
          laundryQueue: {
            include: { customer: true },
          },
        },
      });
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryRoomById");
      this.throwError(error);
    }
  }

  public async updateFinished(
    id: string,
    laundryQueueId: string
  ): Promise<LaundryRoom | undefined> {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const updatedlaundryQueue = await tx.laundryQueue.update({
          where: {
            laundryQueueId: laundryQueueId,
          },
          data: {
            status: "FINISHED",
            finishedAt: dateIndoWIB().toDate(),
          },
        });

        const updatedlaundryRoom = await tx.laundryRoom.update({
          where: { laundryRoomId: id },
          data: {
            status: "FINISHED",
          },
        });

        return {
          laundryRoom: updatedlaundryRoom,
          laundryQueue: updatedlaundryQueue,
        };
      });

      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] updateFinished");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.LaundryRoomCountArgs) {
    try {
      const data = await this.prisma.laundryRoom.count({ ...args });
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] countLaundryQueue");
      this.throwError(error);
    }
  }
}

export default LaundryRoomService;
