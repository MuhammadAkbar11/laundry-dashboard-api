import { Customer, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { replacerBigIntToNumber } from "../../utils/utils";

export interface ICustomerInput
  extends Omit<
    Customer,
    "customerId" | "createdAt" | "updatedAt" | "customerLevel" | "laundryQueues"
  > {
  customerId: string;
}

@BindAllMethods
class CustomerService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_customers",
      primaryKey: "customer_id",
      lengthPKValue: 8,
    };
  }

  public async getAll(
    options?: Prisma.CustomerFindManyArgs
  ): Promise<Customer[] | void> {
    try {
      const data = await this.prisma.customer.findMany(options);
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllCustomers");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.CustomerCountArgs) {
    try {
      const data = await this.prisma.customer.count({ ...args });
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllCustomers");
      this.throwError(error);
    }
  }

  public async getById(
    id: string,
    options?: Omit<Prisma.CustomerFindUniqueArgs, "where">
  ): Promise<Customer | void | null> {
    try {
      const data = await this.prisma.customer.findUnique({
        ...options,
        where: { customerId: id },
      });
      return replacerBigIntToNumber(data);
    } catch (error) {
      this.logger.error("[EXCEPTION] getCustomerById");
      this.throwError(error);
    }
  }

  public async create(
    input: Omit<ICustomerInput, "customerId">
  ): Promise<Customer | void | null> {
    try {
      const customerId = await this.createPrimaryKeyValue();
      const data: ICustomerInput = {
        customerId,
        name: input.name,
        address: input.address,
        phone: input.phone,
        customerLevelId: input.customerLevelId,
        point: input.point ?? 0,
      };
      const result = await this.prisma.customer.create({ data });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] createCustomer");
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    data: Omit<ICustomerInput, "customerId">
  ): Promise<Customer | undefined> {
    try {
      const result = await this.prisma.customer.update({
        where: { customerId: id },
        data,
      });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] updateCustomer");
      this.throwError(error);
    }
  }

  public async delete(id: string): Promise<Customer | undefined> {
    try {
      const result = await this.prisma.customer.delete({
        where: { customerId: id },
      });
      return replacerBigIntToNumber(result);
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteCustomer");
      this.throwError(error);
    }
  }
}

export default CustomerService;
