import { dotenvConfig } from "../../configs/vars.config";
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { faker } from "@faker-js/faker";

import logger from "../../configs/logger.config";
import prisma from "../../configs/prisma.config";
import { dateIndoWIB } from "../../configs/date.config";
import GenerateAutoIncField from "../../helpers/autoincrement.helper";

dotenvConfig;

// Manifest files let every generated record be removed later without touching
// records created by real users.
const BATCH_DIR = path.resolve(__dirname, "../../../.node_dev/seed-batches");

type TrackedIds = {
  laundryQueue: string[];
  laundryItem: string[];
  historyService: string[];
  laundryRoom: string[];
  payment: string[];
  cashflow: string[];
  expenses: string[];
  notification: string[];
};

type BatchManifest = {
  batchId: string;
  createdAt: string;
  period: string;
  membersSelected: number;
  options: {
    payments: boolean;
    cashflow: boolean;
    notifications: boolean;
    expenses: boolean;
  };
  counts: Record<string, number>;
  ids: TrackedIds;
};

type VolumePreset = "small" | "medium" | "large" | "custom";

const VOLUME_PRESETS: Record<Exclude<VolumePreset, "custom">, number> = {
  small: 25,
  medium: 100,
  large: 500,
};

const MAX_CUSTOM_ORDERS = 5000;

// Final queue states with realistic weights: most orders complete, a portion is
// still in progress, a few are pending or canceled.
const STATUS_WEIGHTS: { status: string; weight: number }[] = [
  { status: "FINISHED", weight: 88 },
  { status: "WASHED", weight: 6 },
  { status: "ONHOLD", weight: 3 },
  { status: "PENDING", weight: 1 },
  { status: "CANCELED", weight: 2 },
];

const PAYMENT_METHOD_WEIGHTS: { method: string; weight: number }[] = [
  { method: "CASH", weight: 55 },
  { method: "BANK_TRANSFER", weight: 20 },
  { method: "GOPAY", weight: 15 },
  { method: "DANA", weight: 10 },
];

const DELIVERY_WEIGHTS: { type: string; weight: number }[] = [
  { type: "PICKUP", weight: 70 },
  { type: "DELIVERED", weight: 30 },
];

// Realistic operational expense categories with sensible rupiah ranges.
const EXPENSE_CATEGORIES: { name: string; min: number; max: number }[] = [
  { name: "Listrik", min: 150000, max: 900000 },
  { name: "Air", min: 80000, max: 400000 },
  { name: "Deterjen dan Sabun", min: 100000, max: 600000 },
  { name: "Gaji Karyawan", min: 1000000, max: 3500000 },
  { name: "Sewa Tempat", min: 1500000, max: 4000000 },
  { name: "Perawatan Mesin", min: 100000, max: 1200000 },
  { name: "Plastik dan Kemasan", min: 50000, max: 300000 },
  { name: "Transportasi", min: 80000, max: 500000 },
];

const prompt = inquirer.createPromptModule();

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

// Spread a timestamp uniformly across the period and clamp it to operating
// hours so dashboards and trend reports see a natural distribution.
function randomDateInRange(start: Date, end: Date): Date {
  const ms =
    start.getTime() + Math.random() * (end.getTime() - start.getTime());
  const day = dateIndoWIB(new Date(ms));
  const hour = faker.number.int({ min: 7, max: 20 });
  const minute = faker.number.int({ min: 0, max: 59 });
  return day.hour(hour).minute(minute).second(0).millisecond(0).toDate();
}

function resolvePeriodRange(year: number): {
  start: Date;
  end: Date;
  label: string;
} {
  const now = dateIndoWIB().toDate();
  const start = dateIndoWIB(`${year}-01-01`).startOf("year").toDate();
  let end = dateIndoWIB(`${year}-12-31`).endOf("year").toDate();
  // Do not place orders in the future for the running year.
  if (end.getTime() > now.getTime()) end = now;
  return { start, end, label: String(year) };
}

