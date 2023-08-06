import * as prisma from "@prisma/client";

import { hashPassword } from "../../utils/auth.utils";
import GenerateAutoIncField from "../../helpers/autoincrement.helper";
import { omit } from "lodash";

const userData: Omit<prisma.User, "createdAt" | "updatedAt" | "userId">[] = [
  {
    email: "superadmin@gmail.com",
    name: "Superadmin",
    avatar: "/images/avatar.jpeg",
    password: "password123",
    role: "ADMIN",
    status: "ACTIVE",
  },
  {
    email: "admin@gmail.com",
    name: "Admin",
    avatar: "/images/avatar.jpeg",
    password: "password123",
    role: "OFFICER",
    status: "ACTIVE",
  },
  {
    email: "user@gmail.com",
    name: "User",
    avatar: "/images/avatar.jpeg",
    password: "password123",
    role: "OFFICER",
    status: "ACTIVE",
  },
];

export async function seedInitUsers(prismaTx: prisma.Prisma.TransactionClient) {
  const finalsersData: prisma.User[] = [];

  for (const user of userData) {
    const userId = await GenerateAutoIncField({
      prismaTx: prismaTx,
      tableName: "tb_users",
      field: "user_id",
      length: 6,
    });

    const data = {
      ...omit(user, "password", "role"),
      userId,
      password: await hashPassword(user.password),
      role: (user?.role as prisma.Role) || "ADMIN",
    } as prisma.User;

    finalsersData.push(data);
  }

  const createdUsers = await prismaTx.user.createMany({ data: finalsersData });

  return createdUsers;
}
