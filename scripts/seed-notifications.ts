import { PrismaClient } from "@prisma/client";
import { dotenvConfig } from "../src/configs/vars.config";

dotenvConfig;

const prisma = new PrismaClient();

const RESET_FLAG = "--reset";
const shouldReset = process.argv.includes(RESET_FLAG);

(async () => {
  if (shouldReset) {
    console.log("[RESET] Deleting all existing notification templates...");
    const deletedTemplates = await prisma.notificationTemplate.deleteMany({});
    console.log(`[RESET] Removed ${deletedTemplates.count} templates.`);
  }

  const types = [
    // System & Admin
    {
      code: "SYSTEM_ALERT",
      name: "Peringatan Sistem",
      description: "Notifikasi peringatan umum dari sistem",
    },
    {
      code: "NEW_MEMBER",
      name: "Anggota Baru",
      description: "Notifikasi saat anggota baru mendaftar",
    },
    {
      code: "NEW_USER",
      name: "Pengguna Baru",
      description: "Notifikasi saat admin/staff baru didaftarkan",
    },
    {
      code: "NEW_LAUNDRY_ORDER",
      name: "Pesanan Cucian Baru",
      description: "Notifikasi untuk admin saat ada pesanan cucian baru",
    },
    {
      code: "NEW_PAYMENT",
      name: "Pembayaran Baru",
      description: "Notifikasi untuk admin saat ada pembayaran baru",
    },

    // Laundry
    {
      code: "LAUNDRY_CREATED",
      name: "Cucian Dibuat",
      description: "Pesanan cucian telah dibuat",
    },
    {
      code: "LAUNDRY_ON_HOLD",
      name: "Cucian diproses",
      description: "Cucian sedang dalam proses antrian",
    },
    {
      code: "LAUNDRY_WASHED",
      name: "Cucian Sedang Dicuci",
      description: "Cucian sedang dalam proses pencucian",
    },
    {
      code: "LAUNDRY_FINISHED",
      name: "Cucian Selesai",
      description: "Cucian telah selesai dan siap diambil",
    },
    {
      code: "LAUNDRY_CANCELED",
      name: "Cucian Dibatalkan",
      description: "Pesanan cucian dibatalkan",
    },
    {
      code: "LAUNDRY_DELIVERED",
      name: "Cucian Dikirim",
      description: "Cucian telah dikirim ke pelanggan",
    },

    // Payment
    {
      code: "PAYMENT_PENDING",
      name: "Pembayaran Menunggu",
      description: "Pembayaran menunggu konfirmasi",
    },
    {
      code: "PAYMENT_PROCESSED",
      name: "Pembayaran Diproses",
      description: "Pembayaran sedang diproses",
    },
    {
      code: "PAYMENT_REJECTED",
      name: "Pembayaran Ditolak",
      description: "Pembayaran ditolak",
    },
    {
      code: "PAYMENT_COMPLETED",
      name: "Pembayaran Selesai",
      description: "Pembayaran telah selesai",
    },

    // Member & Auth
    {
      code: "MEMBER_REGISTERED",
      name: "Pendaftaran Berhasil",
      description: "Notifikasi setelah pendaftaran berhasil",
    },
    {
      code: "EMAIL_VERIFIED",
      name: "Email Terverifikasi",
      description: "Notifikasi setelah email diverifikasi",
    },
    {
      code: "PASSWORD_RESET",
      name: "Password Direset",
      description: "Notifikasi setelah password berhasil direset",
    },
  ];

  for (const t of types) {
    await prisma.notificationType.upsert({
      where: { code: t.code },
      update: {},
      create: t,
    });
  }

  const templates = [
    // System & Admin
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
      typeCode: "NEW_USER",
      channel: "IN_APP" as const,
      titleTemplate: "Pengguna Baru",
      messageTemplate: "{userName} telah didaftarkan sebagai {role}.",
      supportedVariables: JSON.stringify(["userName", "role"]),
    },
    {
      typeCode: "NEW_LAUNDRY_ORDER",
      channel: "IN_APP" as const,
      titleTemplate: "Pesanan Cucian Baru",
      messageTemplate:
        "Pesanan cucian baru #{orderNumber} dari {customerName}.",
      supportedVariables: JSON.stringify(["orderNumber", "customerName"]),
    },
    {
      typeCode: "NEW_PAYMENT",
      channel: "IN_APP" as const,
      titleTemplate: "Pembayaran Baru",
      messageTemplate: "Pembayaran baru untuk pesanan #{orderNumber}",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },

    // Laundry
    {
      typeCode: "LAUNDRY_CREATED",
      channel: "IN_APP" as const,
      titleTemplate: "Pesanan Cucian Dibuat",
      messageTemplate:
        "Pesanan cucian Anda dengan nomor #{orderNumber} telah dibuat.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "LAUNDRY_ON_HOLD",
      channel: "IN_APP" as const,
      titleTemplate: "Cucian Ditunda",
      messageTemplate:
        "Cucian Anda dengan nomor #{orderNumber} sedang dalam proses antrian.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "LAUNDRY_WASHED",
      channel: "IN_APP" as const,
      titleTemplate: "Cucian Sedang Dicuci",
      messageTemplate:
        "Cucian Anda dengan nomor #{orderNumber} sedang dalam proses pencucian.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "LAUNDRY_FINISHED",
      channel: "IN_APP" as const,
      titleTemplate: "Cucian Selesai",
      messageTemplate:
        "Cucian Anda dengan nomor #{orderNumber} telah selesai dan siap diambil/diantar",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "LAUNDRY_CANCELED",
      channel: "IN_APP" as const,
      titleTemplate: "Pesanan Dibatalkan",
      messageTemplate:
        "Pesanan cucian Anda dengan nomor #{orderNumber} telah dibatalkan.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "LAUNDRY_DELIVERED",
      channel: "IN_APP" as const,
      titleTemplate: "Cucian Dikirim",
      messageTemplate:
        "Cucian Anda dengan nomor #{orderNumber} telah dikirim ke alamat Anda.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },

    // Payment
    {
      typeCode: "PAYMENT_PENDING",
      channel: "IN_APP" as const,
      titleTemplate: "Pembayaran Menunggu",
      messageTemplate:
        "Pembayaran untuk pesanan #{orderNumber} menunggu konfirmasi.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "PAYMENT_PROCESSED",
      channel: "IN_APP" as const,
      titleTemplate: "Pembayaran Diproses",
      messageTemplate:
        "Pembayaran Anda untuk pesanan #{orderNumber} sedang diproses.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "PAYMENT_REJECTED",
      channel: "IN_APP" as const,
      titleTemplate: "Pembayaran Ditolak",
      messageTemplate:
        "Pembayaran untuk pesanan #{orderNumber} ditolak. Silakan hubungi admin.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },
    {
      typeCode: "PAYMENT_COMPLETED",
      channel: "IN_APP" as const,
      titleTemplate: "Pembayaran Selesai",
      messageTemplate: "Pembayaran untuk pesanan #{orderNumber} telah selesai.",
      supportedVariables: JSON.stringify(["orderNumber"]),
    },

    // Member & Auth
    {
      typeCode: "MEMBER_REGISTERED",
      channel: "IN_APP" as const,
      titleTemplate: "Selamat Datang di CusCuciin!",
      messageTemplate:
        "Halo {memberName}, akun Anda telah berhasil didaftarkan. Silakan verifikasi email Anda.",
      supportedVariables: JSON.stringify(["memberName"]),
    },
    {
      typeCode: "EMAIL_VERIFIED",
      channel: "IN_APP" as const,
      titleTemplate: "Email Terverifikasi",
      messageTemplate:
        "Email Anda telah berhasil diverifikasi. Selamat menggunakan layanan CusCuciin!",
      supportedVariables: JSON.stringify([]),
    },
    {
      typeCode: "PASSWORD_RESET",
      channel: "IN_APP" as const,
      titleTemplate: "Password Berhasil Direset",
      messageTemplate: "Password akun Anda telah berhasil diubah.",
      supportedVariables: JSON.stringify([]),
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
