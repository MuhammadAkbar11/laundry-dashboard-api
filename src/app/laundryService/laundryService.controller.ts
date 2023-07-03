import { NextFunction, Request, Response } from "express";
import { Service as LaundryService, Prisma, ServiceUnit } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import Pagination from "../../helpers/pagination.helper";
import LaundryServiceService from "./laundryService.service";
import {
  CreateLaundryServicePayload,
  DeleteLaundryServicePayload,
  GetByIdLaundryServicePayload,
  GetLaundryServicePayload,
  UpdateLaundryServicePayload,
} from "./laundryService.schema";
import { isNumericQuery, parsingResult } from "../../utils/utils";
import { SortingTypes } from "../../utils/types/types";

type LaundryServiceSorting =
  SortingTypes<Prisma.ServiceOrderByWithRelationAndSearchRelevanceInput>;

@BindAllMethods
class LaundryServiceController extends BaseController {
  private readonly service = new LaundryServiceService();

  constructor() {
    super();
  }

  private sorting(
    orderBy: string,
    sortBy: Prisma.SortOrder
  ): LaundryServiceSorting {
    let sortingOptions: LaundryServiceSorting = {
      [`${orderBy || "serviceId"}`]: sortBy || "desc",
    };

    if (!orderBy) {
      sortingOptions = [{ serviceId: "desc" }];
    }

    return sortingOptions;
  }

  private searching(
    query: string
  ): Prisma.Enumerable<Prisma.ServiceWhereInput> {
    const ORsearching: Prisma.Enumerable<Prisma.ServiceWhereInput> = [
      { name: { contains: query } },
      { description: { contains: query } },
      { serviceId: { contains: query } },
    ];

    if (isNumericQuery(query)) {
      ORsearching.push({
        price: { equals: +query },
      });
    }

    return ORsearching;
  }

  public async get(
    req: Request<{}, {}, {}, GetLaundryServicePayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const {
        _search,
        _page = 1,
        _limit = 10,
        _orderBy,
        _sortBy,
        _isFiltered,
      } = req.query;

      if (!_isFiltered) {
        const result = await this.service.getAll({
          orderBy: {
            serviceId: "asc",
          },
        });
        return res.status(200).json({
          message: this.getSuccessMessage("read", "Layanan"),
          laundryService: parsingResult(result),
        });
      }

      let where: Prisma.ServiceWhereInput = {};

      const paginated = new Pagination<LaundryService>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "services",
      });

      const { limit, skip } = paginated.getPagination();

      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      if (_search) {
        where = {
          OR: this.searching(_search),
        };
      }

      const services = await this.service.getAll({
        where,
        skip,
        orderBy: sorting,
        take: limit,
      });

      const totalServices = (await this.service.count({ where })) as number;

      const data = paginated.getPagingData(
        totalServices,
        services as LaundryService[]
      );

      res.status(200).json({
        message: this.getSuccessMessage("read", "Laundry Services"),
        data: { search: _search, ...parsingResult(data) },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getById(
    req: Request<GetByIdLaundryServicePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const serviceIdParam = req.params.serviceId as string;

    try {
      const service = await this.service.getById(serviceIdParam);

      if (!service) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Laundry Service",
            serviceIdParam
          )
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage(
          "readById",
          "Laundry Service",
          serviceIdParam
        ),
        service: parsingResult(service),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async post(
    req: Request<{}, {}, CreateLaundryServicePayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { name, description, unit, price } = req.body;

      const newService = await this.service.create({
        name,
        description,
        unit: (unit as ServiceUnit) || "KG",
        price: BigInt(price),
      });

      res.status(201).json({
        message: this.getSuccessMessage("create", "Layanan"),
        service: parsingResult(newService),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<
      UpdateLaundryServicePayload["params"],
      {},
      UpdateLaundryServicePayload["body"]
    >,
    res: Response,
    next: NextFunction
  ) {
    const serviceIdParam = req.params.serviceId as string;

    try {
      const { name, description, unit, price } = req.body;

      const existingService = await this.service.getById(serviceIdParam);

      if (!existingService) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Laundry Service",
            serviceIdParam
          )
        );
      }

      const updatedService = await this.service.update(serviceIdParam, {
        name: name || existingService.name,
        description: description || existingService.description,
        unit: (unit as ServiceUnit) || existingService.unit,
        price: BigInt(price as number) || existingService.price,
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "Layanan", serviceIdParam),
        service: parsingResult(updatedService),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async delete(
    req: Request<DeleteLaundryServicePayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const serviceIdParam = req.params.serviceId as string;

    try {
      const service = await this.service.getById(serviceIdParam);

      if (!service) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage(
            "readByIdNotFound",
            "Laundry Service",
            serviceIdParam
          )
        );
      }

      const deletedService = await this.service.delete(serviceIdParam);

      res.status(200).json({
        message: this.getSuccessMessage("delete", "Layanan", serviceIdParam),
        service: parsingResult(deletedService),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default LaundryServiceController;
