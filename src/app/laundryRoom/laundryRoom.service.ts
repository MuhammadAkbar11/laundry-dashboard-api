import { LaundryQueue, LaundryRoom, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { dateIndoWIB } from "../../configs/date.config";
import NotificationService from "../../services/notification/notification.service";

// export interface ILaundryRoomInput
//   extends Omit<LaundryRoom, "createdAt" | "updatedAt" | "laundries"> {}

@BindAllMethods
class LaundryRoomService extends BaseService {
  private notificationService = new NotificationService();

  constructor() {
    super();
    this.table = {
      name: "tb_laundry_rooms",
      primaryKey: "laundry_room_id",
      lengthPKValue: 21,
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
    options?: Prisma.LaundryRoomFindManyArgs
  ): Promise<LaundryRoom[] | void> {
    try {
      const data = await this.prisma.laundryRoom.findMany(options);
      return data;
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllLaundryRoom");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<LaundryRoom | void | null> {
    try {
      const result = await this.prisma.laundryRoom.findUnique({
        where: { laundryRoomId: id },
        include: {
          laundryQueue: {
            include: { customer: true, payment: true },
          },
        },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryRoomById");
      this.throwError(error);
    }
  }

  public async updateFinished(
    id: string,
    laundryQueueId: string
  ): Promise<
    { laundryRoom: LaundryRoom; laundryQueue: LaundryQueue } | undefined
  > {
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

      // Notify the member that the laundry order has been finished.
      if (result) {
        const memberId = await this.getMemberIdFromCustomerId(
          result.laundryQueue.customerId,
        );
        if (memberId) {
          await this.notificationService.notifyMember(
            memberId,
            "LAUNDRY_FINISHED",
            { orderNumber: laundryQueueId },
          );
        }
      }

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] updateFinished");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.LaundryRoomCountArgs) {
    try {
      const result = await this.prisma.laundryRoom.count({ ...args });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] countLaundryQueue");
      this.throwError(error);
    }
  }
}

export default LaundryRoomService;