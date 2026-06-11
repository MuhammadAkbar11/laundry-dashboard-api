import { NextFunction, Request, Response } from "express";
import { Expenses, Prisma } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import {
  CreateExpensesPayload,
  UpdateExpensesPayload,
  DeleteExpensesPayload,
  ReadExpensesPayload,
  ReadByIDExpensesPayload,
} from "./expenses.schema";
import ExpensesService from "./expenses.service";
import Pagination from "../../helpers/pagination.helper";
import { parsingResult } from "../../utils/utils";
import { sanitizeMultilineText } from "../../utils/sanitizer.utils";

@BindAllMethods
class ExpensesController extends BaseController {
  private readonly service = new ExpensesService();

  constructor() {
    super();
  }

  private sorting(
    orderBy: string,
    sortBy: Prisma.SortOrder,
  ): Prisma.ExpensesOrderByWithRelationAndSearchRelevanceInput {
    const sortingOptions: Prisma.ExpensesOrderByWithRelationAndSearchRelevanceInput =
      {
        [`${orderBy || "createdAt"}`]: sortBy || "desc",
      };

    return sortingOptions;
  }

  public async get(
    req: Request<{}, {}, {}, ReadExpensesPayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let where: Prisma.ExpensesWhereInput = {};

      const paginated = new Pagination<Expenses>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "expenses",
      });

      const { limit, skip } = paginated.getPagination();
      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder,
      );

      if (_search) {
        where = {
          OR: [
            { expensesId: { contains: _search } },
            { expensesInvoice: { contains: _search } },
            { description: { contains: _search } },
          ],
        };
      }

      const expenses = (await this.service.getAll({
        where,
        skip,
        orderBy: sorting,
        take: limit,
        include: {
          user: {
            select: {
              userId: true,
              name: true,
              email: true,
            },
          },
        },
      })) as Expenses[];

      const totalExpenses = (await this.service.count({ where })) as number;

      const data = paginated.getPagingData(
        totalExpenses,
        parsingResult(expenses),
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Pengeluaran"),
        data: { search: _search, ...data },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getId(
    req: Request<ReadByIDExpensesPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const expensesIdParam = req.params.expensesId as string;

    try {
      const expenses = await this.service.getById(expensesIdParam);

      if (!expenses) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Pengeluaran",
            expensesIdParam,
          ),
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Pengeluaran",
          expensesIdParam,
        ),
        expenses: parsingResult(expenses),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async post(
    req: Request<{}, {}, CreateExpensesPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { description, total } = req.body;
      const userId = (req as any).user?.userId as string;

      const result = await this.service.create({
        description: sanitizeMultilineText(description),
        total,
        userId,
        expensesInvoice: "",
      });

      res.status(201).json({
        message: this.getSuccessMessage("create", "Pengeluaran"),
        expenses: parsingResult(result?.expenses),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<
      UpdateExpensesPayload["params"],
      {},
      UpdateExpensesPayload["body"]
    >,
    res: Response,
    next: NextFunction,
  ) {
    const expensesIdParam = req.params.expensesId as string;

    try {
      const { description, total } = req.body;

      const existing = await this.service.getById(expensesIdParam);

      if (!existing) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Pengeluaran",
            expensesIdParam,
          ),
        );
      }

      const updated = await this.service.update(expensesIdParam, {
        description: description
          ? sanitizeMultilineText(description)
          : existing.description,
        total: total || existing.total,
      });

      res.status(200).json({
        message: this.getSuccessMessage(
          "update",
          "Pengeluaran",
          expensesIdParam,
        ),
        expenses: parsingResult(updated),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async delete(
    req: Request<DeleteExpensesPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const expensesIdParam = req.params.expensesId as string;

    try {
      const existing = await this.service.getById(expensesIdParam);

      if (!existing) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Pengeluaran",
            expensesIdParam,
          ),
        );
      }

      const deleted = await this.service.delete(expensesIdParam);

      res.status(200).json({
        message: this.getSuccessMessage(
          "delete",
          "Pengeluaran",
          expensesIdParam,
        ),
        expenses: parsingResult(deleted),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default ExpensesController;
