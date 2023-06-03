import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import LaundryQueueController from "./laundryQueue.controller";
import {
  createLaundryQueueSchema,
  deleteLaundryQueueSchema,
  readByIDLaundryQueueSchema,
  updateLaundryQueueSchema,
} from "./laundryQueue.schema";
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class LaundryQueueRouter extends BaseRouter<LaundryQueueController> {
  constructor(protected express: express.Express) {
    super(LaundryQueueController, express);
  }

  protected routes(): void {
    this.router
      .route("/")
      .get(this.controller.get)
      .post(
        requiredUser,
        [validateResource(createLaundryQueueSchema)],
        this.controller.post
      );

    this.router
      .route("/:laundryQueueId")
      .get(
        [validateResource(readByIDLaundryQueueSchema)],
        this.controller.getId
      )
      .put([validateResource(updateLaundryQueueSchema)], this.controller.put)
      .delete(
        [validateResource(deleteLaundryQueueSchema)],
        this.controller.delete
      );
  }
}

export default LaundryQueueRouter;
