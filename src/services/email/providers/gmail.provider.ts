import nodemailer from "nodemailer";
import { google } from "googleapis";
import {
  GMAIL,
  OAUTH_CLIENTID,
  OAUTH_CLIENT_SECRET,
  OAUTH_PLAYGROUND,
  OAUTH_REFRESH_TOKEN,
} from "../../../configs/vars.config";
import BaseError from "../../../helpers/error.helper";
import logger from "../../../configs/logger.config";
import type { IEmailProvider } from "./email-provider.interface";
import { registerProvider } from "./registry";

const OAuth2 = google.auth.OAuth2;

/**
 * Gmail OAuth2 provider (primary).
 */
class GmailProvider implements IEmailProvider {
  readonly id = "gmail";
  readonly displayName = "Gmail OAuth2";

  isConfigured(): boolean {
    return Boolean(GMAIL);
  }

  getDefaultFrom(): string {
    return GMAIL || "";
  }

  async createTransporter(): Promise<nodemailer.Transporter> {
    try {
      const oauth2Client = new OAuth2(
        OAUTH_CLIENTID,
        OAUTH_CLIENT_SECRET,
        OAUTH_PLAYGROUND,
      );

      oauth2Client.setCredentials({
        refresh_token: OAUTH_REFRESH_TOKEN,
      });

      const accessToken = await new Promise<string>((resolve, reject) => {
        return oauth2Client.getAccessToken((err: any, token) => {
          if (err) {
            const errors = new BaseError(
              "Error OAuth2",
              err.response.status,
              err.response.data?.error_description ||
                "Failed to create access token :(",
            );
            reject(errors);
          }
          resolve(token as string);
        });
      });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: GMAIL,
          accessToken,
          clientId: OAUTH_CLIENTID,
          clientSecret: OAUTH_CLIENT_SECRET,
          refreshToken: OAUTH_REFRESH_TOKEN,
        },
      });

      return transporter;
    } catch (error: any) {
      logger.error(error, `[NODEMAILER] ${error?.message}`);
      throw new BaseError(error.name, error.statusCode, error.message, {
        ...error,
      });
    }
  }
}

const gmailProvider = new GmailProvider();
registerProvider(gmailProvider);
export default gmailProvider;
