import { NextFunction, Request, Response } from "express";
import { Customer, Prisma, PrismaClient } from "@prisma/client";
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

const prisma = new PrismaClient();

@BindAllMethods
class CustomerController extends BaseController {
  private readonly service = new CustomerService();

  constructor() {
    super();
  }

  public async get(
    req: Request<{}, {}, {}, ReadCustomerPayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search, _page = 1, _limit = 10 } = req.query;

      let where: Prisma.CustomerWhereInput = {};

      const paginated = new Pagination<Customer>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "customers",
      });

      const { limit, skip } = paginated.getPagination();

      if (_search) {
        // where = {
        //   name: { search: _search },
        //   address: { search: _search },
        //   phone: { search: `"${_search}"` },
        // };
        where = {
          OR: [
            { name: { contains: _search } },
            { address: { contains: _search } },
            { phone: { contains: _search } },
          ],
        };
      }

      const customers = (await this.service.getAll({
        where,
        skip,
        orderBy: {
          createdAt: "asc",
        },
        take: limit,
      })) as Customer[];

      const totalCustomers = await this.service.count({ where });

      const data = paginated.getPagingData(totalCustomers, customers);

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
    next: NextFunction
  ) {
    const customerIdParam = req.params.customerId as string;
    console.log("TEST getId()");

    try {
      const customer = await this.service.getById(customerIdParam, {
        include: { customerLevel: true, laundryQueues: true },
      });

      if (!customer) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Pelanggan", customerIdParam)
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Pelanggan",
          customerIdParam
        ),
        customer,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async post(
    req: Request<{}, {}, CreateCustomerPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { name, address, phone, customerLevelId, point } = req.body;

      const newCustomer = await this.service.create({
        name,
        address,
        phone,
        customerLevelId,
        point,
      });

      res.status(201).json({
        message: this.getSuccessMessage("create", "Pelanggan"),
        customer: newCustomer,
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
    next: NextFunction
  ) {
    const customerIdParam = req.params.customerId as string;

    try {
      const { name, address, phone, customerLevelId, point } = req.body;

      const existingCustomer = await prisma.customer.findUnique({
        where: {
          customerId: customerIdParam,
        },
      });

      if (!existingCustomer) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "Pelanggan", customerIdParam)
        );
      }

      const updatedCustomer = await this.service.update(customerIdParam, {
        name: name || existingCustomer.name,
        address: address || existingCustomer.address,
        phone: phone || existingCustomer.phone,
        customerLevelId: customerLevelId || existingCustomer.customerLevelId,
        point: point || existingCustomer.point,
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "Pelanggan", customerIdParam),
        customer: updatedCustomer,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async delete(
    req: Request<DeleteCustomerPayload["params"]>,
    res: Response,
    next: NextFunction
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
          this.getErrorMessage("readByIdNotFound", "Pelanggan", customerIdParam)
        );
      }

      const deletedCustomer = await this.service.delete(customerIdParam);

      res.status(200).json({
        message: this.getSuccessMessage("delete", "Pelanggan", customerIdParam),
        customer: deletedCustomer,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default CustomerController;
