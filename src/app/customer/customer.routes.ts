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

@BindAllMethods
class CustomerRouter extends BaseRouter<CustomerController> {
  constructor(protected express: express.Express) {
    super(CustomerController, express);
  }

  protected routes(): void {
    this.router
      .route("/all")
      .get([validateResource(readCustomerSchema)], this.controller.get)
      .post([validateResource(createCustomerSchema)], this.controller.post);

    this.router
      .route("/:customerId")
      .get([validateResource(readOneCustomerSchema)], this.controller.getId)
      .put([validateResource(updateCustomerSchema)], this.controller.put)
      .delete([validateResource(deleteCustomerSchema)], this.controller.delete);
  }
}

export default CustomerRouter;
