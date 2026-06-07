import express from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseRouter } from "../../core";
import validateResource from "../../middlewares/validate.middleware";
import {
  createExpensesSchema,
  updateExpensesSchema,
  deleteExpensesSchema,
  readExpensesSchema,
  readByIDExpensesSchema,
} from "./expenses.schema";
import ExpensesController from "./expenses.controller";
import { requiredUser } from "../../middlewares/auth.middleware";

@BindAllMethods
class ExpensesRouter extends BaseRouter<ExpensesController> {
  constructor(protected express: express.Express) {
    super(ExpensesController, express);
  }

  protected routes(): void {
    this.router
      .route("/all")
      .get(
        requiredUser,
        [validateResource(readExpensesSchema)],
        this.controller.get
      )
      .post(
        requiredUser,
        [validateResource(createExpensesSchema)],
        this.controller.post
      );

    this.router
      .route("/:expensesId")
      .get(
        requiredUser,
        [validateResource(readByIDExpensesSchema)],
        this.controller.getId
      )
      .put(
        requiredUser,
        [validateResource(updateExpensesSchema)],
        this.controller.put
      )
      .delete(
        requiredUser,
        [validateResource(deleteExpensesSchema)],
        this.controller.delete
      );
  }
}

export default ExpensesRouter;