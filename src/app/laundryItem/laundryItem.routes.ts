import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import { requiredUser } from "../../middlewares/auth.middleware";
import LaundryItemController from "./laundryItem.controller";
import {
  createLaundryItemSchema,
  deleteLaundryItemSchema,
  readByIDLaundryItemSchema,
  updateLaundryItemSchema,
} from "./laundryItem.schema";

@BindAllMethods
class LaundryItemRouter extends BaseRouter<LaundryItemController> {
  constructor(protected express: express.Express) {
    super(LaundryItemController, express);
  }

  protected routes(): void {
    this.router
      .route("/")
      .post(
        requiredUser,
        [validateResource(createLaundryItemSchema)],
        this.controller.post
      );
    this.router
      .route("/:laundryItemId")
      .get(
        requiredUser,
        [validateResource(readByIDLaundryItemSchema)],
        this.controller.getByID
      )
      .put(
        requiredUser,
        [validateResource(updateLaundryItemSchema)],
        this.controller.put
      )
      .delete(
        requiredUser,
        [validateResource(deleteLaundryItemSchema)],
        this.controller.delete
      );
  }
}

export default LaundryItemRouter;
