import * as prisma from "@prisma/client";
import logger from "../../configs/logger.config";

const customerLevelsData: Omit<prisma.CustomerLevel, "userId">[] = [
  {
    customerLevelId: "CSLVL001",
    name: "Basic",
    point: BigInt(5),
    discount: 0,
    createdAt: new Date("2023-05-15 06:50:00.488"),
    updatedAt: new Date("2023-05-15 06:50:00.488"),
  },
  {
    customerLevelId: "CSLVL002",
    name: "Gold",
    point: BigInt(10),
    discount: 5,
    createdAt: new Date("2023-05-15 06:50:00.488"),
    updatedAt: new Date("2023-05-15 06:50:00.488"),
  },
  {
    customerLevelId: "CSLVL003",
    name: "Platinum",
    point: BigInt(15),
    discount: 10,
    createdAt: new Date("2023-05-15 06:50:00.488"),
    updatedAt: new Date("2023-05-15 06:50:00.488"),
  },
];

export async function seedInitCustomerLevels(
  prismaTx: prisma.Prisma.TransactionClient
) {
  try {
    const createdData = await prismaTx.customerLevel.createMany({
      data: customerLevelsData,
    });
    logger.info(
      `[SEED][CUSTOMER LVL] Successfully seeding initial customer-level data`
    );
    return createdData;
  } catch (error) {
    logger.error(
      error,
      "[SEED][CUSTOMER LVL] Error seeding initial customer-level data"
    );
    throw error;
  }
}
