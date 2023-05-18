import { Prisma, Service } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { replacerBigIntToNumber } from "../../utils/utils";

export interface IServiceInput
  extends Omit<Service, "serviceId" | "createdAt" | "updatedAt" | "laundries"> {
  serviceId: string;
}

@BindAllMethods
class LaundryServiceService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_services",
      primaryKey: "service_id",
      lengthPKValue: 7,
    };
  }

  public async getAll(
    options?: Prisma.ServiceFindManyArgs
  ): Promise<Service[] | void> {
    try {
      const data = await this.prisma.service.findMany(options);
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllLaundryServices");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<Service | void | null> {
    try {
      const data = await this.prisma.service.findUnique({
        where: { serviceId: id },
      });
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getLaundryServiceById");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.ServiceCountArgs) {
    try {
      const data = await this.prisma.service.count({ ...args });
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] countLaundryService");
      this.throwError(error);
    }
  }

  public async create(
    input: Omit<IServiceInput, "serviceId">
  ): Promise<Service | void | null> {
    try {
      const serviceId = await this.createPrimaryKeyValue();
      const data: IServiceInput = {
        serviceId,
        name: input.name,
        description: input.description,
        unit: input.unit,
        price: input.price,
      };
      const result = await this.prisma.service.create({ data });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] createLaundryService");
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    data: Omit<IServiceInput, "serviceId">
  ): Promise<Service | undefined> {
    try {
      const result = await this.prisma.service.update({
        where: { serviceId: id },
        data,
      });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] updateLaundryService");
      this.throwError(error);
    }
  }

  public async delete(id: string): Promise<Service | undefined> {
    try {
      const result = await this.prisma.service.delete({
        where: { serviceId: id },
      });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteLaundryService");
      this.throwError(error);
    }
  }
}

export default LaundryServiceService;
