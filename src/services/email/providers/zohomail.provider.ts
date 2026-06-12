import nodemailer from "nodemailer";
import { ZOHOMAIL, ZOHOMAIL_PW } from "../../../configs/vars.config";
import BaseError from "../../../helpers/error.helper";
import logger from "../../../configs/logger.config";
import type { IEmailProvider } from "./email-provider.interface";
import { registerProvider } from "./registry";

class ZohoMailProvider implements IEmailProvider {
  readonly id = "zohomail";
  readonly displayName = "ZohoMail SMTP";

  isConfigured(): boolean {
    return Boolean(ZOHOMAIL);
  }

  getDefaultFrom(): string {
    return ZOHOMAIL || "";
  }

  async createTransporter(): Promise<nodemailer.Transporter> {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 587,
        secure: false,
        auth: {
          user: ZOHOMAIL,
          pass: ZOHOMAIL_PW,
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

const zohomailProvider = new ZohoMailProvider();
registerProvider(zohomailProvider);
export default zohomailProvider;
