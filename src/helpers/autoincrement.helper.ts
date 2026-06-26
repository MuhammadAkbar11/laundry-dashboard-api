import logger from "../configs/logger.config";
import mainPrisma from "../configs/prisma.config";
import BaseError from "./error.helper";
import { IGenerateAutoIncFieldHelper } from "../utils/types/interfaces";

async function GenerateAutoIncField({
  prismaTx,
  tableName,
  field,
  length = 6,
  customPrefix = "",
  enableLogs = true,
}: IGenerateAutoIncFieldHelper) {
  const prisma = prismaTx ? prismaTx : mainPrisma;
  try {
    const tableTarget = await prisma.autoIncrement.findUnique({
      where: {
        field: field,
      },
    });
    let zero = [];

    if (tableTarget) {
      const prefix = `${tableTarget.prefix}${customPrefix}`;
      const counter = Number(tableTarget?.value) as number;
      const prefixLength = prefix.length;
      // const num = length - +prefixLength - counter.toString().length;
      let num = Math.max(length - prefixLength - counter.toString().length);

      if (num < 0) {
        num = 0;
        if (counter < 10) {
          num += 2;
        } else if (counter < 100) {
          num += 1;
        }
      }

      for (let i = 0; i < num; i++) {
        zero.push("0");
      }

      const result = `${prefix}${zero.join("")}${counter}`;

      await prisma.autoIncrement.update({
        where: {
          id: tableTarget.id,
        },
        data: {
          value: { increment: 1 },
        },
      });
      if (enableLogs) {
        logger.info(
          `[HELPER] successfully generated auto increment for column ${field} in table ${tableName} = ${result}, Length = ${length} `,
        );
      }
      return result;
    }

    throw new BaseError(
      "ERR_AUTOINCREMENT",
      500,
      `failed to generate auto-increment for column ${field} with table ${tableName}. because column ${field} or table ${tableName} is not found in the auto-increments table.`,
    );
  } catch (error: any) {
    logger.error(error);
    throw BaseError.transformError(error);
  }
}

export default GenerateAutoIncField;
