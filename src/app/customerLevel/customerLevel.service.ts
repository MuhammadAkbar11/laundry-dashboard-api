import { CustomerLevel, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { replacerBigIntToNumber } from "../../utils/utils";

export interface ICustomerLevelInput
  extends Omit<
    CustomerLevel,
    "customerLevelId" | "createdAt" | "updatedAt" | "customers"
  > {
  customerLevelId: string;
}

@BindAllMethods
class CustomerLevelService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_customer_levels",
      primaryKey: "cs_level_id",
      lengthPKValue: 8,
    };
  }

  public async getAll(): Promise<CustomerLevel[] | void> {
    try {
      const data = await this.prisma.customerLevel.findMany({});

      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error(`[EXCEPTION] getAllCustomerLevels`);
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<CustomerLevel | void | null> {
    try {
      const data = await this.prisma.customerLevel.findUnique({
        where: { customerLevelId: id },
      });

      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error(`[EXCEPTION] getCustomerLevelById`);
      this.throwError(error);
    }
  }

  public async create(
    input: Omit<ICustomerLevelInput, "customerLevelId">
  ): Promise<CustomerLevel | void | null> {
    try {
      const customerLevelId = await this.createPrimaryKeyValue();
      const data: ICustomerLevelInput = {
        customerLevelId: customerLevelId,
        name: input.name,
        discount: +input.discount,
        point: input.point as bigint,
      };

      const result = await this.prisma.customerLevel.create({ data });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error(`[EXCEPTION] createCustomerLevel`);
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    data: Omit<ICustomerLevelInput, "customerLevelId">
  ): Promise<CustomerLevel | undefined> {
    try {
      const result = await this.prisma.customerLevel.update({
        where: { customerLevelId: id },
        data,
      });

      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error(`[EXCEPTION] updateCustomerLevel`);
      this.throwError(error);
    }
  }

  public async delete(id: string): Promise<CustomerLevel | undefined> {
    try {
      const result = await this.prisma.customerLevel.delete({
        where: { customerLevelId: id },
      });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error(`[EXCEPTION] deleteCustomerLevel`);
      this.throwError(error);
    }
  }
}

export default CustomerLevelService;
