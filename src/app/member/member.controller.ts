import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import {
  DELIVERY_TYPE,
  ENV_STATIC_FOLDER_NAME,
  ENV_STATIC_FOLDER_PATH,
  LAUNDRY_ROOM_STATUS,
  LQ_STATUS,
  PAYMENT_METHODS,
} from "../../configs/vars.config";
import { Member } from "@prisma/client";
import { BaseController } from "../../core";
import { isNumericQuery, parsingResult, searchArray } from "../../utils/utils";
import { sanitizeText } from "../../utils/sanitizer.utils";
import _ from "lodash";
import bcrypt from "bcrypt";
import MemberService from "./member.service";
import FileHelper from "../../helpers/file.helper";
import Pagination from "../../helpers/pagination.helper";
import NotificationService from "../../services/notification/notification.service";
import {
  MemberOrderPayload,
  PostPaymentPayload,
  ReadMemberLaundryQueueByIDPayload,
  ReadMemberLaundryQueuePayload,
  ReadMemberLaundryRoomDetailPayload,
  ReadAdminMembersPayload,
  UpdateAdminMemberPayload,
  ReadAdminMemberPayload,
  ReadMemberPaymentByInvoicePayload,
  ReadMemberTrxPayload,
  UpdateMemberProfilePayload,
  ReadMemberNotificationsPayload,
  ReadMemberNotificationByIdPayload,
} from "./member.schema";
import {
  DeliveryType,
  LaundryQueue,
  LaundryQueueStatus,
  LaundryRoom,
  LaundryRoomStatus,
  Payment,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { SortingTypes } from "../../utils/types/types";
import { ReadLaundryRoomPayload } from "../laundryRoom/laundryRoom.schema";

@BindAllMethods
class MemberController extends BaseController {
  private readonly service = new MemberService();
  private readonly notificationService = new NotificationService();
  constructor() {
    super();
  }

  // ── Admin methods ──────────────────────────────────────────────

  public async adminGetAllMembers(
    req: Request<{}, {}, {}, ReadAdminMembersPayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let where: Prisma.MemberWhereInput = {};

      const paginated = new Pagination<Member>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "members",
      });

      const { limit, skip } = paginated.getPagination();
      const orderBy: Prisma.MemberOrderByWithRelationAndSearchRelevanceInput = {
        [`${_orderBy || "createdAt"}`]: (_sortBy as Prisma.SortOrder) || "desc",
      };

      if (_search) {
        where = {
          OR: [
            { memberId: { contains: _search } },
            { email: { contains: _search } },
            { username: { contains: _search } },
            { customer: { name: { contains: _search } } },
          ],
        };
      }

      const members = await this.service.getAll({
        where,
        skip,
        orderBy,
        take: limit,
        include: {
          customer: {
            include: {
              customerLevel: true,
              _count: { select: { laundryQueues: true } },
            },
          },
        },
      });

      const total = await this.service.count({ where });

      const data = paginated.getPagingData(
        Number(total),
        parsingResult(members),
      );
      res.status(200).json({
        message: this.getSuccessMessage("read", "Member"),
        data: { search: _search, ...data },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async adminGetMemberById(
    req: Request<ReadAdminMemberPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const memberId = req.params.memberId;
    try {
      const member = await this.service.getById(memberId, {
        include: {
          customer: {
            include: {
              customerLevel: true,
              _count: { select: { laundryQueues: true } },
            },
          },
          sessions: { take: 5, orderBy: { createdAt: "desc" } },
        },
      });
      if (!member) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Member", memberId),
        );
      }

      // Aggregate stats
      const payments = await this.prisma.payment.findMany({
        where: {
          laundryQueue: {
            customerId: member.customerId ?? undefined,
            queuePaymentStatus: "FINISHED",
          },
        },
      });
      const totalOrders = await this.prisma.laundryQueue.count({
        where: { customerId: member.customerId ?? undefined },
      });
      const totalSpending = payments.reduce(
        (sum, p) => sum + Number(p.totalPrice),
        0,
      );

      res.status(200).json({
        message: this.getSuccessMessage("readById", "Member", memberId),
        member: parsingResult(member),
        stats: {
          totalOrders,
          totalSpending,
          totalTransactions: payments.length,
        },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async adminUpdateMember(
    req: Request<
      UpdateAdminMemberPayload["params"],
      {},
      UpdateAdminMemberPayload["body"]
    >,
    res: Response,
    next: NextFunction,
  ) {
    const memberId = req.params.memberId;
    try {
      const existing = await this.service.getById(memberId);
      if (!existing) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Member", memberId),
        );
      }

      const { username, email, status, password, customer } = req.body;

      const result = await this.prisma.$transaction(async tx => {
        const memberData: any = {};
        if (username !== undefined) memberData.username = sanitizeText(username);
        if (email !== undefined) memberData.email = email;
        if (status !== undefined) memberData.status = status;
        if (password !== undefined) {
          memberData.password = await bcrypt.hash(password, 10);
        }

        const updatedMember =
          Object.keys(memberData).length > 0
            ? await tx.member.update({ where: { memberId }, data: memberData })
            : existing;

        let updatedCustomer = existing.customerId;
        if (customer && existing.customerId) {
          const custData: any = {};
          if (customer.name !== undefined) custData.name = sanitizeText(customer.name);
          if (customer.address !== undefined)
            custData.address = sanitizeText(customer.address);
          if (customer.phone !== undefined) custData.phone = sanitizeText(customer.phone);
          if (customer.customerLevelId !== undefined)
            custData.customerLevelId = customer.customerLevelId;
          if (Object.keys(custData).length > 0) {
            updatedCustomer = (await tx.customer.update({
              where: { customerId: existing.customerId },
              data: custData,
            })) as any;
          }
        }

        return { member: updatedMember, customer: updatedCustomer };
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "Member"),
        member: parsingResult(result.member),
        customer: parsingResult(result.customer),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async adminResetMemberPassword(
    req: Request<{ memberId: string }>,
    res: Response,
    next: NextFunction,
  ) {
    const memberId = req.params.memberId;
    try {
      const existing = await this.service.getById(memberId);
      if (!existing) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Member", memberId),
        );
      }

      const tempPassword = _.sample([
        "Temp@123",
        "Member123",
        "Reset@123",
        "12345678",
      ]) as string;
      const hashed = await bcrypt.hash(tempPassword, 10);

      await this.service.update(memberId, { password: hashed });

      res.status(200).json({
        message: "Password berhasil direset",
        temporaryPassword: tempPassword,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async adminPutAvatar(
    req: Request<{ memberId: string }>,
    res: Response,
    next: NextFunction,
  ) {
    const memberId = req.params.memberId;
    try {
      const existing = await this.service.getById(memberId);
      if (!existing) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Member", memberId),
        );
      }

      const fileimgData = req.fileimg?.data;

      if (fileimgData?.path) {
        // Upload new avatar
        const avatarPath = fileimgData.path.replace(ENV_STATIC_FOLDER_NAME, "");
        if (existing.avatar && existing.avatar !== "/img/avatars/avatar.jpg") {
          FileHelper.unlinkFile(
            ENV_STATIC_FOLDER_PATH + existing.avatar,
            false,
          );
        }
        const updated = await this.service.update(memberId, {
          avatar: avatarPath,
        });
        res
          .status(200)
          .json({
            message: "Avatar berhasil diupload",
            member: parsingResult(updated),
          });
      } else {
        // Reset avatar (no file uploaded)
        if (existing.avatar && existing.avatar !== "/img/avatars/avatar.jpg") {
          FileHelper.unlinkFile(
            ENV_STATIC_FOLDER_PATH + existing.avatar,
            false,
          );
        }
        const updated = await this.service.update(memberId, {
          avatar: "/img/avatars/avatar.jpg",
        });
        res
          .status(200)
          .json({
            message: "Avatar berhasil direset",
            member: parsingResult(updated),
          });
      }
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  // ── Existing member-facing methods ─────────────────────────────

  public async postLaundryQueueOrder(
    req: Request<{}, {}, MemberOrderPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { customerId: req.member?.customerId as string },
      });

      const laundryServices = await this.prisma.service.findMany({
        where: {
          serviceId: {
            in: req.body.services,
          },
        },
      });

      const order = await this.service.createLaundryQueueOrder({
        pickupAt: req.body.pickupAt,
        deliveryType: req.body.deliveryType,
        deliveryAddress: sanitizeText(req.body.deliveryAddress),
        note: sanitizeText(req.body.note),
        customerId: customer?.customerId as string,
        services: laundryServices,
        memberId: req.member?.memberId as string,
      });
      return res.status(201).json({
        message: "Order berhasil dan sedang diproses",
        order: parsingResult(order),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  private sortingLaundryQueue(
    orderBy: string,
    sortBy: Prisma.SortOrder,
  ): SortingTypes<Prisma.LaundryQueueOrderByWithRelationAndSearchRelevanceInput> {
    let sortingOptions: SortingTypes<Prisma.LaundryQueueOrderByWithRelationAndSearchRelevanceInput> =
      {
        [`${orderBy || "laundryQueueId"}`]: sortBy || "desc",
      };

    if (!orderBy) {
      sortingOptions = [{ status: "asc" }, { laundryQueueId: "desc" }];
    }

    if (orderBy?.trim() === "total") {
      sortingOptions = {
        laundryRoom: {
          total: sortBy as Prisma.SortOrder,
        },
      };
    }

    return sortingOptions;
  }

  private searchingLaundryQueue(
    query: string,
  ): Prisma.Enumerable<Prisma.LaundryQueueWhereInput> {
    const statusByQuery = searchArray<string>(Object.keys(LQ_STATUS), query);
    const deliveryTypeByQuery = searchArray<string>(
      Object.keys(DELIVERY_TYPE),
      query,
    );
    const ORsearching: Prisma.Enumerable<Prisma.LaundryQueueWhereInput> = [
      {
        laundryQueueId: {
          contains: query,
        },
      },
      {
        customer: {
          name: { contains: query },
        },
      },
    ];

    if (isNumericQuery(query)) {
      ORsearching.push({
        laundryRoom: {
          total: { equals: +query },
        },
      });
    }

    if (statusByQuery.length !== 0) {
      ORsearching.push({
        status: { equals: statusByQuery[0] as LaundryQueueStatus },
      });
    }
    if (deliveryTypeByQuery.length !== 0) {
      ORsearching.push({
        deliveryType: {
          equals: deliveryTypeByQuery[0] as DeliveryType,
        },
      });
    }

    return ORsearching;
  }

  public async getLaundryQueue(
    req: Request<{}, {}, {}, ReadMemberLaundryQueuePayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let whereQuery: Prisma.LaundryQueueWhereInput = {};

      const paginated = new Pagination<LaundryQueue>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "laundryQueues",
      });

      const sorting = this.sortingLaundryQueue(
        _orderBy as string,
        _sortBy as Prisma.SortOrder,
      );

      const { limit, skip } = paginated.getPagination();

      if (_search) {
        whereQuery = {
          OR: this.searchingLaundryQueue(_search),
        };
      }

      const laundryQueues = (await this.service.getLaundryQueueOrders({
        where: { ...whereQuery, customerId: req.member?.customerId as string },
        skip: skip,
        orderBy: sorting,
        take: limit,
      })) as LaundryQueue[];

      const totalLaundryQueues = (await this.prisma.laundryQueue.count({
        where: { ...whereQuery, customerId: req.member?.customerId as string },
      })) as number;

      const data = paginated.getPagingData(totalLaundryQueues, laundryQueues);

      res.status(200).json({
        message: this.getSuccessMessage("read", "Antrian Member"),
        data: { search: _search, ...parsingResult(data) },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  private sortingLaundryRoom(
    orderBy: string,
    sortBy: Prisma.SortOrder,
  ): SortingTypes<Prisma.LaundryRoomOrderByWithRelationAndSearchRelevanceInput> {
    let sortingOptions: SortingTypes<Prisma.LaundryRoomOrderByWithRelationAndSearchRelevanceInput> =
      {
        [`${orderBy || "laundryRoomId"}`]: sortBy || "desc",
      };

    if (!orderBy) {
      sortingOptions = [{ status: "asc" }, { laundryRoomId: "desc" }];
    }

    if (orderBy?.includes("customerName")) {
      sortingOptions = {
        laundryQueue: {
          customer: {
            name: sortBy as Prisma.SortOrder,
          },
        },
      };
    }

    return sortingOptions;
  }

  private searchingLaundryRoom(
    query: string,
  ): Prisma.Enumerable<Prisma.LaundryRoomWhereInput> {
    const statusByQuery = searchArray<string>(
      Object.keys(LAUNDRY_ROOM_STATUS),
      query,
    );

    const ORsearching: Prisma.Enumerable<Prisma.LaundryRoomWhereInput> = [
      {
        laundryRoomId: {
          contains: query,
        },
      },
      {
        laundryQueueId: {
          contains: query,
        },
      },
    ];

    if (isNumericQuery(query)) {
      ORsearching.push({
        total: { equals: +query },
      });
    }

    if (statusByQuery.length !== 0) {
      ORsearching.push({
        status: { equals: statusByQuery[0] as LaundryRoomStatus },
      });
    }

    return ORsearching;
  }

  public async getLaundryRoom(
    req: Request<{}, {}, {}, ReadLaundryRoomPayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let whereQuery: Prisma.LaundryRoomWhereInput = {};

      const paginated = new Pagination<LaundryRoom>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "laundryRooms",
      });

      const sorting = this.sortingLaundryRoom(
        _orderBy as string,
        _sortBy as Prisma.SortOrder,
      );

      const { limit, skip } = paginated.getPagination();

      if (_search) {
        whereQuery = {
          OR: this.searchingLaundryRoom(_search),
        };
      }

      const result = (await this.prisma.laundryRoom.findMany({
        where: {
          ...whereQuery,
          laundryQueue: { customerId: req.member?.customerId as string },
        },
        orderBy: sorting,
        take: limit,
        skip,
        include: {
          laundryQueue: {
            include: {
              customer: true,
              _count: { select: { laundries: true } },
            },
          },
        },
      })) as LaundryRoom[];

      const total = (await this.prisma.laundryRoom.count({
        where: {
          ...whereQuery,
          laundryQueue: { customerId: req.member?.customerId as string },
        },
      })) as number;

      const data = paginated.getPagingData(total, result);

      const response = {
        message: this.getSuccessMessage("read", "Member Laundry Room"),
        data: { search: _search, ...parsingResult(data) },
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  public async getLaundryRoomByID(
    req: Request<ReadMemberLaundryRoomDetailPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { laundryQueueId } = req.params;

      const result = await this.service.getLaundryRoomById(laundryQueueId);

      if (!result) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Laundry", laundryQueueId),
        );
      }

      return res.status(200).json({
        message: this.getSuccessMessage("readById", "Laundry", laundryQueueId),
        laundryRoom: parsingResult(result),
      });
    } catch (error) {
      return next(error);
    }
  }

  public async getLaundryQueueByID(
    req: Request<ReadMemberLaundryQueueByIDPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const laundryQueue =
        await this.service.getLaundryQueueById(laundryQueueIdParam);

      if (!laundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam,
          ),
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Antrian",
          laundryQueueIdParam,
        ),
        laundryQueue: parsingResult(laundryQueue),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getLaundryItems(
    req: Request<ReadMemberLaundryQueueByIDPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const laundryQueueIdParam = req.params.laundryQueueId as string;

    try {
      const laundryQueue = await this.prisma.laundryQueue.findUnique({
        where: { laundryQueueId: laundryQueueIdParam },
      });

      if (!laundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam,
          ),
        );
      }

      const laundries =
        await this.service.getLaundryItemByLaundryQueueID(laundryQueueIdParam);

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Cucian dari Antrian",
          laundryQueueIdParam,
        ),
        laundries: parsingResult(laundries),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  private sortingTrx(
    orderBy: string,
    sortBy: Prisma.SortOrder,
  ): SortingTypes<Prisma.PaymentOrderByWithRelationAndSearchRelevanceInput> {
    let sortingOptions: SortingTypes<Prisma.PaymentOrderByWithRelationAndSearchRelevanceInput> =
      {
        [`${orderBy}`]: sortBy || "desc",
      };

    if (!orderBy) {
      sortingOptions = [{ createdAt: "desc" }];
    }

    return sortingOptions;
  }

  private searchingTrx(
    query: string,
  ): Prisma.Enumerable<Prisma.PaymentWhereInput> {
    const paymentQuery = searchArray<string>(
      Object.keys(PAYMENT_METHODS),
      query,
    );

    const ORsearching: Prisma.Enumerable<Prisma.PaymentWhereInput> = [
      { userId: { contains: query } },
      { invoice: { contains: query } },
      {
        laundryQueue: {
          customer: {
            name: { contains: query },
          },
        },
      },
    ];

    if (paymentQuery.length !== 0) {
      ORsearching.push({
        paymentMethod: { equals: paymentQuery[0] as PaymentMethod },
      });
    }

    if (isNumericQuery(query)) {
      ORsearching.push({
        totalPrice: { equals: +query },
      });
    }

    return ORsearching;
  }

  public async getMemberTransaction(
    req: Request<{}, {}, {}, ReadMemberTrxPayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let whereQuery: Prisma.PaymentWhereInput = {
        laundryQueue: {
          status: "FINISHED",
          customerId: req.member?.customerId as string,
          queuePaymentStatus: "FINISHED",
        },
      };

      const paginated = new Pagination<Payment>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "transactions",
      });

      const { limit, skip } = paginated.getPagination();

      const sorting = this.sortingTrx(
        _orderBy as string,
        _sortBy as Prisma.SortOrder,
      );

      if (_search) {
        whereQuery = {
          ...whereQuery,
          OR: this.searchingTrx(_search),
        };
      }

      const payments = await this.service.getMemberTrx({
        where: whereQuery,
        include: {
          laundryQueue: { include: { customer: true } },
        },
        skip,
        orderBy: sorting,
        take: limit,
      });

      const totalPayments = (await this.prisma.payment.count({
        where: whereQuery,
      })) as number;

      const data = paginated.getPagingData(
        totalPayments,
        payments as Payment[],
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Transaksi"),
        data: { search: _search, ...parsingResult(data) },
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async postPayment(
    req: Request<{}, {}, PostPaymentPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    const laundryQueueIdParam = req.body.laundryQueueId as string;

    const fileimgData = req.fileimg?.data;
    let proof = null;

    try {
      const laundryQueue =
        await this.service.getLaundryQueueById(laundryQueueIdParam);

      if (!laundryQueue) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Antrian",
            laundryQueueIdParam,
          ),
        );
      }

      if (fileimgData) {
        proof = fileimgData.path?.replace(ENV_STATIC_FOLDER_NAME, "");
      }

      const data = await this.service.createPayment({
        laundryQueueId: laundryQueue?.laundryQueueId,
        proof,
        paymentMethod: req.body.paymentMethod,
        memberId: req.member?.memberId as string,
      });

      res.status(200).json({
        message: this.getSuccessMessage(
          "create",
          "Pembayaran",
          laundryQueueIdParam,
        ),
        data: parsingResult(data),
      });
    } catch (error: any) {
      if (fileimgData) {
        FileHelper.unlinkFile(ENV_STATIC_FOLDER_PATH + proof, false);
      }
      this.nextError(next, error);
    }
  }

  public async getMemberInvoice(
    req: Request<ReadMemberPaymentByInvoicePayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const invoiceParam = req.params.invoice as string;

    try {
      const invoice = await this.service.getMemberInvoice(invoiceParam);

      if (!invoice) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Invoice", invoiceParam),
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage("readById", "Invoice", invoiceParam),
        invoice: parsingResult(invoice),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async putMemberProfile(
    req: Request<{}, {}, UpdateMemberProfilePayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    const member = req.member;
    try {
      if (!member) {
        return res.status(404).json({
          message: "Failed to get member profile",
          member: req.member,
        });
      }
      const memberIdParam = member.memberId as string;

      const { name, address, phone, username } = req.body;

      const existingMember = await this.service.getById(memberIdParam);

      if (!existingMember) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Pelanggan", memberIdParam),
        );
      }

      const result = await this.prisma.$transaction(async tx => {
        const updatedMember = await tx.member.update({
          where: { memberId: memberIdParam },
          data: { username: sanitizeText(username) },
        });

        const updatedCustomer = await tx.customer.update({
          where: { customerId: existingMember?.customerId as string },
          data: {
            name: sanitizeText(name),
            address: sanitizeText(address),
            phone: sanitizeText(phone),
          },
        });

        return { customer: updatedCustomer, member: updatedMember };
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "Member Profile"),
        profile: parsingResult(result),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  // ── Member notifications ───────────────────────────────────────

  public async getMemberNotifications(
    req: Request<{}, {}, {}, ReadMemberNotificationsPayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const memberId = req.member?.memberId as string;
      const { _page = 1, _limit = 10 } = req.query;

      const paginated = new Pagination(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "notifications",
      });
      const { limit, skip } = paginated.getPagination();

      const notifications =
        await this.notificationService.getMemberNotifications(memberId, {
          skip,
          take: limit,
        });

      const total = await this.notificationService.getMemberUnreadCount(
        memberId,
      );
      const totalAll = await this.prisma.memberNotification.count({
        where: { memberId },
      });

      const data = paginated.getPagingData(totalAll, parsingResult(notifications));

      res.status(200).json({
        message: this.getSuccessMessage("read", "Notifikasi"),
        data: { unreadCount: total, ...data },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getMemberUnreadCount(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const memberId = req.member?.memberId as string;
      const count = await this.notificationService.getMemberUnreadCount(memberId);
      res.status(200).json({
        message: "Jumlah notifikasi belum dibaca",
        unreadCount: count,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async patchReadMemberNotification(
    req: Request<ReadMemberNotificationByIdPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { notificationId } = req.params;
      await this.notificationService.markMemberNotificationAsRead(
        notificationId,
      );
      res.status(200).json({
        message: "Notifikasi telah ditandai sebagai dibaca",
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async patchReadAllMemberNotifications(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const memberId = req.member?.memberId as string;
      await this.notificationService.markAllMemberNotificationsAsRead(memberId);
      res.status(200).json({
        message: "Semua notifikasi telah ditandai sebagai dibaca",
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default MemberController;
