import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import LaundryServiceController from "./laundryService.controller";
import {
  createLaundryServiceSchema,
  deleteLaundryServiceSchema,
  getByIdLaundryServiceSchema,
  updateLaundryServiceSchema,
} from "./laundryService.schema";

@BindAllMethods
class LaundryServiceRouter extends BaseRouter<LaundryServiceController> {
  constructor(protected express: express.Express) {
    super(LaundryServiceController, express);
  }

  protected routes(): void {
    this.router
      .route("/")
      .get(this.controller.get)
      .post(
        [validateResource(createLaundryServiceSchema)],
        this.controller.post
      );

    this.router
      .route("/:serviceId")
      .get(
        [validateResource(getByIdLaundryServiceSchema)],
        this.controller.getById
      )
      .put([validateResource(updateLaundryServiceSchema)], this.controller.put)
      .delete(
        [validateResource(deleteLaundryServiceSchema)],
        this.controller.delete
      );
  }
}

export default LaundryServiceRouter;
