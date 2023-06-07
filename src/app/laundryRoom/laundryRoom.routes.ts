import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import LaundryRoomController from "./laundryRoom.controller";
import {
  readByIDLaundryRoomSchema,
  updateLaundryRoomFinishedSchema,
} from "./laundryRoom.schema";
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class LaundryRoomRouter extends BaseRouter<LaundryRoomController> {
  constructor(protected express: express.Express) {
    super(LaundryRoomController, express);
  }

  protected routes(): void {
    this.router.route("/").get(requiredUser, this.controller.get);
    this.router
      .route("/:laundryRoomId")
      .get(
        requiredUser,
        [validateResource(readByIDLaundryRoomSchema)],
        this.controller.getByID
      );
    this.router
      .route("/finished/:laundryRoomId")
      .put(
        requiredUser,
        [validateResource(updateLaundryRoomFinishedSchema)],
        this.controller.putStatusFinished
      );
  }
}

export default LaundryRoomRouter;
