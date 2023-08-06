import express from "express";
import { BaseRouter } from "../../core";
import { requiredUser } from "../../middlewares/auth.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import PaymentController from "./payment.controller";
import validateResource from "../../middlewares/validate.middleware";
import {
  createPaymentSchema,
  readPaymentByInvoiceSchema,
  readPaymentSchema,
} from "./payment.schema";

@BindAllMethods
class PaymentRouter extends BaseRouter<PaymentController> {
  constructor(protected express: express.Express) {
    super(PaymentController, express);
  }

  protected routes(): void {
    this.router
      .route("/all")
      .get(
        requiredUser,
        [validateResource(readPaymentSchema)],
        this.controller.get
      )
      .post(
        requiredUser,
        [validateResource(createPaymentSchema)],
        this.controller.post
      );
    this.router
      .route("/:invoice")
      .get(
        requiredUser,
        [validateResource(readPaymentByInvoiceSchema)],
        this.controller.getByInvoice
      );
  }
}

export default PaymentRouter;
