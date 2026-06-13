import { PrismaClient } from "@prisma/client";
import { dotenvConfig } from "../src/configs/vars.config";

dotenvConfig;

const prisma = new PrismaClient();

(async () => {
  const types = [
    { code: "SYSTEM_ALERT", name: "Peringatan Sistem", description: "Notifikasi peringatan umum dari sistem" },
    { code: "NEW_MEMBER", name: "Anggota Baru", description: "Notifikasi saat anggota baru mendaftar" },
    { code: "LAUNDRY_RECEIVED", name: "Cucian Diterima", description: "Cucian telah diterima oleh petugas" },
    { code: "LAUNDRY_WASHED", name: "Cucian Sedang Dicuci", description: "Cucian sedang dalam proses pencucian" },
    { code: "LAUNDRY_FINISHED", name: "Cucian Selesai", description: "Cucian telah selesai dan siap diambil" },
  ];

  for (const t of types) {
    await prisma.notificationType.upsert({
      where: { code: t.code },
      update: {},
      create: t,
    });
  }

  const templates = [
    {
      typeCode: "SYSTEM_ALERT",
      channel: "IN_APP" as const,
      titleTemplate: "Peringatan: {title}",
      messageTemplate: "{message}",
      supportedVariables: JSON.stringify(["title", "message"]),
    },
    {
      typeCode: "NEW_MEMBER",
      channel: "IN_APP" as const,
      titleTemplate: "Anggota Baru",
      messageTemplate: "{memberName} telah mendaftar sebagai anggota baru.",
      supportedVariables: JSON.stringify(["memberName"]),
    },
    {
      typeCode: "LAUNDRY_RECEIVED",
      channel: "IN_APP" as const,
      titleTemplate: "Cucian Diterima",
      messageTemplate: "Cucian Anda dengan nomor #{orderNumber} telah diterima.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "LAUNDRY_WASHED",
      channel: "IN_APP" as const,
      titleTemplate: "Cucian Sedang Dicuci",
      messageTemplate: "Cucian Anda dengan nomor #{orderNumber} sedang dalam proses pencucian.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "LAUNDRY_FINISHED",
      channel: "IN_APP" as const,
      titleTemplate: "Cucian Selesai",
      messageTemplate: "Cucian Anda dengan nomor #{orderNumber} telah selesai dan siap diambil.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
  ];

  for (const tpl of templates) {
    const type = await prisma.notificationType.findUnique({
      where: { code: tpl.typeCode },
    });
    if (!type) continue;

    const existing = await prisma.notificationTemplate.findFirst({
      where: {
        notificationTypeId: type.id,
        channel: tpl.channel,
        titleTemplate: tpl.titleTemplate,
      },
    });
    if (!existing) {
      await prisma.notificationTemplate.create({
        data: {
          notificationTypeId: type.id,
          channel: tpl.channel,
          titleTemplate: tpl.titleTemplate,
          messageTemplate: tpl.messageTemplate,
          supportedVariables: tpl.supportedVariables,
        },
      });
    }
  }

  console.log("Notification seed completed successfully.");
  await prisma.$disconnect();
})();
