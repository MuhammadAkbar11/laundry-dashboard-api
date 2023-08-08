import express from "express";
import { Member } from "@prisma/client";
import _ from "lodash";
import JWT from "../helpers/jwt.helper";
import logger from "../configs/logger.config";
import {
  ACCESS_TOKEN_MAX_AGE,
  CLIENT_DOMAIN,
  MODE,
} from "../configs/vars.config";
import AuthMemberService from "../app/authMember/authMember.service";
import { IMemberSession } from "../utils/types/interfaces";

const authService = new AuthMemberService();

interface IMemberReq extends Omit<Member, "password"> {
  session?: string;
}

declare global {
  namespace Express {
    interface Request {
      member?: IMemberReq;
    }
  }
}

function getTokens(req: express.Request): {
  accessToken: string;
  refreshToken: string;
} {
  let accessToken = req.cookies?.accessToken as string;
  let refreshToken = req.cookies?.refreshToken as string;

  if (req.get("member-agent")?.includes("Postman")) {
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
  const memberAgent = req.get("member-agent");

  res.cookie("accessToken", accessToken, {
    maxAge: ACCESS_TOKEN_MAX_AGE, // 5 minutes
    httpOnly: true,
    sameSite: MODE === "development" ? "strict" : "lax",
    path: "/",
    secure: MODE === "development" ? false : true,
    domain: MODE === "development" ? undefined : CLIENT_DOMAIN,
  });
  if (memberAgent?.includes("Postman")) {
    logger.info("[SESSION][MEMBER] Set x-access-token for Postman");
    res.setHeader("x-access-token", accessToken);
  }
}

export async function deserializeMember(
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
        ? JWT.verifyJWT<IMemberSession>(refreshToken)
        : { decoded: null };

      if (!refresh) {
        logger.warn(
          "[SESSION][MEMBER] No authorized (!accessToken && !refreshToken)"
        );
        return next();
      }

      const session = await new AuthMemberService().findValidMemberSessionById(
        refresh?.session
      );

      if (!session) {
        logger.warn("[SESSION][MEMBER] Session not found");
        return next();
      }

      const newAccessToken = await authService.reIssueAccessToken({
        refreshToken,
      });

      if (newAccessToken) {
        setNewAccessTokenCookie(req, res, newAccessToken as string);

        const result = JWT.verifyJWT<IMemberSession>(
          (newAccessToken as string) || ""
        );
        const member = await authService.getSessionMember(
          result.decoded?.memberId as string
        );
        req.member = {
          ...member,
          session: result?.decoded?.session as string,
        } as IMemberReq;
        logger.info(
          "[SESSION][MEMBER] Expired access token & generated new access token"
        );
      } else {
        logger.warn(
          `[SESSION][MEMBER] Expired access token & try to generated new access token but it failed`
        );
      }
      return next();
    }

    const { decoded: decodedAccess, expired } =
      JWT.verifyJWT<IMemberSession>(accessToken);

    // For a valid access token
    if (decodedAccess) {
      const validSessionWithAccessToken =
        await new AuthMemberService().findValidMemberSessionById(
          decodedAccess.session
        );

      if (!validSessionWithAccessToken) {
        logger.warn("[SESSION][MEMBER] Session not found (accessToken)");
        return next();
      }

      const currentMember = (await authService.getSessionMember(
        validSessionWithAccessToken.memberId
      )) as Member;

      req.member = {
        ..._.omit(currentMember, "password"),
        session: validSessionWithAccessToken.memberSessionId,
      } as IMemberReq;
      logger.info(
        {
          memberId: currentMember.memberId,
          email: currentMember.email,
          username: currentMember.username,
          session: validSessionWithAccessToken.memberSessionId,
          memberAgent: req.get("member-agent") as string,
        },
        `[SESSION][MEMBER] Session found and return current member data`
      );
      logger.info(
        `[SESSION][MEMBER] current member is ${currentMember.username}:${currentMember.email} `
      );

      return next();
    }

    const { decoded: decodedRefreshToken } =
      expired && refreshToken
        ? JWT.verifyJWT<IMemberSession>(refreshToken)
        : { decoded: null };

    if (!decodedRefreshToken) {
      logger.warn("[SESSION][MEMBER] No authorized (!decodedRefreshToken)");
      return next();
    }

    const validSessionWithRefreshToken =
      await authService.findValidMemberSessionById(
        decodedRefreshToken?.session
      );

    if (!validSessionWithRefreshToken) {
      logger.warn(
        "[SESSION][MEMBER] Session not found (!validSessionWithRefreshToken)"
      );
      return next();
    }

    const newAccessToken = await authService.reIssueAccessToken({
      refreshToken,
    });

    if (newAccessToken) {
      const { decoded: newDecodedAccessToken } = JWT.verifyJWT<IMemberSession>(
        (newAccessToken as string) || ""
      );
      const member = await authService.getSessionMember(
        newDecodedAccessToken?.memberId as string
      );

      req.member = {
        ..._.omit(member, "password"),
        session: newDecodedAccessToken?.session as string,
      } as IMemberReq;
      setNewAccessTokenCookie(req, res, newAccessToken as string);
      logger.info("[SESSION][MEMBER] Generated new access token");
    } else {
      logger.warn(
        `[SESSION][MEMBER] Try to generated new access token but it failed`
      );
    }
    return next();
  } catch (error) {
    logger.error(error, "[SESSION][MEMBER] deserialize member failed");
    next();
  }
}

export function requiredMember(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const member = req.member;
  if (!member) {
    return res.status(403).json({
      name: "NOT_AUTH",
      message: "Not authorized!",
    });
  }

  return next();
}
