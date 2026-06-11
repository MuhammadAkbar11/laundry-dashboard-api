import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import type { Details as UserAgentDetails } from "express-useragent";
import { DEFAULT_USER_AVATAR, MODE } from "../../configs/vars.config";
import { BaseController } from "../../core";
import { userAgentDeviceType } from "../../utils/utils";
import { sanitizeText } from "../../utils/sanitizer.utils";
import _, { omit } from "lodash";
import AuthMemberService from "./authMember.service";
import { SignInMemberPayload, SignUpMemberPayload } from "./authMember.schema";

@BindAllMethods
class AuthMemberController extends BaseController {
  private readonly service = new AuthMemberService();
  constructor() {
    super();
  }

  public async postSignUpMember(
    req: Request<{}, {}, SignUpMemberPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    let avatar = DEFAULT_USER_AVATAR;
    this.logger.info("AUTH MEMBER CTRL");
    try {
      const user = await this.service.signUpMember({
        email: req.body.email,
        password: req.body.password,
        username: sanitizeText(req.body.username),
        avatar: avatar,
        status: "ACTIVE",
      });
      return res.status(201).json({
        message:
          "Selamat datang di layanan laundry kami. Terima kasih telah bergabung. Silakan login untuk mulai menggunakan layanan kami",
        user: user,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async postSignInUser(
    req: Request<{}, {}, SignInMemberPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const member = await this.service.validateEmailAndPassword({
        email: req.body.email,
        password: req.body.password,
      });
      if (!member) {
        throw this.error("AUTH", 401, "Email atau Kata Sandi Tidak Valid");
      }

      const memberId = member.memberId as string;
      const userAgent = req.useragent as UserAgentDetails;
      const ipAddress = req.clientIp as string;
      const deviceType = userAgentDeviceType(userAgent);

      const existSession = await this.service.findMemberSessions({
        memberId: memberId,
        userAgent: userAgent.source as string,
        ipAddress,
        deviceType,
      });
      let session = null;

      if (existSession && existSession?.length !== 0) {
        const memberSessionId = existSession[0].memberSessionId as string;
        this.logger.info(existSession, "[AUTH] Session is found");
        await this.service.updateMemberSessionStatusById(memberSessionId, true);
        session = await this.service.findMemberSessionById(memberSessionId);
      } else {
        this.logger.info("[AUTH] No found session and created new session ");
        session = await this.service.createMemberSession({
          memberId: memberId,
          userAgent: userAgent.source,
          valid: true,
          ipAddress,
          deviceType,
        });
      }
      this.logger.info(session, "[AUTH] session");
      if (session) {
        const sessionId = session.memberSessionId;
        const { refreshToken, accessToken } = this.service.setSessionToken(
          res,
          { member: member, sessionId: sessionId }
        );

        // Reset failed-login counter for this email + IP on success.
        if (req.resetAuthRateLimit) {
          void req.resetAuthRateLimit();
        }

        return res.status(200).json({
          message: `Berhasi login! Selamat Datang Kembali ${member.username}`,
          user: { ...member, session: sessionId },
          refreshToken: MODE === "development" ? refreshToken : null,
          accessToken: MODE === "development" ? accessToken : null,
        });
      }

      return res.status(200).json({
        message: "Login gagal",
        accessToken: null,
        refreshToken: null,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const member = req.member;
      if (!member) {
        return res.status(404).json({
          message: "Failed to get member session",
          member: req.member ?? "TESS",
        });
      }

      const memberId = member.memberId;

      const session = await this.prisma.memberSession.findFirst({
        where: { memberId: memberId, valid: true },
      });

      if (!session) {
        return res.status(401).json({
          message: "Session not found",
        });
      }

      return res.json({
        message: "Success to get user session",
        session: omit(member, "password"),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async postSignOutMember(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const member = req.member;

      if (!member) {
        throw this.error("AUTH", 401, "Logout Gagal! Silahkan Coba Lagi!");
      }

      const memberId = member.memberId;

      const session = await this.prisma.memberSession.findFirst({
        where: { memberId: memberId, valid: true },
      });

      if (!session) {
        throw this.error("AUTH", 401, "Logout Gagal! Silahkan Coba Lagi!");
      }

      await this.prisma.memberSession.delete({
        where: {
          memberSessionId: session.memberSessionId,
        },
      });

      return res.json({
        message: "Logout Berhasil! Sampai Jumpa Lagi",
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default AuthMemberController;
