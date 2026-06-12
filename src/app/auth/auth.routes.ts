import express from "express";
import { BaseRouter } from "../../core";
import uploadSingleImage from "../../middlewares/upload.middleware";
import validateResource from "../../middlewares/validate.middleware";
import {
  attachAuthRateLimitContext,
  authRateLimit,
} from "../../middlewares/rateLimit.middleware";
import AuthController from "./auth.controller";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInUserSchema,
  signUpUserSchema,
} from "./auth.schema";
import { BindAllMethods } from "../../utils/decorators.utils";
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class AuthRouter extends BaseRouter<AuthController> {
  constructor(protected express: express.Application) {
    super(AuthController, express);
  }

  protected routes(): void {
    this.router.post(
      "/user/signup",
      uploadSingleImage("/users"),
      [validateResource(signUpUserSchema)],
      this.controller.postSignUpUser
    );
    this.router.post(
      "/user/signin",
      authRateLimit,
      attachAuthRateLimitContext,
      [validateResource(signInUserSchema)],
      this.controller.postSignInUser
    );
    this.router.get("/user/session", requiredUser, this.controller.getSession);
    this.router.post(
      "/user/signout",
      requiredUser,
      this.controller.postSignOutUser
    );
    this.router.post(
      "/user/forgot-password",
      [validateResource(forgotPasswordSchema)],
      this.controller.postForgotPassword
    );
    this.router.post(
      "/user/reset-password",
      [validateResource(resetPasswordSchema)],
      this.controller.postResetPassword
    );
  }
}

export default AuthRouter;
