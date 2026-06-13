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
import {
  comparePassword,
  hashPassword,
  generateResetToken,
  hashResetToken,
} from "../../utils/auth.utils";
import JWT from "../../helpers/jwt.helper";
import {
  ACCESS_TOKEN_MAX_AGE,
  ACCESS_TOKEN_TTL,
  ALLOWED_ORIGINS,
  CLIENT_DOMAIN,
  MODE,
  REFRESH_TOKEN_MAX_AGE,
  REFRESH_TOKEN_TTL,
  RESET_TOKEN_EXPIRY_MINUTES,
  VERIFICATION_TOKEN_EXPIRY_HOURS,
} from "../../configs/vars.config";
import { dateUTC } from "../../configs/date.config";
import EmailService from "../../services/email/email.service";
import NotificationService from "../../services/notification/notification.service";

@BindAllMethods
class AuthMemberService extends BaseService {
  private notificationService = new NotificationService();

  constructor() {
    super();
    this.table = {
      name: "tb_members",
      primaryKey: "member_id",
      lengthPKValue: 6,
    };
  }

  public async signUpMember(
    payload: Omit<Prisma.MemberCreateInput, "memberId">,
  ): Promise<Omit<Member, "password">> {
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
          `Email ${payload.email} telah terdaftar`,
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

      // Welcome notification for the new member.
      await this.notificationService.notifyMember(
        member.memberId,
        "MEMBER_REGISTERED",
        { memberName: member.username },
      );

      // Notify admins about new member registration.
      await this.notificationService.notifyAllUsers(
        "NEW_MEMBER",
        { memberName: member.username },
      );

      return omit(member, "password");
    } catch (error: any) {
      this.throwError(error);
    }
  }

  public async validateEmailAndPassword(
    input: Pick<Member, "email" | "password">,
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
    },
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
    }: { member: Omit<Member, "password">; sessionId: string },
  ): { accessToken: string; refreshToken: string } {
    const data = { ...member, session: sessionId };
    const accessToken = JWT.signJWT(
      data,
      { expiresIn: ACCESS_TOKEN_TTL }, // 15m
    );

    const refreshToken = JWT.signJWT(
      data,
      { expiresIn: REFRESH_TOKEN_TTL }, // 7d
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
      sameSite: MODE !== "development" ? "none" : "strict",
      path: "/",
      secure: MODE !== "development",
      domain: MODE !== "development" ? CLIENT_DOMAIN : undefined,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    res.cookie("accessToken", accessToken, {
      maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
      httpOnly: true,
      sameSite: MODE !== "development" ? "none" : "strict",
      path: "/",
      secure: MODE !== "development",
      domain: MODE !== "development" ? CLIENT_DOMAIN : undefined,
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
    isValid: boolean = true,
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
      { expiresIn: ACCESS_TOKEN_TTL }, // 15m
    );

    return accessToken;
  }

  /**
   * Create a verification token, store its hash, and send a
   * verification email to the member. Used during registration
   * and when resending verification.
   */
  async sendVerificationEmail(memberId: string): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { memberId },
    });
    if (!member) return;

    const { rawToken, tokenHash } = generateResetToken();
    const expiresAt = dateUTC()
      .add(VERIFICATION_TOKEN_EXPIRY_HOURS, "hour")
      .toISOString();

    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        memberId: member.memberId,
        expiresAt,
      },
    });

    const clientUrl =
      MODE !== "development" ? CLIENT_DOMAIN : ALLOWED_ORIGINS.split("|")[0];
    const verifyUrl = `${clientUrl}/verify-email?token=${rawToken}`;

    const emailService = new EmailService();
    await emailService.sendTemplated(
      "auto",
      {
        id: "verify-email",
        options: {
          memberName: member.username,
          verifyUrl,
          expiresInHours: VERIFICATION_TOKEN_EXPIRY_HOURS,
        },
      },
      { to: member.email },
    );
  }

  /**
   * Validate a verification token, activate the member account,
   * and mark the token as used. Throws if invalid, expired, or
   * already used.
   */
  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashResetToken(token);

    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

    if (!verificationToken) {
      throw this.error("AUTH", 400, "Token verifikasi tidak valid");
    }

    if (verificationToken.usedAt) {
      throw this.error("AUTH", 400, "Token verifikasi sudah digunakan");
    }

    if (new Date(verificationToken.expiresAt) < new Date()) {
      throw this.error("AUTH", 400, "Token verifikasi sudah kedaluwarsa");
    }

    await this.prisma.$transaction([
      this.prisma.member.update({
        where: { memberId: verificationToken.memberId },
        data: { status: "ACTIVE" },
      }),
      this.prisma.emailVerificationToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
    ]);

    // Notify member about successful email verification.
    await this.notificationService.notifyMember(
      verificationToken.memberId,
      "EMAIL_VERIFIED",
      {},
    );
  }

  /**
   * Resend a verification email. Invalidates any existing active
   * tokens for the member before creating a new one.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const member = await this.prisma.member.findUnique({ where: { email } });
    if (!member) {
      throw this.error("AUTH", 404, "Email tidak terdaftar");
    }

    if (member.status !== "PENDING") {
      throw this.error(
        "AUTH",
        400,
        "Akun sudah aktif atau tidak memerlukan verifikasi",
      );
    }

    // Soft-delete old active tokens by marking them used so they
    // cannot be replayed.
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        memberId: member.memberId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await this.sendVerificationEmail(member.memberId);
  }

  /**
   * Generate a password reset token for a member account. Sends a
   * reset email if the account exists. Always returns silently to
   * prevent email enumeration.
   */
  async forgotPassword(email: string): Promise<void> {
    const member = await this.prisma.member.findUnique({ where: { email } });
    if (!member) return;

    const { rawToken, tokenHash } = generateResetToken();
    const expiresAt = dateUTC()
      .add(RESET_TOKEN_EXPIRY_MINUTES, "minute")
      .toISOString();

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        memberId: member.memberId,
        expiresAt,
      },
    });

    const clientUrl =
      MODE !== "development" ? CLIENT_DOMAIN : ALLOWED_ORIGINS.split("|")[0];
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

    const emailService = new EmailService();
    await emailService.sendTemplated(
      "auto",
      {
        id: "password-reset",
        options: {
          memberName: member.username,
          resetUrl,
          expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
        },
      },
      { to: member.email },
    );
  }

  /**
   * Validate a reset token and update the member's password. Throws
   * if the token is invalid, expired, or already used.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashResetToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken) {
      throw this.error("AUTH", 400, "Token reset password tidak valid");
    }

    if (resetToken.usedAt) {
      throw this.error("AUTH", 400, "Token reset password sudah digunakan");
    }

    if (new Date(resetToken.expiresAt) < new Date()) {
      throw this.error("AUTH", 400, "Token reset password sudah kedaluwarsa");
    }

    if (!resetToken.memberId) {
      throw this.error("AUTH", 400, "Token reset password tidak valid");
    }

    const hashedPassword = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.member.update({
        where: { memberId: resetToken.memberId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
    ]);

    // Notify member about successful password reset.
    await this.notificationService.notifyMember(
      resetToken.memberId,
      "PASSWORD_RESET",
      {},
    );
  }
}

export default AuthMemberService;