import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import LaundryServiceController from "./laundryService.controller";
import {
  createLaundryServiceSchema,
  deleteLaundryServiceSchema,
  getByIdLaundryServiceSchema,
  getLaundryServiceSchema,
  updateLaundryServiceSchema,
} from "./laundryService.schema";
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class LaundryServiceRouter extends BaseRouter<LaundryServiceController> {
  constructor(protected express: express.Express) {
    super(LaundryServiceController, express);
  }

  protected routes(): void {
    this.router
      .route("/")
      .get(
        requiredUser,
        [validateResource(getLaundryServiceSchema)],
        this.controller.get
      )
      .post(
        // requiredUser,
        [validateResource(createLaundryServiceSchema)],
        this.controller.post
      );

    this.router
      .route("/:serviceId")
      .get(
        requiredUser,
        [validateResource(getByIdLaundryServiceSchema)],
        this.controller.getById
      )
      .put(
        requiredUser,
        [validateResource(updateLaundryServiceSchema)],
        this.controller.put
      )
      .delete(
        requiredUser,
        [validateResource(deleteLaundryServiceSchema)],
        this.controller.delete
      );
  }
}

export default LaundryServiceRouter;
