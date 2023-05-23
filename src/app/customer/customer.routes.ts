import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import {
  createCustomerSchema,
  deleteCustomerSchema,
  readCustomerSchema,
  readOneCustomerSchema,
  updateCustomerSchema,
} from "./customer.schema";
import CustomerController from "./customer.controller";
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class CustomerRouter extends BaseRouter<CustomerController> {
  constructor(protected express: express.Express) {
    super(CustomerController, express);
  }

  protected routes(): void {
    this.router
      .route("/all")
      .get(
        requiredUser,
        [validateResource(readCustomerSchema)],
        this.controller.get
      )
      .post(
        requiredUser,
        [validateResource(createCustomerSchema)],
        this.controller.post
      );

    this.router
      .route("/:customerId")
      .get(
        requiredUser,
        [validateResource(readOneCustomerSchema)],
        this.controller.getId
      )
      .put(
        requiredUser,
        [validateResource(updateCustomerSchema)],
        this.controller.put
      )
      .delete(
        requiredUser,
        [validateResource(deleteCustomerSchema)],
        this.controller.delete
      );
  }
}

export default CustomerRouter;
