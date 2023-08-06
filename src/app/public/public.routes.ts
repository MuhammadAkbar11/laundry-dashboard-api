import express from "express";

import { BindAllMethods } from "../../utils/decorators.utils";
import PublicController from "./public.controller";
import { BaseRouter } from "../../core";

@BindAllMethods
class PublicRouter extends BaseRouter<PublicController> {
  constructor(protected express: express.Express) {
    super(PublicController, express);
  }

  protected routes(): void {
    this.router.route("/service").get(this.controller.getServices);
    this.router.route("/level/customer").get(this.controller.getCustomerLevel);
    this.router
      .route("/level/customer/customerLevelId")
      .get(this.controller.getCustomerLevelById);
  }
}

export default PublicRouter;
