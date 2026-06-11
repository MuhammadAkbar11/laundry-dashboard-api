import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import AuthService from "./auth.service";
import { SignInUserPayload, SignUpUserPayload } from "./auth.schema";
import { Role } from "@prisma/client";
import type { Details as UserAgentDetails } from "express-useragent";
import {
  DEFAULT_USER_AVATAR,
  ENV_STATIC_FOLDER_PATH,
  MODE,
} from "../../configs/vars.config";
import FileHelper from "../../helpers/file.helper";
import { BaseController } from "../../core";
import { userAgentDeviceType } from "../../utils/utils";
import { sanitizeText } from "../../utils/sanitizer.utils";
import _ from "lodash";

@BindAllMethods
class AuthController extends BaseController {
  private readonly service = new AuthService();
  constructor() {
    super();
  }

  public async postSignUpUser(
    req: Request<{}, {}, SignUpUserPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    const fileimgData = req.fileimg?.data;
    let avatar = DEFAULT_USER_AVATAR;

    try {
      if (fileimgData) {
        avatar = await FileHelper.resizeImageUpload(fileimgData, {
          prefix: "AVATAR",
          name: "USER",
        });
      }

      const user = await this.service.signUpUser({
        email: req.body.email,
        password: req.body.password,
        name: sanitizeText(req.body.name),
        role: req.body.role as Role,
        avatar: avatar,
        status: "PENDING",
      });
      return res.status(201).json({
        message: "Sign up successfully",
        user: user,
      });
    } catch (error: any) {
      if (fileimgData) {
        FileHelper.unlinkFile(ENV_STATIC_FOLDER_PATH + avatar, false);
      }
      this.nextError(next, error);
    }
  }

  public async postSignInUser(
    req: Request<{}, {}, SignInUserPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = await this.service.validateEmailAndPassword({
        email: req.body.email,
        password: req.body.password,
      });
      if (!user) {
        throw this.error("AUTH", 401, "Email atau Kata Sandi Tidak Valid");
      }

      const userId = user.userId as string;
      const userAgent = req.useragent as UserAgentDetails;
      const ipAddress = req.clientIp as string;
      const deviceType = userAgentDeviceType(userAgent);

      const existSession = await this.service.findUserSessions({
        userId,
        userAgent: userAgent.source as string,
        ipAddress,
        deviceType,
      });
      let session = null;

      if (existSession && existSession?.length !== 0) {
        const sessionId = existSession[0].sessionId as string;
        this.logger.info(existSession, "[AUTH] Session is found");
        await this.service.updateSessionStatusById(sessionId, true);
        session = await this.service.findSessionById(sessionId);
      } else {
        this.logger.info("[AUTH] No found session and created new session ");
        session = await this.service.createSession({
          userId: userId,
          userAgent: userAgent.source,
          valid: true,
          ipAddress,
          deviceType,
        });
      }
      this.logger.info(session, "[AUTH] session");
      if (session) {
        const sessionId = session.sessionId;
        const { refreshToken, accessToken } = this.service.setSessionToken(
          res,
          { user, sessionId: sessionId }
        );

        // Reset failed-login counter for this email + IP on success.
        if (req.resetAuthRateLimit) {
          void req.resetAuthRateLimit();
        }

        return res.status(200).json({
          message: `Berhasi login! Selamat datang ${user.name}`,
          user: { ...user, session: sessionId },
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
      const user = req.user;
      if (!user) {
        return res.status(404).json({
          message: "Failed to get user session",
          user: req.user ?? "TESS",
        });
      }

      const userId = user.userId;

      const session = await this.prisma.session.findFirst({
        where: { userId: userId, valid: true },
      });

      if (!session) {
        return res.status(401).json({
          message: "Session not found",
        });
      }

      // const user = await this.prisma.user.findFirst({where: {user_id: session.user_id}})

      return res.json({
        message: "Success to get user session",
        session: user,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async postSignOutUser(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;

      if (!user) {
        throw this.error(
          "AUTH",
          401,
          "Logout gagal! silahkan di coba lagi nanti"
        );
      }

      const userId = user.userId;

      const session = await this.prisma.session.findFirst({
        where: { userId: userId, valid: true },
      });

      if (!session) {
        throw this.error(
          "AUTH",
          401,
          "Logout gagal, silahkan dicoba lagi nanti!"
        );
      }

      await this.prisma.session.delete({
        where: {
          sessionId: session.sessionId,
        },
      });

      return res.json({
        message: "Logout berhasil, sampai jumpa lagi!",
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default AuthController;
