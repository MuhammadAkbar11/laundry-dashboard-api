import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import ProfileController from "./profile.controller";
import { requiredUser } from "../../middlewares/auth.middleware";
import {
  deserializeMember,
  requiredMember,
} from "../../middlewares/authMember.middleware";

@BindAllMethods
class ProfileRouter extends BaseRouter<ProfileController> {
  constructor(protected express: express.Application) {
    super(ProfileController, express);
  }

  protected routes(): void {
    this.router
      .route("/member")
      .get(deserializeMember, requiredMember, this.controller.getMember);
    this.router.route("/user").get(requiredUser, this.controller.get);
  }
}

export default ProfileRouter;
