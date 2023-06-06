import { PrismaClient } from "@prisma/client";
import inquirer from "inquirer";
import logger from "../configs/logger.config";
import chalk from "chalk";
import { DB_AUTOINC_COLOUMNS, dotenvConfig } from "../configs/vars.config";
import _ from "lodash";

dotenvConfig;

const prisma = new PrismaClient();

interface IConfig {
  id?: number;
  tbName: string;
  field: string;
  prefix: string;
}

const main = async () => {
  logger.info("[DATABASE] setup database...");

  const getdb = (await prisma.$queryRaw`SELECT DATABASE()`) as Array<any>;
  const dbname = getdb[0]["DATABASE()"] as any;
  const result = (await prisma.$queryRaw`
  SELECT TABLE_NAME, COLUMN_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = ${dbname}
`) as any; // AND COLUMN_KEY = 'PRI'

  const tablesObj: Record<string, string[]> = {};
  result.forEach((row: any) => {
    const { TABLE_NAME, COLUMN_NAME } = row;
    if (tablesObj[TABLE_NAME]) {
      tablesObj[TABLE_NAME].push(COLUMN_NAME);
    } else {
      tablesObj[TABLE_NAME] = [COLUMN_NAME];
    }
  });

  const tables: { table: string; columns: string[] }[] = Object.keys(
    tablesObj
  ).map(table => ({
    table,
    columns: tablesObj[table],
  })) as [];

  const autoIncrementConfigs = [];
  for (const { table, columns } of tables) {
    for (const column of columns) {
      const match = DB_AUTOINC_COLOUMNS.find(
        c => c.table === table && c.columns.find(col => col.name === column)
      );
      if (match) {
        autoIncrementConfigs.push({
          tbName: table,
          field: column,
          prefix: match.columns[0].prefix,
        });
      }
    }
  }

  logger.info("[DATABASE] setup Auto Increment...");

  for (const { table, columns } of DB_AUTOINC_COLOUMNS) {
    const match = tables.find(t => t.table === table);
    if (!match) {
      logger.warn(`[DATABASE] Table ${table} not found in tables`);
      continue;
    }

    for (const column of columns) {
      if (!match.columns.includes(column.name)) {
        logger.warn(
          `[DATABASE] Column ${column.name} not found in table ${table}`
        );
      }
    }
  }

  const updatedData: IConfig[] = [];
  const newData: IConfig[] = [];

  for (const item of autoIncrementConfigs) {
    const isAvailable = await prisma.autoIncrement.findMany({
      where: {
        tbName: item.tbName,
        field: item.field,
      },
    });

    if (isAvailable.length !== 0) {
      updatedData.push({ id: isAvailable[0].id, ...item });
    } else {
      newData.push({ ...item });
    }
  }

  if (updatedData.length !== 0) {
    logger.info("[DATABASE] Some data is already exits in the database");
    console.log("");
    const { selectedUpdatedData } = (await inquirer.prompt({
      type: "checkbox",
      message:
        "Select the data that is available if you want to reset the value:",
      name: "selectedUpdatedData",
      choices: updatedData.map(item => ({
        name: ` Table "${item.tbName}" | Column "${chalk.bold(
          item.field
        )}" | Prefix = ${item.prefix}`,
        value: item,
      })),
    })) as { selectedUpdatedData: IConfig[] };

    if (selectedUpdatedData.length !== 0) {
      for (const item of selectedUpdatedData) {
        await prisma.autoIncrement.update({
          where: { id: item.id },
          data: {
            field: item.field,
            tbName: item.tbName,
            prefix: item.prefix,
            value: 0,
          },
        });

        logger.warn(
          `[DATABASE] Successfully update Column ${item.field} with table ${item.tbName}`
        );
      }
    }

    logger.info(selectedUpdatedData, "UPDATED SELECTED");
  }

  if (newData.length !== 0) {
    for (const newItem of newData) {
      await prisma.autoIncrement.create({
        data: {
          tbName: newItem.tbName,
          prefix: newItem.prefix,
          field: newItem.field,
        },
      });
      logger.warn(
        `[DATABASE] Successfully added column ${newItem.field} with table ${newItem.tbName}`
      );
    }
  }

  const mapConfig = DB_AUTOINC_COLOUMNS.flatMap(item =>
    item.columns.map(field => ({
      table: item.table,
      field: field.name,
      prefix: field.prefix,
    }))
  );
  console.log(`
\`\`\`
export type IncTablesNameTypes = ${mapConfig
    .map(i => `\"${i.table}\"`)
    .join(" | ")};
export type IncTablesFieldTypes = ${mapConfig
    .map(i => `\"${i.field}\"`)
    .join(" | ")};
\`\`\``);
  console.log("");
  logger.info("[DATABASE] setup database successfully");
};

main()
  .catch((err: any) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