function emptyIds(): TrackedIds {
  return {
    laundryQueue: [],
    laundryItem: [],
    historyService: [],
    laundryRoom: [],
    payment: [],
    cashflow: [],
    expenses: [],
    notification: [],
  };
}

function ensureBatchDir(): void {
  if (!fs.existsSync(BATCH_DIR)) fs.mkdirSync(BATCH_DIR, { recursive: true });
}

function writeManifest(manifest: BatchManifest): void {
  ensureBatchDir();
  const file = path.join(BATCH_DIR, `${manifest.batchId}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), "utf-8");
}

function listManifests(): BatchManifest[] {
  if (!fs.existsSync(BATCH_DIR)) return [];
  return fs
    .readdirSync(BATCH_DIR)
    .filter(f => f.endsWith(".json"))
    .map(
      f =>
        JSON.parse(
          fs.readFileSync(path.join(BATCH_DIR, f), "utf-8"),
        ) as BatchManifest,
    )
    .sort((a, b) => b.batchId.localeCompare(a.batchId));
}

// Resolve the active IN_APP template for a type code and render it, mirroring
// the runtime NotificationService so generated notifications stay consistent.
async function renderNotification(
  typeCode: string,
  variables: Record<string, string | number>,
): Promise<{
  notificationTypeId: string;
  title: string;
  message: string;
} | null> {
  const type = await prisma.notificationType.findFirst({
    where: { code: typeCode, isActive: true },
  });
  if (!type) return null;

  const template = await prisma.notificationTemplate.findFirst({
    where: { notificationTypeId: type.id, channel: "IN_APP", isActive: true },
  });
  if (!template) return null;

  const render = (tpl: string) =>
    tpl.replace(/\{(\w+)\}/g, (_m, key) => {
      const value = variables[key];
      return value !== undefined && value !== null ? String(value) : "";
    });

  return {
    notificationTypeId: type.id,
    title: render(template.titleTemplate),
    message: render(template.messageTemplate),
  };
}

interface MemberOption {
  customerId: string;
  memberId: string | null;
  name: string;
  phone: string | null;
  levelName: string;
  discount: number;
}

async function loadMembers(filter?: string): Promise<MemberOption[]> {
  const customers = await prisma.customer.findMany({
    where: filter
      ? {
          OR: [{ name: { contains: filter } }, { phone: { contains: filter } }],
        }
      : undefined,
    include: { customerLevel: true, Member: true },
    orderBy: { createdAt: "asc" },
  });

  return customers.map(c => ({
    customerId: c.customerId,
    memberId: c.Member?.memberId ?? null,
    name: c.name,
    phone: c.phone,
    levelName: c.customerLevel?.name ?? "-",
    discount: c.customerLevel?.discount ?? 0,
  }));
}

interface GenerateConfig {
  members: MemberOption[];
  range: { start: Date; end: Date; label: string };
  totalOrders: number;
  withPayments: boolean;
  withCashflow: boolean;
  withNotifications: boolean;
  withExpenses: boolean;
  expenseCount: number;
}

async function createNotification(
  typeCode: string,
  variables: Record<string, string | number>,
  createdAt: Date,
  recipient: { memberId?: string | null },
  batchId: string,
  ids: TrackedIds,
): Promise<boolean> {
  const rendered = await renderNotification(typeCode, variables);
  if (!rendered) return false;

  const notification = await prisma.notification.create({
    data: {
      notificationTypeId: rendered.notificationTypeId,
      title: rendered.title,
      message: rendered.message,
      metadata: JSON.stringify({ seedBatchId: batchId }),
      createdAt,
      ...(recipient.memberId
        ? {
            memberNotifications: {
              create: { memberId: recipient.memberId, createdAt },
            },
          }
        : {}),
    },
  });
  ids.notification.push(notification.id);
  return true;
}

async function generateBatch(config: GenerateConfig): Promise<BatchManifest> {
  const batchId = `${dateIndoWIB().format("YYYYMMDD-HHmmss")}-${faker.string.alphanumeric(4)}`;
  const ids = emptyIds();
  const counts: Record<string, number> = {
    orders: 0,
    laundryItems: 0,
    payments: 0,
    cashflow: 0,
    notifications: 0,
    expenses: 0,
  };

  const services = await prisma.service.findMany();
  if (services.length === 0) {
    throw new Error(
      "No services found. Run the initial seed before generating business data.",
    );
  }

  // Running cashflow balance keeps financial records consistent with the
  // service layer, which always stores a rolling balance.
  const cashAgg = await prisma.cashFlow.aggregate({ _sum: { total: true } });
  let runningBalance = Number(cashAgg._sum.total ?? 0);

  logger.info("[SEED][BUSINESS] Generating orders...");

  for (let i = 0; i < config.totalOrders; i++) {
    const member = faker.helpers.arrayElement(config.members);
    const status = weightedPick(STATUS_WEIGHTS)?.status as string;
    const deliveryType = weightedPick(DELIVERY_WEIGHTS)?.type as string;

    const orderedAt = randomDateInRange(config.range.start, config.range.end);
    const datePrefix = dateIndoWIB(orderedAt).format("DDMMYY");

    const hasItems = status !== "PENDING" && status !== "ONHOLD";
    const isFinished = status === "FINISHED";

    const laundryQueueId = await GenerateAutoIncField({
      enableLogs: false,
      prismaTx: prisma,
      tableName: "tb_laundry_queues",
      field: "laundry_queue_id",
      customPrefix: datePrefix,
      length: 11,
    });

    const finishedAt = isFinished
      ? dateIndoWIB(orderedAt)
          .add(faker.number.int({ min: 1, max: 3 }), "day")
          .toDate()
      : null;

    await prisma.laundryQueue.create({
      data: {
        laundryQueueId,
        queuePaymentStatus:
          isFinished && config.withPayments ? "FINISHED" : "PENDING",
        status: status as any,
        deliveryType: deliveryType as any,
        customerId: member.customerId,
        note: faker.helpers.arrayElement([null, faker.lorem.sentence(), null]),
        deliveryAddress:
          deliveryType === "DELIVERED" ? faker.location.streetAddress() : "",
        pickupAt: null,
        deliveryAt: null,
        finishedAt,
        createdAt: orderedAt,
      },
    });
    ids.laundryQueue.push(laundryQueueId);
    counts.orders++;

    // Build the laundry items and accumulate the room total exactly like the
    // item service does, so payment pricing stays correct.
    let roomTotal = 0;
    if (hasItems) {
      const itemCount = faker.number.int({ min: 1, max: 4 });
      const picked = faker.helpers.arrayElements(
        services,
        Math.min(itemCount, services.length),
      );
      for (const svc of picked) {
        const quantity =
          svc.unit === "KG"
            ? faker.number.int({ min: 1, max: 8 })
            : faker.number.int({ min: 1, max: 15 });
        const totalPrice = Number(svc.price) * quantity;
        roomTotal += totalPrice;

        const historyServiceId = await GenerateAutoIncField({
          enableLogs: false,
          prismaTx: prisma,
          tableName: "tb_history_services",
          field: "history_service_id",
          length: 7,
        });
        await prisma.historyService.create({
          data: {
            historyServiceId,
            serviceId: svc.serviceId,
            name: svc.name,
            description: svc.description,
            unit: svc.unit,
            price: svc.price,
            createdAt: orderedAt,
          },
        });
        ids.historyService.push(historyServiceId);

        const laundryId = await GenerateAutoIncField({
          enableLogs: false,
          prismaTx: prisma,
          tableName: "tb_laundries",
          field: "laundry_id",
          length: 8,
        });
        await prisma.laundryItem.create({
          data: {
            laundryId,
            laundryQueueId,
            historyServiceId,
            quantity,
            totalPrice: BigInt(totalPrice),
            note: faker.helpers.arrayElement([null, faker.lorem.words(3)]),
            createdAt: orderedAt,
          },
        });
        ids.laundryItem.push(laundryId);
        counts.laundryItems++;
      }
    }

    const roomStatus = isFinished ? "FINISHED" : hasItems ? "WASHED" : "READY";
    const laundryRoomId = await GenerateAutoIncField({
      enableLogs: false,
      prismaTx: prisma,
      tableName: "tb_laundry_rooms",
      field: "laundry_room_id",
      customPrefix: datePrefix,
      length: 6,
    });
    await prisma.laundryRoom.create({
      data: {
        laundryRoomId,
        laundryQueueId,
        total: roomTotal,
        status: roomStatus as any,
        createdAt: orderedAt,
      },
    });
    ids.laundryRoom.push(laundryRoomId);

    // Payments and cashflow only exist for completed, billable orders.
    if (config.withPayments && isFinished && roomTotal > 0) {
      const discount = Math.round((roomTotal * member.discount) / 100);
      const totalPrice = roomTotal - discount;
      const paid = totalPrice;
      const method = weightedPick(PAYMENT_METHOD_WEIGHTS).method as string;
      const paidAt = finishedAt ?? orderedAt;

      const paymentId = await GenerateAutoIncField({
        enableLogs: false,
        prismaTx: prisma,
        tableName: "tb_payments",
        field: "payment_id",
        length: 7,
      });
      const invoice = await GenerateAutoIncField({
        enableLogs: false,
        prismaTx: prisma,
        tableName: "tb_payments",
        field: "invoice",
        customPrefix: dateIndoWIB(paidAt).format("DDMMYY"),
      });
      await prisma.payment.create({
        data: {
          paymentId,
          invoice,
          laundryQueueId,
          totalLaundry: ids.laundryItem.length,
          price: roomTotal,
          discount,
          totalPrice,
          paid,
          cashback: paid - totalPrice,
          paymentMethod: method as any,
          userId: null,
          createdAt: dateIndoWIB(paidAt).format(),
          updatedAt: dateIndoWIB(paidAt).format(),
        },
      });
      ids.payment.push(paymentId);
      counts.payments++;

      if (config.withCashflow) {
        runningBalance += totalPrice;
        const cashflowId = await GenerateAutoIncField({
          enableLogs: false,
          prismaTx: prisma,
          tableName: "tb_cashflow",
          field: "cashflow_id",
          length: 7,
        });
        const cashflow = await prisma.cashFlow.create({
          data: {
            cashflowId,
            cashflowInvoice: invoice,
            description: "Pembayaran Cucian",
            cashflowType: "IN",
            total: totalPrice,
            balance: runningBalance,
            createdAt: paidAt,
          },
        });
        ids.cashflow.push(cashflow.cashflowId);
        counts.cashflow++;
      }
    }

    // Notifications follow the same milestones the application emits.
    if (config.withNotifications) {
      const created = await createNotification(
        "LAUNDRY_RECEIVED",
        { orderNumber: laundryQueueId },
        orderedAt,
        { memberId: member.memberId },
        batchId,
        ids,
      );
      if (created) counts.notifications++;

      if (hasItems) {
        const washed = await createNotification(
          "LAUNDRY_WASHED",
          { orderNumber: laundryQueueId },
          dateIndoWIB(orderedAt).add(2, "hour").toDate(),
          { memberId: member.memberId },
          batchId,
          ids,
        );
        if (washed) counts.notifications++;
      }

      if (isFinished) {
        const done = await createNotification(
          "LAUNDRY_FINISHED",
          { orderNumber: laundryQueueId },
          finishedAt ?? orderedAt,
          { memberId: member.memberId },
          batchId,
          ids,
        );
        if (done) counts.notifications++;
      }
    }

    if ((i + 1) % 25 === 0 || i + 1 === config.totalOrders) {
      logger.info(`[SEED][BUSINESS] Orders ${i + 1}/${config.totalOrders}`);
    }
  }

  // Expenses are distributed across the same period for realistic profit and
  // financial reporting.
  if (config.withExpenses && config.expenseCount > 0) {
    logger.info("[SEED][BUSINESS] Generating expenses...");
    for (let i = 0; i < config.expenseCount; i++) {
      const category = faker.helpers.arrayElement(EXPENSE_CATEGORIES);
      const total = faker.number.int({ min: category.min, max: category.max });
      const spentAt = randomDateInRange(config.range.start, config.range.end);

      const expensesId = await GenerateAutoIncField({
        enableLogs: false,
        prismaTx: prisma,
        tableName: "tb_expenses",
        field: "expenses_id",
        length: 6,
      });
      const expensesInvoice = await GenerateAutoIncField({
        enableLogs: false,
        prismaTx: prisma,
        tableName: "tb_expenses",
        field: "expenses_invoice",
        customPrefix: dateIndoWIB(spentAt).format("DDMMYY"),
      });

      // Expenses require a real user as the actor; fall back gracefully.
      const actor = await prisma.user.findFirst({
        where: { status: "ACTIVE" },
      });
      if (!actor) {
        logger.error(
          "[SEED][BUSINESS] No active user found, skipping expenses.",
        );
        break;
      }

      await prisma.expenses.create({
        data: {
          expensesId,
          expensesInvoice,
          description: category.name,
          total,
          userId: actor.userId,
          createdAt: spentAt,
        },
      });
      ids.expenses.push(expensesId);
      counts.expenses++;

      if (config.withCashflow) {
        runningBalance -= total;
        const cashflowId = await GenerateAutoIncField({
          enableLogs: false,
          prismaTx: prisma,
          tableName: "tb_cashflow",
          field: "cashflow_id",
          length: 7,
        });
        const cashflow = await prisma.cashFlow.create({
          data: {
            cashflowId,
            cashflowInvoice: expensesInvoice,
            description: `Pengeluaran untuk ${category.name}`,
            cashflowType: "OUT",
            total,
            balance: runningBalance,
            createdAt: spentAt,
          },
        });
        ids.cashflow.push(cashflow.cashflowId);
        counts.cashflow++;
      }
    }
  }

  const manifest: BatchManifest = {
    batchId,
    createdAt: dateIndoWIB().format(),
    period: config.range.label,
    membersSelected: config.members.length,
    options: {
      payments: config.withPayments,
      cashflow: config.withCashflow,
      notifications: config.withNotifications,
      expenses: config.withExpenses,
    },
    counts,
    ids,
  };
  writeManifest(manifest);
  return manifest;
}

// Remove every record listed in a manifest. Children are deleted before
// parents because the schema uses relationMode = "prisma" (no DB cascades).
async function cleanupBatch(manifest: BatchManifest): Promise<void> {
  const { ids } = manifest;

  if (ids.notification.length) {
    await prisma.memberNotification.deleteMany({
      where: { notificationId: { in: ids.notification } },
    });
    await prisma.userNotification.deleteMany({
      where: { notificationId: { in: ids.notification } },
    });
    await prisma.notification.deleteMany({
      where: { id: { in: ids.notification } },
    });
  }
  if (ids.payment.length) {
    await prisma.payment.deleteMany({
      where: { paymentId: { in: ids.payment } },
    });
  }
  if (ids.cashflow.length) {
    await prisma.cashFlow.deleteMany({
      where: { cashflowId: { in: ids.cashflow } },
    });
  }
  if (ids.laundryItem.length) {
    await prisma.laundryItem.deleteMany({
      where: { laundryId: { in: ids.laundryItem } },
    });
  }
  if (ids.historyService.length) {
    await prisma.historyService.deleteMany({
      where: { historyServiceId: { in: ids.historyService } },
    });
  }
  if (ids.laundryRoom.length) {
    await prisma.laundryRoom.deleteMany({
      where: { laundryRoomId: { in: ids.laundryRoom } },
    });
  }
  if (ids.laundryQueue.length) {
    await prisma.laundryQueue.deleteMany({
      where: { laundryQueueId: { in: ids.laundryQueue } },
    });
  }
  if (ids.expenses.length) {
    await prisma.expenses.deleteMany({
      where: { expensesId: { in: ids.expenses } },
    });
  }

  const file = path.join(BATCH_DIR, `${manifest.batchId}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function printSummary(manifest: BatchManifest): void {
  console.log("");
  logger.info("[SEED][BUSINESS] Generation summary");
  console.log(`  Batch Id              : ${manifest.batchId}`);
  console.log(`  Period                : ${manifest.period}`);
  console.log(`  Members Selected      : ${manifest.membersSelected}`);
  console.log(`  Orders Generated      : ${manifest.counts.orders}`);
  console.log(`  Laundry Items         : ${manifest.counts.laundryItems}`);
  console.log(`  Payments Generated    : ${manifest.counts.payments}`);
  console.log(`  CashFlow Generated    : ${manifest.counts.cashflow}`);
  console.log(`  Notifications         : ${manifest.counts.notifications}`);
  console.log(`  Expenses Generated    : ${manifest.counts.expenses}`);
  console.log("");
}

async function runGenerate(): Promise<void> {
  const { filter } = await prompt([
    {
      type: "input",
      name: "filter",
      message: "Filter members by name or phone (leave empty to list all):",
    },
  ]);

  const members = await loadMembers((filter as string)?.trim() || undefined);
  if (members.length === 0) {
    logger.error("[SEED][BUSINESS] No members found. Seed customers first.");
    return;
  }

  const { selected } = await prompt([
    {
      type: "checkbox",
      name: "selected",
      message: "Select members (space to toggle, enter to confirm):",
      pageSize: 15,
      choices: [
        { name: "ALL MEMBERS", value: "__ALL__" },
        new inquirer.Separator(),
        ...members.map(m => ({
          name: `${m.name} | ${m.phone ?? "-"} | ${m.levelName}${m.memberId ? " | akun" : ""}`,
          value: m.customerId,
        })),
      ],
      validate: (input: string[]) =>
        input.length > 0 ? true : "Select at least one member.",
    },
  ]);

  const chosen: MemberOption[] = (selected as string[]).includes("__ALL__")
    ? members
    : members.filter(m => (selected as string[]).includes(m.customerId));

  const currentYear = Number(dateIndoWIB().format("YYYY"));
  const yearChoices = Array.from(
    { length: 5 },
    (_, idx) => currentYear - idx,
  ).map(y => ({
    name: y === currentYear ? `Current Year (${y})` : String(y),
    value: String(y),
  }));

  const { periodChoice } = await prompt([
    {
      type: "list",
      name: "periodChoice",
      message: "Select period:",
      choices: [...yearChoices, { name: "Custom Year", value: "custom" }],
    },
  ]);

  let year = currentYear;
  if (periodChoice === "custom") {
    const { customYear } = await prompt([
      {
        type: "input",
        name: "customYear",
        message: "Enter year (e.g. 2022):",
        validate: (v: string) => {
          const n = Number(v);
          return Number.isInteger(n) && n >= 2000 && n <= currentYear
            ? true
            : `Enter a year between 2000 and ${currentYear}.`;
        },
      },
    ]);
    year = Number(customYear);
  } else {
    year = Number(periodChoice);
  }
  const range = resolvePeriodRange(year);

  const { volume } = await prompt([
    {
      type: "list",
      name: "volume",
      message: "Select data volume:",
      choices: [
        { name: `Small (~${VOLUME_PRESETS.small} orders)`, value: "small" },
        { name: `Medium (~${VOLUME_PRESETS.medium} orders)`, value: "medium" },
        { name: `Large (~${VOLUME_PRESETS.large} orders)`, value: "large" },
        { name: "Custom", value: "custom" },
      ],
    },
  ]);

  let totalOrders: number;
  if (volume === "custom") {
    const { customCount } = await prompt([
      {
        type: "input",
        name: "customCount",
        message: `Enter number of orders (1-${MAX_CUSTOM_ORDERS}):`,
        validate: (v: string) => {
          const n = Number(v);
          return Number.isInteger(n) && n >= 1 && n <= MAX_CUSTOM_ORDERS
            ? true
            : `Enter a whole number between 1 and ${MAX_CUSTOM_ORDERS}.`;
        },
      },
    ]);
    totalOrders = Number(customCount);
  } else {
    totalOrders = VOLUME_PRESETS[volume as Exclude<VolumePreset, "custom">];
  }

  const toggles = await prompt([
    {
      type: "confirm",
      name: "withPayments",
      message: "Generate payments?",
      default: true,
    },
    {
      type: "confirm",
      name: "withCashflow",
      message: "Generate cashflow?",
      default: true,
      when: a => a.withPayments,
    },
    {
      type: "confirm",
      name: "withNotifications",
      message: "Generate notifications?",
      default: true,
    },
    {
      type: "confirm",
      name: "withExpenses",
      message: "Generate expenses?",
      default: true,
    },
  ]);

  let expenseCount = 0;
  if (toggles.withExpenses) {
    const suggested = Math.max(5, Math.round(totalOrders * 0.15));
    const { count } = await prompt([
      {
        type: "input",
        name: "count",
        message: `Number of expenses to generate (default ${suggested}):`,
        default: String(suggested),
        validate: (v: string) => {
          const n = Number(v);
          return Number.isInteger(n) && n >= 0 && n <= MAX_CUSTOM_ORDERS
            ? true
            : `Enter a whole number between 0 and ${MAX_CUSTOM_ORDERS}.`;
        },
      },
    ]);
    expenseCount = Number(count);
  }

  const { proceed } = await prompt([
    {
      type: "confirm",
      name: "proceed",
      message: `Generate ${totalOrders} orders for ${chosen.length} member(s) in ${range.label}?`,
      default: true,
    },
  ]);
  if (!proceed) {
    logger.info("[SEED][BUSINESS] Cancelled.");
    return;
  }

  const manifest = await generateBatch({
    members: chosen,
    range,
    totalOrders,
    withPayments: !!toggles.withPayments,
    withCashflow: !!toggles.withPayments && !!toggles.withCashflow,
    withNotifications: !!toggles.withNotifications,
    withExpenses: !!toggles.withExpenses,
    expenseCount,
  });

  printSummary(manifest);
}

async function runCleanup(): Promise<void> {
  const manifests = listManifests();
  if (manifests.length === 0) {
    logger.info("[SEED][BUSINESS] No generated batches found.");
    return;
  }

  const { batchIds } = await prompt([
    {
      type: "checkbox",
      name: "batchIds",
      message: "Select batches to remove:",
      choices: manifests.map(m => ({
        name: `${m.batchId} | period ${m.period} | ${m.counts.orders} orders`,
        value: m.batchId,
      })),
      validate: (input: string[]) =>
        input.length > 0 ? true : "Select at least one batch.",
    },
  ]);

  const { confirmDelete } = await prompt([
    {
      type: "confirm",
      name: "confirmDelete",
      message: `Permanently delete ${(batchIds as string[]).length} batch(es) and all their records?`,
      default: false,
    },
  ]);
  if (!confirmDelete) {
    logger.info("[SEED][BUSINESS] Cleanup cancelled.");
    return;
  }

  for (const id of batchIds as string[]) {
    const manifest = manifests.find(m => m.batchId === id);
    if (!manifest) continue;
    logger.info(`[SEED][BUSINESS] Removing batch ${id}...`);
    await cleanupBatch(manifest);
  }
  logger.info("[SEED][BUSINESS] Cleanup complete.");
}

(async () => {
  console.log("");
  logger.info("[SEED][BUSINESS] Business operations seed generator");

  try {
    const { action } = await prompt([
      {
        type: "list",
        name: "action",
        message: "Choose an action:",
        choices: [
          { name: "Generate business data", value: "generate" },
          { name: "Reset previously generated data", value: "cleanup" },
        ],
      },
    ]);

    if (action === "generate") await runGenerate();
    else await runCleanup();
  } catch (error) {
    logger.error("[SEED][BUSINESS] Failed.");
    console.log(error);
  } finally {
    await prisma.$disconnect();
  }
})();
