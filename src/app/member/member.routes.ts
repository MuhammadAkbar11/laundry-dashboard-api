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
} from "./member.schema";
import {
  deserializeMember,
  requiredMember,
} from "../../middlewares/authMember.middleware";
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
    this.router.post(
      "/member/order",
      deserializeMember,
      requiredMember,
      [validateResource(memberOrderSchema)],
      this.controller.postLaundryQueueOrder
    );
    this.router.put(
      "/member/profile",
      deserializeMember,
      requiredMember,
      [validateResource(updateMemberProfileSchema)],
      this.controller.putMemberProfile
    );
    this.router.post(
      "/member/payment",
      deserializeMember,
      requiredMember,
      uploadSingleImage("/payments"),
      [validateResource(postMemberPaymentSchema)],
      this.controller.postPayment
    );
    this.router.get(
      "/laundry-queue",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberLaundryQueueSchema)],
      this.controller.getLaundryQueue
    );
    this.router.get(
      "/transaction",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberTrxSchema)],
      this.controller.getMemberTransaction
    );
    this.router.get(
      "/transaction-invoice/:invoice",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberPaymentByInvoiceSchema)],
      this.controller.getMemberInvoice
    );
    this.router.get(
      "/laundry-queue/:laundryQueueId/laundries",
      deserializeMember,
      requiredMember,
      [validateResource(readLaundryQueueSchema)],
      this.controller.getLaundryItems
    );
    this.router.get(
      "/laundry-queue/:laundryQueueId",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberLaundryRoomDetailSchema)],
      this.controller.getLaundryQueueByID
    );
    this.router.get(
      "/laundry-room",
      deserializeMember,
      requiredMember,
      [validateResource(readLaundryRoomSchema)],
      this.controller.getLaundryRoom
    );
    this.router.get(
      "/laundry-room/:laundryQueueId",
      deserializeMember,
      requiredMember,
      [validateResource(readMemberLaundryRoomDetailSchema)],
      this.controller.getLaundryRoomByID
    );
  }
}

export default MemberRouter;
