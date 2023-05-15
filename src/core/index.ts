import { Application, Router, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { ErrorData } from "../utils/types/interfaces";
import { HTTP_STATUS_CODE } from "../configs/vars.config";
import BaseError from "../helpers/error.helper";
import { getErrorSnippets } from "../utils/utils";
import loggerConfig from "../configs/logger.config";
import prisma from "../configs/prisma.config";
import GenerateAutoIncField from "../helpers/autoincrement.helper";

export abstract class BaseRouter<T> {
  protected readonly router: Router;
  protected readonly controller: T;

  constructor(
    protected Controller: new () => T,
    private readonly app: Application
  ) {
    if (typeof Controller !== "function") {
      throw new Error("Controller must be a constructor function");
    }
    this.router = Router();
    this.controller = new Controller();
    this.routes();
    this.app.use("/", this.router);
  }

  protected abstract routes(): void;

  public getRouter(): Router {
    return this.router;
  }
}

// BaseController
export abstract class BaseController {
  protected readonly prisma: PrismaClient;
  protected readonly methodStatus = HTTP_STATUS_CODE;
  protected readonly logger = loggerConfig;
  protected readonly generateIncField = GenerateAutoIncField;

  constructor() {
    this.prisma = prisma;
  }

  protected error(
    name: string | null,
    statusCode: number,
    message: string,
    errors: ErrorData = {
      isOperational: true,
    }
  ) {
    return new BaseError(name, statusCode, message, errors);
  }

  protected nextError(next: NextFunction, error: any) {
    next(BaseError.transformError(error));
  }
}

export class BaseService {
  protected readonly prisma: PrismaClient;
  protected readonly methodStatus = HTTP_STATUS_CODE;
  protected readonly logger = loggerConfig;
  protected readonly generateIncField = GenerateAutoIncField;

  // protected table!: string;
  protected table!: { name: string; primaryKey: string; lengthPKValue: number };
  constructor() {
    this.prisma = prisma;
  }

  protected async createPrimaryKeyValue(): Promise<string> {
    try {
      if (this.table === undefined) {
        throw this.error(
          "ERR_SERVICE",
          500,
          "Failed to create a primary key value because the 'table' property has not been initialised. please add the uninitialised 'table' property to the constructor.",
          {
            isOperational: false,
          }
        );
      }

      const result = await this.generateIncField({
        tableName: this.table?.name,
        field: this.table?.primaryKey,
        length: this.table?.lengthPKValue,
      });
      return result as string;
    } catch (error: any) {
      error.errors.isOperational = false;
      throw this.throwError(error);
    }
  }

  protected error(
    name: string | null,
    statusCode: number,
    message: string,
    errors: ErrorData = {
      isOperational: true,
    }
  ) {
    return new BaseError(name, statusCode, message, errors);
  }

  protected throwError(error: any) {
    const name = error?.name || "EXCEPTION";
    const statusCode = error?.statusCode || this.methodStatus.INTERNAL_SERVER;
    const msg = error?.message || "Something went wrong on Service";
    throw this.error(name, statusCode, msg, {
      isOperational: error?.isOperational || false,
      stackTrace: getErrorSnippets(error),
    });
  }
}
