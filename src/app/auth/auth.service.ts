import express from "express";
import { User } from "@prisma/client";
import { omit, get } from "lodash";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseService } from "../../core";
import { comparePassword, hashPassword } from "../../utils/auth.utils";
import JWT from "../../helpers/jwt.helper";
import prismaCfg from "../../configs/prisma.config";
import {
  ACCESS_TOKEN_MAX_AGE,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_MAX_AGE,
  REFRESH_TOKEN_TTL,
} from "../../configs/vars.config";
import { dateUTC } from "../../configs/date.config";

export interface IInputSession {
  userId: string;
  userAgent: string;
  ipAddress: string;
  deviceType: string;
  valid: boolean;
}

@BindAllMethods
class AuthService extends BaseService {
  constructor() {
    super();
  }

  public async signUpUser(
    input: Omit<User, "user_id" | "created_at" | "updated_at">
  ) {
    try {
      const existEmail = await this.prisma.user.findUnique({
        where: {
          email: input.email,
        },
      });
      if (existEmail) {
        throw this.error(
          "DUPLICATE_ENTRY_ERR",
          409,
          `Email ${input.email} telah terdaftar`
        );
      }

      const user = await this.prisma.$transaction(async prismaTx => {
        const userId = await this.generateIncField({
          prismaTx: prismaTx,
          tableName: "tb_users",
          field: "user_id",
        });

        const newUser = {
          user_id: userId as string,
          name: input.name,
          email: input.email,
          password: await hashPassword(input.password),
          role: input.role,
          status: input.status,
          avatar: input.avatar,
        } as User;

        return await prismaTx.user.create({
          data: newUser,
        });
      });

      return omit(user, "password");
    } catch (error: any) {
      this.throwError(error);
    }
  }

  public async validateEmailAndPassword(
    input: Pick<User, "email" | "password">
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: input.email,
        },
      });

      if (!user) {
        return false;
      }

      const isValid = await comparePassword(input.password, user.password);

      if (!isValid) return false;

      return omit(user, "password");
    } catch (error) {
      this.logger.error(`[EXCEPTION] validateEmailAndPassword`);
      return false;
    }
  }

  public async createSession(input: IInputSession) {
    const { userId, userAgent, valid, ipAddress, deviceType } = input;
    try {
      return await this.prisma.session.create({
        data: {
          user_id: userId,
          user_agent: userAgent,
          valid: valid,
          ip_address: ipAddress,
          device_type: deviceType,
          expired: dateUTC().day(7).toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] updateSessionStatusById`);
      this.throwError(error);
    }
  }

  public async findUserSessions({
    userId,
    userAgent,
    ipAddress,
    deviceType,
    valid,
  }: { valid?: boolean } & Omit<IInputSession, "valid">) {
    try {
      return await this.prisma.session.findMany({
        where: {
          user_id: userId,
          user_agent: userAgent,
          ip_address: ipAddress,
          device_type: deviceType,
          valid: valid,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] findUserSessions`);
      this.throwError(error);
    }
  }

  public setSessionToken(
    res: express.Response,
    { user, sessionId }: { user: Omit<User, "password">; sessionId: string }
  ): { accessToken: string; refreshToken: string } {
    const data = { ...user, session: sessionId };
    const accessToken = JWT.signJWT(
      data,
      { expiresIn: ACCESS_TOKEN_TTL } // 15m
    );

    const refreshToken = JWT.signJWT(
      data,
      { expiresIn: REFRESH_TOKEN_TTL } // 7d
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    res.cookie("accessToken", accessToken, {
      maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
      sameSite: "strict",
      path: "/",
      httpOnly: true,
    });

    return { accessToken, refreshToken };
  }

  // findSessionById
  public async findSessionById(sessionId: string) {
    try {
      return await this.prisma.session.findUnique({
        where: {
          id: sessionId,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] findSessionById`);
      this.throwError(error);
    }
  }

  public async findValidSessionById(sessionId: string) {
    try {
      return await this.prisma.session.findFirst({
        where: {
          id: sessionId,
          valid: true,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] findSessionById`);
      this.throwError(error);
    }
  }

  public async updateSessionStatusById(
    sessionId: string,
    isValid: boolean = true
  ) {
    try {
      return this.prisma.session.update({
        where: {
          id: sessionId,
        },
        data: {
          valid: isValid,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] updateSessionStatusById`);
      this.throwError(error);
    }
  }

  public async getSessionUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) return null;

    return user;
  }

  public async reIssueAccessToken({
    refreshToken,
  }: {
    refreshToken: string;
  }): Promise<string | boolean> {
    const prisma = prismaCfg;
    const { decoded } = JWT.verifyJWT(refreshToken);

    if (!decoded || !get(decoded, "session")) return false;

    const session = await this.prisma.session.findUnique({
      where: {
        id: get(decoded, "session"),
      },
    });

    if (!session || !session.valid) return false;

    const user = await this.prisma.user.findUnique({
      where: {
        user_id: session.user_id,
      },
    });

    if (!user) return false;

    const accessToken = JWT.signJWT(
      {
        ...user,
        session: session.id,
      },
      { expiresIn: ACCESS_TOKEN_TTL } // 15m
    );

    return accessToken;
  }
}

export default AuthService;
