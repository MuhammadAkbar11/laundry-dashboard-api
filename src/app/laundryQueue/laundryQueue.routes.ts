import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import LaundryQueueController from "./laundryQueue.controller";
import {
  createLaundryQueueSchema,
  deleteLaundryQueueSchema,
  readByIDLaundryQueueSchema,
  readLaundryQueueSchema,
  updateLaundryQueueDeliveredSchema,
  // updateLaundryQueueSchema,
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
      .get(
        requiredUser,
        [validateResource(readLaundryQueueSchema)],
        this.controller.get
      )
      .post(
        requiredUser,
        [validateResource(createLaundryQueueSchema)],
        this.controller.post
      );
    this.router
      .route("/:laundryQueueId")
      .get(
        requiredUser,
        [validateResource(readByIDLaundryQueueSchema)],
        this.controller.getId
      )
      .delete(
        requiredUser,
        [validateResource(deleteLaundryQueueSchema)],
        this.controller.delete
      );

    this.router
      .route("/:laundryQueueId/laundries")
      .get(
        requiredUser,
        [validateResource(readByIDLaundryQueueSchema)],
        this.controller.getLaundryItems
      );
    this.router
      .route("/deliver/:laundryQueueId")
      .put(
        requiredUser,
        [validateResource(updateLaundryQueueDeliveredSchema)],
        this.controller.putDelivered
      );
  }
}

export default LaundryQueueRouter;
