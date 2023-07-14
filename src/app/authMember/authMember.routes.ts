import express from "express";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import AuthMemberController from "./authMember.controller";
import { signInMemberSchema, signUpMemberSchema } from "./authMember.schema";
import {
  deserializeMember,
  requiredMember,
} from "../../middlewares/authMember.middleware";

@BindAllMethods
class AuthMemberRouter extends BaseRouter<AuthMemberController> {
  constructor(protected express: express.Application) {
    super(AuthMemberController, express);
  }

  protected routes(): void {
    this.router.post(
      "/member/signup",
      [validateResource(signUpMemberSchema)],
      this.controller.postSignUpMember
    );
    this.router.post(
      "/member/signin",
      [validateResource(signInMemberSchema)],
      this.controller.postSignInUser
    );
    this.router.get(
      "/member/session",
      deserializeMember,
      requiredMember,
      this.controller.getSession
    );
    this.router.post(
      "/member/signout",
      deserializeMember,
      requiredMember,
      this.controller.postSignOutMember
    );
  }
}

export default AuthMemberRouter;
