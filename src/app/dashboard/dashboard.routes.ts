import express from "express";
import { BaseRouter } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { requiredUser } from "../../middlewares/auth.middleware";
import {
  deserializeMember,
  requiredMember,
} from "../../middlewares/authMember.middleware";
import DashboardController from "./dashboard.controller";

@BindAllMethods
class DashboardRouter extends BaseRouter<DashboardController> {
  constructor(protected express: express.Application) {
    super(DashboardController, express);
  }

  protected routes(): void {
    this.router.get("/admin", requiredUser, this.controller.getAdminDashboard);
    this.router.get(
      "/member",
      deserializeMember,
      requiredMember,
      this.controller.getMemberDashboard
    );
  }
}

export default DashboardRouter;
