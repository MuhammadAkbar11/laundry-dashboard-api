import { faker } from "@faker-js/faker";
import * as prisma from "@prisma/client";

import logger from "../../configs/logger.config";
import GenerateAutoIncField from "../../helpers/autoincrement.helper";

interface SeedGeneratedCustomerOptions {
  numResult: number;
  prismaTx: prisma.Prisma.TransactionClient;
}

export async function seedGeneratedCustomer({
  numResult,
  prismaTx,
}: SeedGeneratedCustomerOptions): Promise<void> {
  try {
    const customerLevels = await prismaTx.customerLevel.findMany();
    const customerLevelsCount = customerLevels.length;

    for (let i = 0; i < numResult; i++) {
      const randomCustomerLevelIndex = Math.floor(
        Math.random() * customerLevelsCount
      );
      const randomCustomerLevel = customerLevels[randomCustomerLevelIndex];
      const customerId = await GenerateAutoIncField({
        prismaTx: prismaTx,
        tableName: "tb_customers",
        field: "customer_id",
        length: 8,
      });
      const newCustomer = {
        customerId: customerId,
        name: faker.person.fullName(),
        address: faker.location.streetAddress(),
        phone: faker.phone.number("+628 #### #### ##"),
        customerLevelId: randomCustomerLevel.customerLevelId,
        // point: faker.number.int({ min: 0, max: 10 }),
        point: faker.helpers.arrayElement([0, 5, 10, 20]),
      };

      await prismaTx.customer.create({
        data: newCustomer,
      });
    }

    logger.info(
      `[SEED][CUSTOMER] Successfully generated ${numResult} customer data.`
    );
  } catch (error) {
    logger.error(
      error,
      "[SEED][CUSTOMER] Error seeding generated customer data"
    );
    throw error;
  }
}
