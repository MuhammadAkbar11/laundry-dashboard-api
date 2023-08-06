import { User, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { BindAllMethods } from "../../utils/decorators.utils";
import { omit } from "lodash";
import { BaseService } from "../../core";
import { hashPassword } from "../../utils/auth.utils";

@BindAllMethods
class UserService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_users",
      primaryKey: "user_id",
      lengthPKValue: 6,
    };
  }

  public async getAll(
    options?: Prisma.UserFindManyArgs
  ): Promise<User[] | void> {
    try {
      return await this.prisma.user.findMany({ ...options });
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllUsers");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<User | void | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { userId: id },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] getUserById");
      this.throwError(error);
    }
  }

  public async create(
    payload: Omit<Prisma.UserCreateInput, "userId">
  ): Promise<Omit<User, "password"> | undefined> {
    try {
      const existEmail = await this.prisma.user.findUnique({
        where: {
          email: payload.email,
        },
      });
      if (existEmail) {
        throw this.error(
          "DUPLICATE_ENTRY_ERR",
          409,
          `Email ${payload.email} telah terdaftar`
        );
      }

      const createdUser = await this.prisma.$transaction(async trx => {
        const userId = await this.createPrimaryKeyValue(trx);
        const newUser = await trx.user.create({
          data: {
            userId: userId,
            email: payload.email,
            name: payload.name,
            password: await hashPassword(payload.password),
            role: payload.role || "ADMIN",
            avatar: payload.avatar,
            status: payload.status,
          },
        });
        return newUser;
      });
      return omit(createdUser, "password");
    } catch (error: any) {
      this.logger.error("[EXCEPTION] createUser");
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    payload: Omit<Prisma.UserUpdateInput, "userId">
  ): Promise<User | undefined> {
    try {
      return await this.prisma.user.update({
        where: { userId: id },
        data: payload,
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] updateLaundryService");
      this.throwError(error);
    }
  }

  public async count(args?: Prisma.UserCountArgs) {
    try {
      return await this.prisma.user.count({ ...args });
    } catch (error) {
      this.logger.error("[EXCEPTION] countUser");
      this.throwError(error);
    }
  }

  public async delete(id: string): Promise<User | undefined> {
    try {
      const result = await this.prisma.user.delete({
        where: { userId: id },
      });
      return result;
    } catch (error) {
      this.logger.error("[EXCEPTION] deleteUser");
      this.throwError(error);
    }
  }
}

export default UserService;
