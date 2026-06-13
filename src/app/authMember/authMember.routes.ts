import express from "express";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import {
  attachAuthRateLimitContext,
  authRateLimit,
} from "../../middlewares/rateLimit.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import AuthMemberController from "./authMember.controller";
import {
  forgotMemberPasswordSchema,
  resetMemberPasswordSchema,
  resendVerificationSchema,
  signInMemberSchema,
  signUpMemberSchema,
  verifyEmailSchema,
} from "./authMember.schema";
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
      this.controller.postSignUpMember,
    );
    this.router.post(
      "/member/signin",
      authRateLimit,
      // attachAuthRateLimitContext,
      [validateResource(signInMemberSchema)],
      this.controller.postSignInUser,
    );
    this.router.get(
      "/member/session",
      deserializeMember,
      requiredMember,
      this.controller.getSession,
    );
    this.router.post(
      "/member/signout",
      deserializeMember,
      requiredMember,
      this.controller.postSignOutMember,
    );
    this.router.post(
      "/member/forgot-password",
      [validateResource(forgotMemberPasswordSchema)],
      this.controller.postForgotMemberPassword,
    );
    this.router.post(
      "/member/reset-password",
      [validateResource(resetMemberPasswordSchema)],
      this.controller.postResetMemberPassword,
    );
    this.router.post(
      "/member/verify-email",
      [validateResource(verifyEmailSchema)],
      this.controller.postVerifyEmail,
    );
    this.router.post(
      "/member/resend-verification",
      [validateResource(resendVerificationSchema)],
      this.controller.postResendVerification,
    );
  }
}

export default AuthMemberRouter;
