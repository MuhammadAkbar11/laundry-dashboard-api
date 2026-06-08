import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import { readSettingSchema, updateSettingSchema } from "./setting.schema";
import SettingController from "./setting.controller";
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class SettingRouter extends BaseRouter<SettingController> {
  constructor(protected express: express.Express) {
    super(SettingController, express);
  }

  protected routes(): void {
    this.router
      .route("/all")
      .get(
        requiredUser,
        [validateResource(readSettingSchema)],
        this.controller.get
      )
      .put(
        requiredUser,
        [validateResource(updateSettingSchema)],
        this.controller.put
      );
  }
}

export default SettingRouter;
