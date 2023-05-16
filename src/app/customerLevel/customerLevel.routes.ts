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
  constructor(protected express: express.Application) {
    super(CustomerLevelController, express);
  }

  protected routes(): void {
    this.router.get("/", this.controller.get);
    this.router.post(
      "/",
      [validateResource(createCustomerLevelSchema)],
      this.controller.post
    );
    this.router.get(
      "/:customerLevelId",
      [validateResource(readCustomerLevelSchema)],
      this.controller.getId
    );
    this.router.put(
      "/:customerLevelId",
      [validateResource(updateCustomerLevelSchema)],
      this.controller.put
    );
    this.router.delete(
      "/:customerLevelId",
      [validateResource(deleteCustomerLevelSchema)],
      this.controller.delete
    );
  }
}

export default CustomerLevelRouter;
