import { CashFlow, Expenses, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { dateIndoWIB } from "../../configs/date.config";

@BindAllMethods
class ExpensesService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_expenses",
      primaryKey: "expenses_id",
      lengthPKValue: 6,
    };
  }

  public async getAll(
    options?: Prisma.ExpensesFindManyArgs,
  ): Promise<Expenses[] | void> {
    try {
      return await this.prisma.expenses.findMany({ ...options });
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllExpenses");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<Expenses | void | null> {
    try {
      return await this.prisma.expenses.findUnique({
        where: { expensesId: id },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] getExpensesById");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.ExpensesCountArgs): Promise<number | void> {
    try {
      return await this.prisma.expenses.count({ ...args });
    } catch (error) {
      this.logger.error("[EXCEPTION] countExpenses");
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    payload: Partial<Prisma.ExpensesUpdateInput>,
  ): Promise<Expenses | void> {
    try {
      const existing = await this.prisma.expenses.findUnique({
        where: { expensesId: id },
      });
      if (!existing) {
        throw this.error("NOT_FOUND", 404, "Pengeluaran tidak ditemukan");
      }

      const result = await this.prisma.$transaction(async trx => {
        const updatedExpenses = await trx.expenses.update({
          where: { expensesId: id },
          data: payload,
        });

        // Update associated cashflow entry
        const cashflowEntry = await trx.cashFlow.findFirst({
          where: { cashflowInvoice: existing.expensesInvoice },
        });

        if (cashflowEntry) {
          const oldTotal = Number(existing.total);
          const newTotal = Number(payload.total ?? existing.total);
          const totalDiff = newTotal - oldTotal;

          // Recalculate balance: subtract old total, add new total
          // Since OUT entries should subtract from balance:
          // old balance had -oldTotal, now needs -newTotal
          // so balance = balance + oldTotal - newTotal = balance - totalDiff
          const newBalance = Number(cashflowEntry.balance) - totalDiff;

          await trx.cashFlow.update({
            where: { cashflowId: cashflowEntry.cashflowId },
            data: {
              total: newTotal,
              balance: newBalance,
              description: payload.description
                ? `Pengeluaran untuk ${payload.description}`
                : cashflowEntry.description,
            },
          });
        }

        return updatedExpenses;
      });

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] updateExpenses");
      this.throwError(error);
    }
  }

  public async delete(id: string): Promise<Expenses | void> {
    try {
      const existing = await this.prisma.expenses.findUnique({
        where: { expensesId: id },
      });
      if (!existing) {
        throw this.error("NOT_FOUND", 404, "Pengeluaran tidak ditemukan");
      }

      const result = await this.prisma.$transaction(async trx => {
        // Remove associated cashflow entry
        const cashflowEntry = await trx.cashFlow.findFirst({
          where: { cashflowInvoice: existing.expensesInvoice },
        });

        if (cashflowEntry) {
          await trx.cashFlow.delete({
            where: { cashflowId: cashflowEntry.cashflowId },
          });
        }

        const deleted = await trx.expenses.delete({
          where: { expensesId: id },
        });

        return deleted;
      });

      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteExpenses");
      this.throwError(error);
    }
  }

  public async create(
    payload: Omit<Prisma.ExpensesCreateInput, "expensesId" | "user"> & {
      userId: string;
    },
  ): Promise<{ expenses: Expenses; cashflow: CashFlow } | undefined> {
    try {
      const createdExpenses = await this.prisma.$transaction(async trx => {
        const expensesId = await this.createPrimaryKeyValue(trx);
        const expensesInvoice = await this.generateIncField({
          prismaTx: trx,
          tableName: "tb_expenses",
          customPrefix: dateIndoWIB().format("DDMMYY"),
          field: "expenses_invoice",
        });
        const newExpenses = await trx.expenses.create({
          data: {
            userId: payload.userId,
            expensesId: expensesId,
            description: payload.description,
            total: payload.total,
            expensesInvoice: expensesInvoice,
          },
        });

        const countCashflow = await trx.cashFlow.count();
        let sumCashflow = 0;

        if (countCashflow > 0) {
          const argSumExp = await trx.cashFlow.aggregate({
            _sum: { total: true },
          });
          sumCashflow = Number(argSumExp._sum.total);
        }

        const cashflowId = await this.generateIncField({
          prismaTx: trx,
          tableName: "tb_cashflow",
          field: "cashflow_id",
          length: 7,
        });

        const cashflowInvoice = newExpenses.expensesInvoice;

        const createdCashflow = await trx.cashFlow.create({
          data: {
            cashflowId: cashflowId,
            cashflowInvoice: cashflowInvoice,
            description: `Pengeluaran untuk ${payload.description}`,
            cashflowType: "OUT",
            total: payload.total,
            balance: Number(sumCashflow) - Number(payload.total),
          },
        });

        return { cashflow: createdCashflow, expenses: newExpenses };
      });
      return createdExpenses;
    } catch (error: any) {
      this.logger.error("[EXCEPTION] createExpenses");
      this.throwError(error);
    }
  }
}

export default ExpensesService;
