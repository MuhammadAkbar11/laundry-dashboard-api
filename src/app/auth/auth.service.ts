import express from "express";
import { Session, User } from "@prisma/client";
import { omit, get } from "lodash";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseService } from "../../core";
import { comparePassword, hashPassword } from "../../utils/auth.utils";
import JWT from "../../helpers/jwt.helper";
import {
  ACCESS_TOKEN_MAX_AGE,
  ACCESS_TOKEN_TTL,
  ALLOWED_ORIGINS,
  CLIENT_DOMAIN,
  MODE,
  REFRESH_TOKEN_MAX_AGE,
  REFRESH_TOKEN_TTL,
} from "../../configs/vars.config";
import { dateUTC } from "../../configs/date.config";

export interface ISessionPayload
  extends Omit<
    Session,
    "valid" | "createdAt" | "updatedAt" | "sessionId" | "expired"
  > {
  valid?: boolean;
}

export interface IUserPayload
  extends Omit<User, "userId" | "createdAt" | "updatedAt"> {}

@BindAllMethods
class AuthService extends BaseService {
  constructor() {
    super();
  }

  public async createSession(input: ISessionPayload) {
    const { userId, userAgent, valid, ipAddress, deviceType } = input;
    try {
      return await this.prisma.session.create({
        data: {
          userId: userId,
          userAgent: userAgent,
          valid: valid as boolean,
          ipAddress: ipAddress,
          deviceType: deviceType,
          expired: dateUTC().day(7).toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] updateSessionStatusById`);
      this.throwError(error);
    }
  }

  public async signUpUser(input: IUserPayload) {
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
          userId: userId as string,
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

  public async findUserSessions({
    userId,
    userAgent,
    ipAddress,
    deviceType,
    valid,
  }: { valid?: boolean } & ISessionPayload) {
    try {
      return await this.prisma.session.findMany({
        where: {
          userId: userId,
          userAgent: userAgent,
          ipAddress: ipAddress,
          deviceType: deviceType,
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
      sameSite: "none",
      path: "/",
      secure: MODE !== "development",
      domain: MODE === "development" ? undefined : CLIENT_DOMAIN,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    res.cookie("accessToken", accessToken, {
      maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
      httpOnly: true,
      sameSite: "none",
      path: "/",
      secure: MODE !== "development",
      domain: MODE === "development" ? undefined : CLIENT_DOMAIN,
    });

    return { accessToken, refreshToken };
  }

  public resetSessionToken(res: express.Response) {
    res.cookie("refreshToken", null, {
      httpOnly: true,
      sameSite: "none",
      path: "/",
    });

    res.cookie("accessToken", null, {
      sameSite: "none",
      path: "/",
      httpOnly: true,
    });
  }

  // findSessionById
  public async findSessionById(sessionId: string) {
    try {
      return await this.prisma.session.findUnique({
        where: {
          sessionId: sessionId,
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
          sessionId: sessionId,
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
          sessionId: sessionId,
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
      where: { userId: userId },
    });

    if (!user) return null;

    return user;
  }

  public async reIssueAccessToken({
    refreshToken,
  }: {
    refreshToken: string;
  }): Promise<string | boolean> {
    const { decoded } = JWT.verifyJWT(refreshToken);

    if (!decoded || !get(decoded, "session")) return false;

    const session = await this.prisma.session.findUnique({
      where: {
        sessionId: get(decoded, "session"),
      },
    });

    if (!session || !session.valid) return false;

    const user = await this.prisma.user.findUnique({
      where: {
        userId: session.userId,
      },
    });

    if (!user) return false;

    const accessToken = JWT.signJWT(
      {
        ...user,
        session: session.sessionId,
      },
      { expiresIn: ACCESS_TOKEN_TTL } // 15m
    );

    return accessToken;
  }
}

export default AuthService;
