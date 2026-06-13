import {
  HistoryService,
  LaundryItem,
  LaundryQueue,
  LaundryRoom,
  Prisma,
  Service,
} from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import _ from "lodash";
import NotificationService from "../../services/notification/notification.service";

interface ILaundryItemInput extends Omit<
  LaundryItem,
  "laundryId" | "createdAt" | "updatedAt" | "price" | "totalPrice"
> {}

@BindAllMethods
class LaundryItemService extends BaseService {
  private notificationService = new NotificationService();

  constructor() {
    super();
    this.table = {
      name: "tb_laundries",
      primaryKey: "laundry_id",
      lengthPKValue: 8,
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
    options?: Prisma.LaundryItemFindManyArgs,
  ): Promise<LaundryItem[] | void> {
    try {
      const result = await this.prisma.laundryItem.findMany(options);
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllLaundryItems");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<LaundryItem | void | null> {
    try {
      const result = await this.prisma.laundryItem.findUnique({
        where: { laundryId: id },
        include: {
          historyService: true,
        },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryItemById");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.LaundryItemCountArgs) {
    try {
      const result = await this.prisma.laundryItem.count({ ...args });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] countLaundryItem");
      this.throwError(error);
    }
  }

  public async create(
    payload: ILaundryItemInput,
    laundryService: Service,
  ): Promise<
    | {
        laundryItem: LaundryItem;
        laundryRoom: LaundryRoom;
        historyService: HistoryService;
        // laundryQueue: LaundryQueue;
      }
    | void
    | undefined
  > {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const laundryItemId = await this.createPrimaryKeyValue(tx);
        const totalPrice = Number(laundryService?.price) * payload.quantity;

        const createdHistoryService = await tx.historyService.create({
          data: {
            historyServiceId: await this.generateIncField({
              prismaTx: tx,
              tableName: "tb_history_services",
              field: "history_service_id",
              length: 7,
            }),
            name: laundryService?.name,
            serviceId: laundryService?.serviceId,
            description: laundryService?.description,
            unit: laundryService?.unit,
            price: laundryService?.price,
          },
        });

        const newLaundryItem: Omit<LaundryItem, "createdAt" | "updatedAt"> = {
          laundryId: laundryItemId,
          laundryQueueId: payload.laundryQueueId,
          historyServiceId: createdHistoryService.historyServiceId,
          totalPrice: BigInt(totalPrice),
          note: payload.note,
          quantity: payload.quantity,
        };

        const createdLaundryItem = await tx.laundryItem.create({
          data: newLaundryItem,
        });

        const laundryRoom = await tx.laundryRoom.findUnique({
          where: { laundryQueueId: createdLaundryItem.laundryQueueId },
        });

        const updatedlaundryRoom = await tx.laundryRoom.update({
          where: { laundryRoomId: laundryRoom?.laundryRoomId },
          data: {
            status: "WASHED",
            total: laundryRoom?.total
              ? Number(laundryRoom.total) + totalPrice
              : totalPrice,
          },
        });

        return {
          laundryItem: createdLaundryItem,
          laundryRoom: updatedlaundryRoom,
          historyService: createdHistoryService,
        };
      });

      // Notify the member that the laundry has been washed.
      if (result) {
        const queue = await this.prisma.laundryQueue.findUnique({
          where: { laundryQueueId: result.laundryItem.laundryQueueId },
        });
        if (queue) {
          const memberId = await this.getMemberIdFromCustomerId(
            queue.customerId,
          );
          if (memberId) {
            await this.notificationService.notifyMember(
              memberId,
              "LAUNDRY_WASHED",
              { orderNumber: result.laundryItem.laundryQueueId },
            );
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] createLaundryItem");
      this.throwError(error);
    }
  }

  public async update(
    payload: Prisma.LaundryItemUncheckedUpdateInput,
    laundryItem: LaundryItem,
    laundryService: Service,
  ): Promise<
    | {
        laundryItem: LaundryItem;
        laundryRoom: LaundryRoom;
        historyService: HistoryService;
      }
    | void
    | undefined
  > {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const totalPrice =
          Number(laundryService?.price) * Number(payload.quantity);

        const updateHistoryService = await tx.historyService.update({
          where: {
            historyServiceId: laundryItem.historyServiceId,
          },
          data: _.omit(laundryService, "createdAt", "updatedAt"),
        });

        const data: Prisma.LaundryItemUncheckedUpdateInput = {
          totalPrice: BigInt(totalPrice) || laundryItem.totalPrice,
          note: payload?.note || laundryItem.note,
          quantity: payload?.quantity || laundryItem.quantity,
          historyServiceId:
            payload?.historyServiceId || laundryItem.historyServiceId,
        };

        const updatedlaundryItem = await tx.laundryItem.update({
          where: { laundryId: laundryItem?.laundryId },
          data: data,
        });

        const laundryRoom = await tx.laundryRoom.findUnique({
          where: { laundryQueueId: laundryItem.laundryQueueId },
        });

        const laundryRoomTotal = laundryRoom?.total || 0;
        const updatedlaundryRoom = await tx.laundryRoom.update({
          where: { laundryRoomId: laundryRoom?.laundryRoomId },
          data: {
            status: "WASHED",
            total:
              laundryRoomTotal - Number(laundryItem.totalPrice) + totalPrice,
          },
        });

        return {
          laundryItem: updatedlaundryItem,
          laundryRoom: updatedlaundryRoom,
          historyService: updateHistoryService,
        };
      });

      // Notify the member that the laundry has been washed.
      if (result) {
        const queue = await this.prisma.laundryQueue.findUnique({
          where: { laundryQueueId: result.laundryItem.laundryQueueId },
        });
        if (queue) {
          const memberId = await this.getMemberIdFromCustomerId(
            queue.customerId,
          );
          if (memberId) {
            await this.notificationService.notifyMember(
              memberId,
              "LAUNDRY_WASHED",
              { orderNumber: result.laundryItem.laundryQueueId },
            );
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] updateLaundryItem");
      this.throwError(error);
    }
  }

  public async delete(laundryItem: LaundryItem): Promise<
    | {
        laundryItem: LaundryItem;
        laundryRoom: LaundryRoom;
        historyService: HistoryService;
        laundryQueue: LaundryQueue;
      }
    | void
    | undefined
  > {
    try {
      const result = await this.prisma.$transaction(async tx => {
        const deleteLaundryItem = await tx.laundryItem.delete({
          where: { laundryId: laundryItem?.laundryId },
        });

        const deletedHistoryService = await tx.historyService.delete({
          where: {
            historyServiceId: laundryItem.historyServiceId,
          },
        });

        const countLaundryQueuLaundryItems = await tx.laundryItem.count({
          where: { laundryQueueId: deleteLaundryItem.laundryQueueId },
        });

        const laundryRoom = await tx.laundryRoom.findUnique({
          where: { laundryQueueId: deleteLaundryItem.laundryQueueId },
        });

        const laundryRoomTotal = laundryRoom?.total || 0;
        const updatedlaundryRoom = await tx.laundryRoom.update({
          where: { laundryRoomId: laundryRoom?.laundryRoomId },
          data: {
            status: countLaundryQueuLaundryItems !== 0 ? "WASHED" : "READY",
            total: laundryRoomTotal - Number(deleteLaundryItem.totalPrice),
          },
        });

        const updatedLaundryQueue = await tx.laundryQueue.update({
          where: {
            laundryQueueId: deleteLaundryItem.laundryQueueId,
          },
          data: {
            status: countLaundryQueuLaundryItems !== 0 ? "WASHED" : "ONHOLD",
          },
        });

        return {
          laundryItem: deleteLaundryItem,
          laundryRoom: updatedlaundryRoom,
          historyService: deletedHistoryService,
          laundryQueue: updatedLaundryQueue,
        };
      });

      // Notify the member about the resulting queue status.
      if (result) {
        const status = result.laundryQueue.status;
        const typeCode =
          status === "ONHOLD"
            ? "LAUNDRY_ON_HOLD"
            : status === "WASHED"
              ? "LAUNDRY_WASHED"
              : null;
        if (typeCode) {
          const memberId = await this.getMemberIdFromCustomerId(
            result.laundryQueue.customerId,
          );
          if (memberId) {
            await this.notificationService.notifyMember(memberId, typeCode, {
              orderNumber: result.laundryQueue.laundryQueueId,
            });
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteLaundryItem");
      this.throwError(error);
    }
  }
}

export default LaundryItemService;