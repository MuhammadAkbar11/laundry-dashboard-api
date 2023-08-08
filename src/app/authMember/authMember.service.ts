import express from "express";
import {
  Prisma,
  Session,
  Member,
  MemberSession,
  CustomerLevel,
} from "@prisma/client";
import { omit, get } from "lodash";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseService } from "../../core";
import { comparePassword, hashPassword } from "../../utils/auth.utils";
import JWT from "../../helpers/jwt.helper";
import {
  ACCESS_TOKEN_MAX_AGE,
  ACCESS_TOKEN_TTL,
  CLIENT_DOMAIN,
  MODE,
  REFRESH_TOKEN_MAX_AGE,
  REFRESH_TOKEN_TTL,
} from "../../configs/vars.config";
import { dateUTC } from "../../configs/date.config";

@BindAllMethods
class AuthMemberService extends BaseService {
  constructor() {
    super();
    this.table = {
      name: "tb_members",
      primaryKey: "member_id",
      lengthPKValue: 6,
    };
  }

  public async signUpMember(
    payload: Omit<Prisma.MemberCreateInput, "memberId">
  ) {
    try {
      const existEmail = await this.prisma.member.findUnique({
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

      const member = await this.prisma.$transaction(async prismaTx => {
        const customerLevel = (await prismaTx.customerLevel.findFirst({
          where: { name: "Basic" },
        })) as CustomerLevel;

        const customerId = await this.generateIncField({
          prismaTx: prismaTx,
          tableName: "tb_customers",
          field: "customer_id",
          length: 8,
        });
        const data: Omit<Prisma.CustomerCreateInput, "customerLevel"> & {
          customerLevelId: string;
        } = {
          customerId,
          name: payload.username,
          address: "NULL",
          phone: "NULL",
          customerLevelId: customerLevel?.customerLevelId as string,
          point: 0,
        };
        const createdCustomer = await prismaTx.customer.create({ data });

        const memberId = await this.createPrimaryKeyValue(prismaTx);

        const newMember = {
          memberId: memberId as string,
          username: payload.username,
          email: payload.email,
          password: await hashPassword(payload.password),
          status: payload.status,
          avatar: payload.avatar,
          customerId: createdCustomer?.customerId,
        } as Member;

        return await prismaTx.member.create({
          data: newMember,
        });
      });

      return omit(member, "password");
    } catch (error: any) {
      this.throwError(error);
    }
  }

  public async validateEmailAndPassword(
    input: Pick<Member, "email" | "password">
  ) {
    try {
      const member = await this.prisma.member.findUnique({
        where: {
          email: input.email,
        },
      });

      if (!member) {
        return false;
      }

      const isValid = await comparePassword(input.password, member.password);

      if (!isValid) return false;

      return omit(member, "password");
    } catch (error) {
      this.logger.error(`[EXCEPTION] validateEmailAndPassword`);
      return false;
    }
  }

  public async createMemberSession(
    input: Omit<
      Prisma.MemberSessionCreateInput,
      "memberSessionId" | "expired" | "member"
    > & {
      memberId: string;
    }
  ) {
    const { memberId, userAgent, valid, ipAddress, deviceType } = input;
    try {
      return await this.prisma.memberSession.create({
        data: {
          memberId: memberId,
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

  public async findMemberSessions({
    memberId,
    userAgent,
    ipAddress,
    deviceType,
    valid,
  }: Pick<
    MemberSession,
    "memberId" | "userAgent" | "ipAddress" | "deviceType"
  > & { valid?: boolean }) {
    try {
      return await this.prisma.memberSession.findMany({
        where: {
          memberId: memberId,
          userAgent: userAgent,
          ipAddress: ipAddress,
          deviceType: deviceType,
          valid: valid,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] findMemberSessions`);
      this.throwError(error);
    }
  }

  public setSessionToken(
    res: express.Response,
    {
      member,
      sessionId,
    }: { member: Omit<Member, "password">; sessionId: string }
  ): { accessToken: string; refreshToken: string } {
    const data = { ...member, session: sessionId };
    const accessToken = JWT.signJWT(
      data,
      { expiresIn: ACCESS_TOKEN_TTL } // 15m
    );

    const refreshToken = JWT.signJWT(
      data,
      { expiresIn: REFRESH_TOKEN_TTL } // 7d
    );

    // res.cookie("refreshToken", refreshToken, {
    //   httpOnly: true,
    //   sameSite: MODE === "development" ? "strict" : "none",
    //   path: "/",
    //   maxAge: REFRESH_TOKEN_MAX_AGE,
    // });

    // res.cookie("accessToken", accessToken, {
    //   maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
    //   sameSite: MODE === "development" ? "strict" : "none",
    //   path: "/",
    //   httpOnly: true,
    // });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: MODE === "development" ? "strict" : "lax",
      path: "/",
      secure: MODE === "development" ? false : true,
      domain: MODE === "development" ? undefined : CLIENT_DOMAIN,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    res.cookie("accessToken", accessToken, {
      maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
      httpOnly: true,
      sameSite: MODE === "development" ? "strict" : "lax",
      path: "/",
      secure: MODE === "development" ? false : true,
      domain: MODE === "development" ? undefined : CLIENT_DOMAIN,
    });

    return { accessToken, refreshToken };
  }

  public resetSessionToken(res: express.Response) {
    res.cookie("refreshToken", null, {
      httpOnly: true,
      sameSite: MODE === "development" ? "strict" : "lax",
      path: "/",
    });

    res.cookie("accessToken", null, {
      sameSite: MODE === "development" ? "strict" : "lax",
      path: "/",
      httpOnly: true,
    });
    // res.cookie("refreshToken", null, {
    //   httpOnly: true,
    //   sameSite: MODE === "development" ? "strict" : "none",

    //   path: "/",
    // });

    // res.cookie("accessToken", null, {
    //   sameSite: MODE === "development" ? "strict" : "none",

    //   path: "/",
    //   httpOnly: true,
    // });
  }

  // findSessionById
  public async findMemberSessionById(sessionId: string) {
    try {
      return await this.prisma.memberSession.findUnique({
        where: {
          memberSessionId: sessionId,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] findMemberSessionById`);
      this.throwError(error);
    }
  }

  public async findValidMemberSessionById(memberSessionId: string) {
    try {
      return await this.prisma.memberSession.findFirst({
        where: {
          memberSessionId: memberSessionId,
          valid: true,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] findValideMemberSessionById`);
      this.throwError(error);
    }
  }

  public async updateMemberSessionStatusById(
    memberSessionId: string,
    isValid: boolean = true
  ) {
    try {
      return this.prisma.memberSession.update({
        where: {
          memberSessionId: memberSessionId,
        },
        data: {
          valid: isValid,
        },
      });
    } catch (error) {
      this.logger.error(`[EXCEPTION] updateMemberSessionStatusById`);
      this.throwError(error);
    }
  }

  public async getSessionMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { memberId: memberId },
    });

    if (!member) return null;

    return member;
  }

  public async reIssueAccessToken({
    refreshToken,
  }: {
    refreshToken: string;
  }): Promise<string | boolean> {
    const { decoded } = JWT.verifyJWT(refreshToken);

    if (!decoded || !get(decoded, "session")) return false;

    const session = await this.prisma.memberSession.findUnique({
      where: {
        memberSessionId: get(decoded, "session"),
      },
    });

    if (!session || !session.valid) return false;

    const member = await this.prisma.member.findUnique({
      where: {
        memberId: session.memberId,
      },
    });

    if (!member) return false;

    const accessToken = JWT.signJWT(
      {
        ...member,
        session: session.memberSessionId,
      },
      { expiresIn: ACCESS_TOKEN_TTL } // 15m
    );

    return accessToken;
  }
}

export default AuthMemberService;
