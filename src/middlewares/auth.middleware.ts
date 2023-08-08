import express from "express";
import { User } from "@prisma/client";
import _ from "lodash";
import JWT from "../helpers/jwt.helper";
import AuthService from "../app/auth/auth.service";
import logger from "../configs/logger.config";

import {
  ACCESS_TOKEN_MAX_AGE,
  CLIENT_DOMAIN,
  MODE,
} from "../configs/vars.config";
import { ISession } from "../utils/types/interfaces";

const authService = new AuthService();

interface IUserReq extends Omit<User, "password"> {
  session?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUserReq;
    }
  }
}

function getTokens(req: express.Request): {
  accessToken: string;
  refreshToken: string;
} {
  let accessToken = req.cookies?.accessToken as string;
  let refreshToken = req.cookies?.refreshToken as string;

  if (req.get("user-agent")?.includes("Postman")) {
    logger.info("[SESSIN] Get refreshToken & accessToken using req headers");
    refreshToken = _.get(req, "headers.x-refresh") as string;
    accessToken = _.get(req, "headers.authorization", "").replace(
      /^Bearer\s/,
      ""
    );
  }

  return { accessToken, refreshToken };
}

function setNewAccessTokenCookie(
  req: express.Request,
  res: express.Response,
  accessToken: string
) {
  const userAgent = req.get("user-agent");

  // res.cookie("accessToken", accessToken, {
  //   maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
  //   sameSite: "strict",
  //   path: "/",
  // });
  res.cookie("accessToken", accessToken, {
    maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
    httpOnly: true,
    sameSite: MODE === "development" ? "strict" : "lax",
    path: "/",
    secure: MODE !== "development",
    // domain: MODE === "development" ? undefined : CLIENT_DOMAIN,
  });
  if (userAgent?.includes("Postman")) {
    logger.info("[SESSION] Set x-access-token for Postman");
    res.setHeader("x-access-token", accessToken);
  }
}

export async function deserializeUser(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const { accessToken, refreshToken } = getTokens(req);
    logger.info(
      { accessToken, refreshToken },
      "[SESSION] Status AccessToken & RefreshToken"
    );
    if (!accessToken) {
      const { decoded: refresh } = refreshToken
        ? JWT.verifyJWT<ISession>(refreshToken)
        : { decoded: null };

      if (!refresh) {
        logger.warn("[SESSION] No authorized (!accessToken && !refreshToken)");
        return next();
      }

      const session = await new AuthService().findValidSessionById(
        refresh.session
      );

      if (!session) {
        logger.warn("[SESSION] Session not found");
        return next();
      }

      const newAccessToken = await authService.reIssueAccessToken({
        refreshToken,
      });

      if (newAccessToken) {
        setNewAccessTokenCookie(req, res, newAccessToken as string);

        const result = JWT.verifyJWT<ISession>(
          (newAccessToken as string) || ""
        );
        const user = await authService.getSessionUser(
          result.decoded?.userId as string
        );
        req.user = {
          ...user,
          session: result?.decoded?.session as string,
        } as IUserReq;
        logger.info(
          "[SESSION] Expired access token & generated new access token"
        );
      } else {
        logger.warn(
          `[SESSION] Expired access token & try to generated new access token but it failed`
        );
      }
      return next();
    }

    const { decoded: decodedAccess, expired } =
      JWT.verifyJWT<ISession>(accessToken);

    // For a valid access token
    if (decodedAccess) {
      const validSessionWithAccessToken =
        await new AuthService().findValidSessionById(decodedAccess.session);

      if (!validSessionWithAccessToken) {
        logger.warn("[SESSION] Session not found (accessToken)");
        return next();
      }

      const currentUser = (await authService.getSessionUser(
        validSessionWithAccessToken.userId
      )) as User;

      req.user = {
        ..._.omit(currentUser, "password"),
        session: validSessionWithAccessToken.sessionId,
      } as IUserReq;
      logger.info(
        {
          userId: currentUser.userId,
          email: currentUser.email,
          name: currentUser.name,
          session: validSessionWithAccessToken.sessionId,
          userAgent: req.get("user-agent") as string,
        },
        `[SESSION] Session found and return current user data`
      );
      logger.info(
        `[SESSION] current user is ${currentUser.name}:${currentUser.email} `
      );

      return next();
    }

    const { decoded: decodedRefreshToken } =
      expired && refreshToken
        ? JWT.verifyJWT<ISession>(refreshToken)
        : { decoded: null };

    if (!decodedRefreshToken) {
      logger.warn("[SESSION] No authorized (!decodedRefreshToken)");
      return next();
    }

    const validSessionWithRefreshToken = await authService.findValidSessionById(
      decodedRefreshToken.session
    );

    if (!validSessionWithRefreshToken) {
      logger.warn(
        "[SESSION] Session not found (!validSessionWithRefreshToken)"
      );
      return next();
    }

    const newAccessToken = await authService.reIssueAccessToken({
      refreshToken,
    });

    if (newAccessToken) {
      const { decoded: newDecodedAccessToken } = JWT.verifyJWT<ISession>(
        (newAccessToken as string) || ""
      );
      const user = await authService.getSessionUser(
        newDecodedAccessToken?.userId as string
      );

      req.user = {
        ..._.omit(user, "password"),
        session: newDecodedAccessToken?.session as string,
      } as IUserReq;
      setNewAccessTokenCookie(req, res, newAccessToken as string);
      logger.info("[SESSION] Generated new access token");
    } else {
      logger.warn(`[SESSION] Try to generated new access token but it failed`);
    }
    return next();
  } catch (error) {
    logger.error(error, "[SESSION] deserialize user failed");
    next();
  }
}

export function requiredUser(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const user = req.user;
  if (!user) {
    return res.status(403).json({
      name: "NOT_AUTH",
      message: "Not authorized!",
    });
  }

  return next();
}
