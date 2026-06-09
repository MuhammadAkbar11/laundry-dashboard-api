import express from "express";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import {
  memberOrderSchema,
  readMemberLaundryRoomDetailSchema,
  readMemberLaundryQueueSchema,
  readMemberTrxSchema,
  postMemberPaymentSchema,
  readMemberPaymentByInvoiceSchema,
  updateMemberProfileSchema,
  readAdminMembersSchema,
  updateAdminMemberSchema,
  readAdminMemberSchema,
} from "./member.schema";
import {
  deserializeMember,
  requiredMember,
} from "../../middlewares/authMember.middleware";
import { requiredUser } from "../../middlewares/auth.middleware";
import MemberController from "./member.controller";
import { readLaundryRoomSchema } from "../laundryRoom/laundryRoom.schema";
import { readLaundryQueueSchema } from "../laundryQueue/laundryQueue.schema";
import uploadSingleImage from "../../middlewares/upload.middleware";

@BindAllMethods
class MemberRouter extends BaseRouter<MemberController> {
  constructor(protected express: express.Application) {
    super(MemberController, express);
  }

  protected routes(): void {
    // Admin routes
    this.router
      .route("/members")
      .get(
        requiredUser,
        [validateResource(readAdminMembersSchema)],
        this.controller.adminGetAllMembers,
      );
    this.router
      .route("/members/:memberId")
      .get(
        requiredUser,
        [validateResource(readAdminMemberSchema)],
        this.controller.adminGetMemberById,
      )
      .put(
        requiredUser,
        [validateResource(updateAdminMemberSchema)],
        this.controller.adminUpdateMember,
      );
    this.router.post(
      "/members/:memberId/reset-password",
      requiredUser,
      this.controller.adminResetMemberPassword,
    );
    // Single avatar endpoint: PUT with file = upload, PUT without file = reset
    this.router.put(
      "/members/:memberId/avatar",
      requiredUser,
      uploadSingleImage("/members"),
      this.controller.adminPutAvatar,
    );

    // Member routes
    this.router.post(
      "/member/order",
      deserializeMember,
      requiredMember,
      [validateResource(memberOrderSchema)],
      this.controller.postLaundryQueueOrder,
    );
    this.router.put(
      "/member/profile",
      deserializeMember,
      requiredMember,
      [validateResource(updateMemberProfileSchema)],
      this.controller.putMemberProfile,
    );
    this.router.post(
      "/member/payment",
      deserializeMember,
      requiredMember,
      uploadSingleImage("/payments"),
      [validateResource(postMemberPaymentSchema)],
      this.controller.postPayment,
    );
    this.router.get(
      "/laundry-queue",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberLaundryQueueSchema)],
      this.controller.getLaundryQueue,
    );
    this.router.get(
      "/transaction",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberTrxSchema)],
      this.controller.getMemberTransaction,
    );
    this.router.get(
      "/transaction-invoice/:invoice",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberPaymentByInvoiceSchema)],
      this.controller.getMemberInvoice,
    );
    this.router.get(
      "/laundry-queue/:laundryQueueId/laundries",
      deserializeMember,
      requiredMember,
      [validateResource(readLaundryQueueSchema)],
      this.controller.getLaundryItems,
    );
    this.router.get(
      "/laundry-queue/:laundryQueueId",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberLaundryRoomDetailSchema)],
      this.controller.getLaundryQueueByID,
    );
    this.router.get(
      "/laundry-room",
      deserializeMember,
      requiredMember,
      [validateResource(readLaundryRoomSchema)],
      this.controller.getLaundryRoom,
    );
    this.router.get(
      "/laundry-room/:laundryQueueId",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberLaundryRoomDetailSchema)],
      this.controller.getLaundryRoomByID,
    );
  }
}

export default MemberRouter;
