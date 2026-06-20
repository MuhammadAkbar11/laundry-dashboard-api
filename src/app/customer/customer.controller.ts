import { NextFunction, Request, Response } from "express";
import { Customer, Prisma } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import {
  CreateCustomerPayload,
  DeleteCustomerPayload,
  ReadCustomerPayload,
  ReadOneCustomerPayload,
  UpdateCustomerPayload,
} from "./customer.schema";
import CustomerService from "./customer.service";
import Pagination from "../../helpers/pagination.helper";
import { parsingResult } from "../../utils/utils";
import { sanitizeText } from "../../utils/sanitizer.utils";

@BindAllMethods
class CustomerController extends BaseController {
  private readonly service = new CustomerService();

  constructor() {
    super();
  }

  private sorting(
    orderBy: string,
    sortBy: Prisma.SortOrder,
  ): Prisma.CustomerOrderByWithRelationAndSearchRelevanceInput {
    let sortingOptions: Prisma.CustomerOrderByWithRelationAndSearchRelevanceInput =
      {
        [`${orderBy || "customerId"}`]: sortBy || "desc",
      };

    if (orderBy?.includes("countLaundryQueue")) {
      sortingOptions = {
        laundryQueues: {
          _count: sortBy?.toLocaleLowerCase() as Prisma.SortOrder,
        },
      };
    } else if (orderBy?.includes("customerLevel")) {
      sortingOptions = {
        customerLevel: {
          name: sortBy as Prisma.SortOrder,
        },
      };
    }

    return sortingOptions;
  }

  public async get(
    req: Request<{}, {}, {}, ReadCustomerPayload["query"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let where: Prisma.CustomerWhereInput = {};

      const paginated = new Pagination<Customer>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "customers",
      });

      const { limit, skip } = paginated.getPagination();
      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder,
      );

      if (_search) {
        where = {
          OR: [
            { customerId: { contains: _search } },
            { name: { contains: _search } },
            { address: { contains: _search } },
            { phone: { contains: _search } },
            {
              customerLevel: {
                name: { contains: _search },
              },
            },
          ],
        };
      }

      const customers = (await this.service.getAll({
        where,
        skip,
        orderBy: sorting,
        take: limit,
        include: {
          customerLevel: true,
          _count: {
            select: { laundryQueues: true },
          },
        },
      })) as Customer[];

      const totalCustomers = (await this.service.count({ where })) as number;

      const data = paginated.getPagingData(
        totalCustomers,
        parsingResult(customers),
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Pelanggan"),
        data: { search: _search, ...data },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getId(
    req: Request<ReadOneCustomerPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const customerIdParam = req.params.customerId as string;

    try {
      const customer = await this.service.getById(customerIdParam, {
        include: { customerLevel: true, laundryQueues: true },
      });

      if (!customer) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Pelanggan",
            customerIdParam,
          ),
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Pelanggan",
          customerIdParam,
        ),
        customer: parsingResult(customer),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async post(
    req: Request<{}, {}, CreateCustomerPayload["body"]>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { name, address, phone, customerLevelId, point } = req.body;

      const newCustomer = await this.service.create({
        name: sanitizeText(name),
        address: sanitizeText(address),
        phone: sanitizeText(phone),
        customerLevelId,
        point,
      });

      res.status(201).json({
        message: this.getSuccessMessage("create", "Pelanggan"),
        customer: parsingResult(newCustomer),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<
      UpdateCustomerPayload["params"],
      {},
      UpdateCustomerPayload["body"]
    >,
    res: Response,
    next: NextFunction,
  ) {
    const customerIdParam = req.params.customerId as string;

    try {
      const { name, address, phone, customerLevelId, point } = req.body;

      const existingCustomer = await this.service.getById(customerIdParam);

      if (!existingCustomer) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Pelanggan",
            customerIdParam,
          ),
        );
      }

      const updatedCustomer = await this.service.update(customerIdParam, {
        name: sanitizeText(name) || existingCustomer.name,
        address: sanitizeText(address) || existingCustomer.address,
        phone: sanitizeText(phone) || existingCustomer.phone,
        customerLevelId: customerLevelId || existingCustomer.customerLevelId,
        point: point || existingCustomer.point,
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "Pelanggan", customerIdParam),
        customer: parsingResult(updatedCustomer),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async delete(
    req: Request<DeleteCustomerPayload["params"]>,
    res: Response,
    next: NextFunction,
  ) {
    const customerIdParam = req.params.customerId as string;

    try {
      const customer = await this.service.getById(customerIdParam, {
        include: { customerLevel: true, laundryQueues: true },
      });

      if (!customer) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Pelanggan",
            customerIdParam,
          ),
        );
      }

      const deletedCustomer = await this.service.delete(customerIdParam);

      res.status(200).json({
        message: this.getSuccessMessage("delete", "Pelanggan", customerIdParam),
        customer: parsingResult(deletedCustomer),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default CustomerController;
