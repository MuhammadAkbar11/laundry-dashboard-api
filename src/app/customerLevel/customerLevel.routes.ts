import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import CustomerLevelController from "./customerLevel.controller";
import validateResource from "../../middlewares/validate.middleware";
import {
  createCustomerLevelSchema,
  deleteCustomerLevelSchema,
  readCustomerLevelSchema,
  updateCustomerLevelSchema,
} from "./customerLevel.schema";

@BindAllMethods
class CustomerLevelRouter extends BaseRouter<CustomerLevelController> {
  constructor(protected express: express.Express) {
    super(CustomerLevelController, express);
  }

  protected routes(): void {
    this.router
      .route("/")
      .get(this.controller.get)
      .post(
        [validateResource(createCustomerLevelSchema)],
        this.controller.post
      );
    this.router
      .route("/:customerLevelId")
      .get([validateResource(readCustomerLevelSchema)], this.controller.getId)
      .put([validateResource(updateCustomerLevelSchema)], this.controller.put)
      .delete(
        [validateResource(deleteCustomerLevelSchema)],
        this.controller.delete
      );
  }
}

export default CustomerLevelRouter;
