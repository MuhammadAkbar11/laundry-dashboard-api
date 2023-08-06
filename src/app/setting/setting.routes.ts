import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import SettingController from "./setting.controller";

@BindAllMethods
class SettingRouter extends BaseRouter<SettingController> {
  constructor(protected express: express.Express) {
    super(SettingController, express);
  }

  protected routes(): void {
    this.router.route("/all").get(this.controller.get);
    // this.router.route("/:settingId").get(this.controller.get);
  }
}

export default SettingRouter;
