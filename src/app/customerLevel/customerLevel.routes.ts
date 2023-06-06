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
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class CustomerLevelRouter extends BaseRouter<CustomerLevelController> {
  constructor(protected express: express.Express) {
    super(CustomerLevelController, express);
  }

  protected routes(): void {
    this.router
      .route("/")
      .get(requiredUser, this.controller.get)
      .post(
        requiredUser,
        [validateResource(createCustomerLevelSchema)],
        this.controller.post
      );
    this.router
      .route("/:customerLevelId")
      .get(
        requiredUser,
        [validateResource(readCustomerLevelSchema)],
        this.controller.getId
      )
      .put(
        requiredUser,
        [validateResource(updateCustomerLevelSchema)],
        this.controller.put
      )
      .delete(
        requiredUser,
        [validateResource(deleteCustomerLevelSchema)],
        this.controller.delete
      );
  }
}

export default CustomerLevelRouter;
