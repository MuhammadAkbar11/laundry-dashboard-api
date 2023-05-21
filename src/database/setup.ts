import { PrismaClient } from "@prisma/client";
import inquirer from "inquirer";
import logger from "../configs/logger.config";
import chalk from "chalk";
import { dotenvConfig } from "../configs/vars.config";

dotenvConfig;

const prisma = new PrismaClient();

const DB_AUTOINC_COLOUMNS: {
  table: string;
  columns: { name: string; prefix: string }[];
}[] = [
  {
    table: "tb_users",
    columns: [{ name: "user_id", prefix: "USR" }],
  },
  {
    table: "tb_customer_levels",
    columns: [{ name: "cs_level_id", prefix: "CSLVL" }],
  },
  {
    table: "tb_customers",
    columns: [{ name: "customer_id", prefix: "CSMR" }],
  },
  {
    table: "tb_services",
    columns: [{ name: "service_id", prefix: "LSRV" }],
  },
  {
    table: "tb_laundries",
    columns: [{ name: "laundry_id", prefix: "LDRY" }],
  },
  {
    table: "tb_laundry_queues",
    columns: [{ name: "laundry_queue_id", prefix: "LQU" }],
  },
  {
    table: "tb_laundry_rooms",
    columns: [{ name: "laundry_room_id", prefix: "LDRM" }],
  },
];

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

  for (const autoIncCfgItem of autoIncrementConfigs) {
    const exists = await prisma.autoIncrement.findMany({
      where: {
        tbName: autoIncCfgItem.tbName,
        field: autoIncCfgItem.field,
      },
    });
    const fieldTxt = chalk.bold(autoIncCfgItem.field);
    const tbTxt = chalk.bold(autoIncCfgItem.tbName);
    if (exists.length === 0) {
      console.log("");
      logger.warn(
        `[DATABASE] Column ${fieldTxt} with table ${tbTxt} does'nt and it will added...`
      );
      await prisma.autoIncrement.create({ data: autoIncCfgItem });
      logger.warn(
        `[DATABASE] Successfully added column ${fieldTxt} with table ${tbTxt}`
      );
    } else {
      console.log("");
      const resetValueConfirm = await inquirer.prompt({
        type: "confirm",
        name: "isResetValue",
        message: `Column ${fieldTxt} with table ${tbTxt} already exist so wanna reset the value?`,
        default: false,
      });

      await prisma.autoIncrement.update({
        where: { id: exists[0].id },
        data: {
          ...autoIncCfgItem,
          value: resetValueConfirm.isResetValue ? 1 : exists[0].value,
        },
      });

      logger.warn(
        `[DATABASE] Successfully update column ${fieldTxt} with table ${tbTxt}`
      );
    }
  }
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
