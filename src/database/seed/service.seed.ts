import * as prisma from "@prisma/client";
import _ from "lodash";
import logger from "../../configs/logger.config";
import GenerateAutoIncField from "../../helpers/autoincrement.helper";

const servicesData: Omit<prisma.Service, "serviceId">[] = [
  {
    name: "Cuci Komplet Reguler (2-3 hari",
    description: "Cuci Komplet Reguler (2-3 hari",
    unit: "KG",
    price: BigInt(8000),
    createdAt: new Date("2023-06-08 08:27:11.408"),
    updatedAt: new Date("2023-06-08 08:27:11.408"),
  },
  {
    name: "Setrika Reguler (2-3 hari)",
    description: "Setrika Reguler (2-3 hari)",
    unit: "KG",
    price: BigInt(6000),
    createdAt: new Date("2023-06-08 08:27:11.408"),
    updatedAt: new Date("2023-06-08 08:27:11.408"),
  },
  {
    name: "Cuci Komplet Kilat",
    description: "Cuci Komplet Kilat 1 hari",
    unit: "KG",
    price: BigInt(12000),
    createdAt: new Date("2023-06-08 08:27:11.408"),
    updatedAt: new Date("2023-06-08 08:27:11.408"),
  },
  {
    name: "Bed Cover",
    description: "Bed Cover Reguler",
    unit: "PTNG",
    price: BigInt(18000),
    createdAt: new Date("2023-06-30 18:48:54.913"),
    updatedAt: new Date("2023-07-01 18:22:19.795"),
  },
  {
    name: "Seprei",
    description: "Seprei Reguler (2-3 Hari)",
    unit: "PTNG",
    price: BigInt(10000),
    createdAt: new Date("2023-06-30 18:53:28.728"),
    updatedAt: new Date("2023-07-01 18:25:55.966"),
  },
  {
    name: "Jas",
    description: "Jas Reguler (2-3 Hari)",
    unit: "PTNG",
    price: BigInt(15500),
    createdAt: new Date("2023-07-01 18:25:55.966"),
    updatedAt: new Date("2023-07-01 18:28:21.285"),
  },
];

export async function seedInitServices(
  prismaTx: prisma.Prisma.TransactionClient
) {
  const finalServiceData: prisma.Service[] = [];

  for (const service of servicesData) {
    const serviceId = await GenerateAutoIncField({
      prismaTx: prismaTx,
      tableName: "tb_services",
      field: "service_id",
      length: 6,
    });

    const data = {
      ...service,
      serviceId,
    } as prisma.Service;

    finalServiceData.push(data);
  }

  try {
    const createdServices = await prismaTx.service.createMany({
      data: finalServiceData,
    });
    logger.info(`[SEED][SERVICE] Successfully seeding initial service data`);
    return createdServices;
  } catch (error) {
    logger.error(error, "[SEED][SERVICE] Error seeding initial service data");
    throw error;
  }
}
