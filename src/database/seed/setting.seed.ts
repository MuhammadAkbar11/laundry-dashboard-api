import * as prisma from "@prisma/client";
import _ from "lodash";
import logger from "../../configs/logger.config";
import GenerateAutoIncField from "../../helpers/autoincrement.helper";

const settingsData: Omit<prisma.Setting, "settingId">[] = [
  {
    name: "name",
    description: "Nama Laundry",
    value: "CusCuciin",
    createdAt: new Date("2023-07-10T06:11:31.000Z"),
    updatedAt: new Date("2023-07-10T06:11:31.000Z"),
  },
  {
    name: "alamat",
    description: "Alamat Laundry",
    value: "Indonesia",
    createdAt: new Date("2023-07-10T06:13:39.000Z"),
    updatedAt: new Date("2023-07-10T06:13:39.000Z"),
  },
  {
    name: "kelurahan",
    description: "Kelurahan",
    value: "Indonesia",
    createdAt: new Date("2023-07-18T03:18:20.000Z"),
    updatedAt: new Date("2023-07-18T03:18:20.000Z"),
  },
  {
    name: "kecamatan",
    description: "Kecamatan",
    value: "Indonesia",
    createdAt: new Date("2023-07-18T03:18:20.000Z"),
    updatedAt: new Date("2023-07-18T03:18:20.000Z"),
  },
  {
    name: "kabupaten",
    description: "Kabupaten",
    value: "Indonesia",
    createdAt: new Date("2023-07-18T03:20:57.000Z"),
    updatedAt: new Date("2023-07-18T03:20:57.000Z"),
  },
  {
    name: "provinsi",
    description: "Provinsi",
    value: "Indonesia",
    createdAt: new Date("2023-07-18T03:20:57.000Z"),
    updatedAt: new Date("2023-07-18T03:20:57.000Z"),
  },
  {
    name: "kodepos",
    description: "Kode Pos",
    value: "12345",
    createdAt: new Date("2023-07-18T03:22:53.000Z"),
    updatedAt: new Date("2023-07-18T03:22:53.000Z"),
  },
];

export async function seedInitSettings(
  prismaTx: prisma.Prisma.TransactionClient
) {
  const finalSettingData: prisma.Setting[] = [];

  for (const setting of settingsData) {
    const data = {
      ...setting,
    } as prisma.Setting;

    finalSettingData.push(data);
  }

  try {
    const createdSettings = await prismaTx.setting.createMany({
      data: finalSettingData,
    });
    logger.info(`[SEED][SERVICE] Successfully seeding initial setting data`);
    return createdSettings;
  } catch (error) {
    logger.error(error, "[SEED][SERVICE] Error seeding initial setting data");
    throw error;
  }
}
