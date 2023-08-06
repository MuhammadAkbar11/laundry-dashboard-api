import * as prisma from "@prisma/client";
import { IncTablesFieldTypes, IncTablesNameTypes } from "./types";

export interface ISession extends Omit<prisma.User, "password"> {
  session: string;
  iat: number;
  exp: number;
}

export interface IMemberSession extends Omit<prisma.Member, "password"> {
  session: string;
  iat: number;
  exp: number;
}

export interface IJwtPayload<T> {
  valid: boolean;
  expired: boolean;
  decoded: T | null;
}

export interface ErrorData {
  isOperational?: boolean;
  [key: string]: any;
}

export interface IResponseError {
  name: string;
  status: number;
  message: string;
  serverLogErrors?: Record<string, any>;
}

export interface IFileImg {
  type: string;
  message: string;
  data: (Express.Multer.File & { folderPath: string }) | null;
}

export interface IGenerateAutoIncFieldHelper {
  prismaTx?: prisma.Prisma.TransactionClient;
  tableName: IncTablesNameTypes;
  field: IncTablesFieldTypes;
  length?: number;
  customPrefix?: string;
}
