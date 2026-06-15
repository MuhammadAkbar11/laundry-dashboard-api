import { PrismaClient } from "@prisma/client";
import logger from "../../configs/logger.config";
import { dotenvConfig } from "../../configs/vars.config";

dotenvConfig;

const prisma = new PrismaClient();

/**
 * Fan out legacy global UserNotification rows. The previous
 * notifyAllUsers implementation created a single row with userId = NULL,
 * which leaked read state between administrators. This script back-fills
 * one row per active user per legacy global notification and removes the
 * orphan originals so per-user read state stays isolated.
 */
async function main() {
  logger.info("[DATABASE] start fan-out of legacy global notifications");

  const legacyGlobals = await prisma.userNotification.findMany({
    where: { userId: null, isGlobal: true },
    select: { id: true, notificationId: true, isRead: true, readAt: true },
  });

  if (legacyGlobals.length === 0) {
    logger.info("[DATABASE] no legacy global notifications found");
    return;
  }

  const activeUsers = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { userId: true },
  });

  if (activeUsers.length === 0) {
    logger.warn(
      "[DATABASE] no active users found; skipping fan-out to avoid creating more orphan rows",
    );
    return;
  }

  let createdRows = 0;
  let removedRows = 0;

  for (const legacy of legacyGlobals) {
    const existingAssignments = await prisma.userNotification.findMany({
      where: {
        notificationId: legacy.notificationId,
        userId: { not: null },
      },
      select: { userId: true },
    });
    const alreadyAssigned = new Set(
      existingAssignments.map(row => row.userId as string),
    );

    const missing = activeUsers.filter(u => !alreadyAssigned.has(u.userId));

    if (missing.length > 0) {
      await prisma.userNotification.createMany({
        data: missing.map(u => ({
          notificationId: legacy.notificationId,
          userId: u.userId,
          isGlobal: true,
          isRead: false,
          readAt: null,
        })),
      });
      createdRows += missing.length;
    }

    await prisma.userNotification.delete({ where: { id: legacy.id } });
    removedRows += 1;
  }

  logger.info(
    `[DATABASE] fan-out complete: created ${createdRows} rows, removed ${removedRows} orphan rows`,
  );
}

main()
  .catch((err: any) => {
    logger.error("[DATABASE] fan-out failed");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
