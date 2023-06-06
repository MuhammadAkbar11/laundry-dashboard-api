import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";
import BaseError from "../helpers/error.helper";
import { fromZodError } from "zod-validation-error";
import logger from "../configs/logger.config";

const validateResource =
  (schema: AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (e: any) {
      const validationError = fromZodError(e, { prefix: "validation" });
      const error = new BaseError(
        "VALIDATION_ERR",
        422,
        validationError?.message,
        {
          isOperational: true,
          validation: validationError.details,
        }
      );
      logger.error(
        validationError?.details,
        `[${validationError?.name?.toUpperCase()}] ${validationError?.message}`
      );
      return next(BaseError.transformError(error));
    }
  };

export default validateResource;
