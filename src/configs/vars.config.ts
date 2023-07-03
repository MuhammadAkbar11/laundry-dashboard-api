import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import os from "os";
import { ModeTypes } from "../utils/types/types";
import logger from "./logger.config";
import { Role } from "@prisma/client";

const appDirname = path.resolve();

let mode: ModeTypes = Boolean(process.env?.TS_NODE_DEV)
  ? "development"
  : "production";

if (!process.env?.TS_NODE_DEV) {
  mode = process.env?.NODE_ENV as ModeTypes;
}

const envFilePaths = {
  production: path.join(appDirname, ".env"),
  development: path.join(appDirname, ".env.development"),
  testing: path.join(appDirname, ".env.test"),
};

const envFile = envFilePaths[mode] || envFilePaths["production"];

if (envFile) {
  logger.info(`[SERVER] env file is founded : (${envFile})!`);
}

export const dotenvConfig = dotenv.config({
  path: envFile,
});

if (process.env.NODE_ENV === "testing") {
  mode = "testing";
}

export const SUPERADMIN_EMAIL = "superadmin@storegg.com";
export const STATIC_FOLDER = path.join(appDirname, "public");
export const ROOT_FOLDER = appDirname;

const publicFolders = {
  testing: ".node_test",
  development: ".node_dev",
  production: "public",
};

export const ENV_STATIC_FOLDER_NAME = publicFolders[mode];
export const ENV_STATIC_FOLDER_PATH = path.join(
  ROOT_FOLDER,
  publicFolders[mode] || publicFolders["production"]
);

let uploadPath = ENV_STATIC_FOLDER_NAME + "/uploads";

if (mode !== "production") {
  uploadPath = `${ENV_STATIC_FOLDER_NAME}/uploads`;
  if (!fs.existsSync(path.join(ROOT_FOLDER, uploadPath))) {
    logger.warn(`[SERVER] ${mode} directory not found!`);
    try {
      fs.mkdirSync(path.join(ROOT_FOLDER, uploadPath), { recursive: true });
    } catch (error) {
      logger.warn(error, `[SERVER] ${mode} directory fail to create!`);
    }
    logger.info(`[SERVER] ${mode} directory created! with path ${uploadPath}`);
  } else {
    logger.info(`[SERVER] ${mode} directory founded! with path ${uploadPath}`);
  }
} else {
  logger.info(`[SERVER] ${mode} directory founded! with path ${uploadPath}`);
}

export const HOSTNAME = os.hostname();
export const PORT = process.env.PORT || 3000;
export const MODE = mode;
export const DATABASE_URL = process.env.DATABASE_UR as string;
export const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
export const PUBLIC_KEY = process.env.PUBLIC_KEY as string;
export const OAUTH_REFRESH_TOKEN = process.env?.OAUTH_REFRESH_TOKEN as string;
export const OAUTH_CLIENTID = process.env?.OAUTH_CLIENTID as string;
export const OAUTH_CLIENT_SECRET = process.env?.OAUTH_CLIENT_SECRET as string;
export const OAUTH_PLAYGROUND = process.env?.OAUTH_PLAYGROUND as string;
export const GMAIL = process.env?.GMAIL as string;
export const ZOHOMAIL = process.env?.ZOHOMAIL as string;
export const ZOHOMAIL_PW = process.env?.ZOHOMAIL_PW as string;
export const DEVS_EMAIL = (process.env?.DEVS_EMAIL as string) || GMAIL;

export const UPLOAD_PATH = uploadPath;
export const SERVER_URL =
  MODE === "development"
    ? `http://localhost:${PORT}/`
    : `http://${HOSTNAME}:${PORT}/`;

export const DEFAULT_USER_AVATAR = "/images/avatar.jpeg";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 5 minutes
export const ACCESS_TOKEN_MAX_AGE = 300000; // 5 minutes

export const HTTP_STATUS_CODE = {
  OK: 200,
  EDIT: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER: 500,
};

export const ROLES: Record<string, string> = Object.values(Role).reduce(
  (acc, val) => {
    acc[val] = val.toLowerCase().replace(/^\w/, c => c.toUpperCase());
    return acc;
  },
  {} as Record<string, string>
);

export const ROLES_ARR = Object.values(Role).map(role => ({
  value: role.toUpperCase(),
  text: role.toLowerCase().replace(/\b(\w)/g, s => s.toUpperCase()),
}));

export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
};

export const SUCCESS_MESSAGES = {
  create: (entityName: string) => `${entityName} telah berhasil ditambahkan`,
  read: (entityName: string) => `Data ${entityName} telah berhasil diperoleh.`,
  readById: (entityName: string, id: string) =>
    `Data ${entityName} dengan ID ${id} telah berhasil diperoleh.`,
  update: (entityName: string) =>
    `Data ${entityName} telah berhasil diperbarui.`,
  delete: (entityName: string, id: string) =>
    `Data ${entityName} dengan ID ${id} telah berhasil dihapus.`,
};

export const ERR_MESSAGES = {
  create: (entityName: string) => `Gagal membuat ${entityName}.`,
  read: (entityName: string) => `Gagal mengambil data ${entityName}.`,
  update: (entityName: string) => `Gagal memperbarui ${entityName}.`,
  delete: (entityName: string) => `Gagal menghapus ${entityName}.`,
  readByIdNotFound: (entityName: string, id: string) =>
    `Gagal menemukan ${entityName} dengan ID '${id}'.`,
  readByColumnInvalid: (entityName: string, columnName: string) =>
    `Gagal membaca data ${entityName} dengan kolom yang tidak valid '${columnName}'.`,
};

export const DB_AUTOINC_COLOUMNS: {
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
  {
    table: "tb_history_service",
    columns: [{ name: "history_service_id", prefix: "HLSV" }],
  },
  {
    table: "tb_payments",
    columns: [
      { name: "payment_id", prefix: "LPAY" },
      { name: "invoice", prefix: "INV" },
    ],
  },
  {
    table: "tb_expenses",
    columns: [
      { name: "expenses_id", prefix: "EXP" },
      { name: "expenses_invoice", prefix: "INV" },
    ],
  },
  {
    table: "tb_cashflow",
    columns: [
      { name: "cashflow_id", prefix: "KAS" },
      { name: "cashflow_invoice", prefix: "INV" },
    ],
  },
];
