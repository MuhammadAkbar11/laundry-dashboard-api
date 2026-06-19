import { NotificationTemplate, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";

export interface IPreviewSample {
  title: string;
  message: string;
  variablesUsed: string[];
}

@BindAllMethods
class NotificationTemplateService extends BaseService {
  constructor() {
    super();
  }

  /**
   * Render a template by replacing {variable} placeholders. Mirrors
   * the renderer in NotificationService so preview output matches
   * what the system will actually deliver.
   */
  private renderTemplate(
    template: string,
    variables: Record<string, string | number>
  ): string {
    return template.replace(/\{(\w+)\}/g, (_match, key) => {
      const value = variables[key];
      return value !== undefined && value !== null ? String(value) : "";
    });
  }

  /**
   * Parse `{var}` placeholders out of a template. Returns the
   * distinct variable names in the order they first appear.
   */
  private extractVariables(template: string): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const re = /\{(\w+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template)) !== null) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    }
    return ordered;
  }

  /**
   * Sample data for previewing templates that use a small, fixed
   * vocabulary. Avoids producing noisy output for variables the
   * type doesn't actually support.
   */
  private buildSampleVariables(supportedVariables: string[]): Record<string, string> {
    const samples: Record<string, string> = {
      title: "Pemberitahuan",
      message: "Detail notifikasi",
      memberName: "Contoh Pelanggan",
      userName: "Contoh Admin",
      role: "ADMIN",
      orderNumber: "LQ130626001",
      customerName: "Contoh Pelanggan",
      amount: "25.000",
      memberId: "MBR001",
    };
    const result: Record<string, string> = {};
    for (const name of supportedVariables) {
      if (samples[name] !== undefined) {
        result[name] = samples[name];
      }
    }
    return result;
  }

  /**
   * Normalize the raw Prisma row for the API: the `supportedVariables`
   * column is stored as a JSON-encoded TEXT string. Parse it to a
   * proper string[] so the API contract matches the INotificationTemplate
   * interface and consumers can `.map` directly.
   */
  private toApiShape(row: any): any {
    if (!row) return row;
    return {
      ...row,
      supportedVariables: this.parseSupportedVariables(row.supportedVariables),
    };
  }

  public async getAll(
    options?: Prisma.NotificationTemplateFindManyArgs
  ): Promise<any[] | void> {
    try {
      const rows = await this.prisma.notificationTemplate.findMany({
        ...options,
        include: {
          notificationType: true,
        },
        orderBy: {
          notificationType: { code: "asc" },
        },
      });
      return rows.map((r) => this.toApiShape(r));
    } catch (error) {
      this.logger.error("[EXCEPTION] getAllNotificationTemplates");
      this.throwError(error);
    }
  }

  public async getById(id: string): Promise<any | null> {
    try {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id },
        include: { notificationType: true },
      });
      if (!template) return null;
      return this.toApiShape(template);
    } catch (error) {
      this.logger.error("[EXCEPTION] getNotificationTemplateById");
      this.throwError(error);
    }
  }

  public async update(
    id: string,
    data: { titleTemplate: string; messageTemplate: string }
  ): Promise<NotificationTemplate> {
    try {
      const existing = await this.prisma.notificationTemplate.findUnique({
        where: { id },
      });
      if (!existing) {
        throw this.error(
          "NOT_FOUND",
          404,
          `Template notifikasi dengan ID '${id}' tidak ditemukan.`,
        );
      }

      this.assertVariablesAllowed(
        existing.supportedVariables,
        data.titleTemplate,
        data.messageTemplate,
      );

      return await this.prisma.notificationTemplate.update({
        where: { id },
        data: {
          titleTemplate: data.titleTemplate,
          messageTemplate: data.messageTemplate,
        },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] updateNotificationTemplate");
      this.throwError(error);
    }
  }

  public async resetToDefault(id: string): Promise<NotificationTemplate> {
    try {
      const existing = await this.prisma.notificationTemplate.findUnique({
        where: { id },
      });
      if (!existing) {
        throw this.error(
          "NOT_FOUND",
          404,
          `Template notifikasi dengan ID '${id}' tidak ditemukan.`,
        );
      }

      const defaultTitle =
        existing.defaultTitleTemplate ?? existing.titleTemplate;
      const defaultMessage =
        existing.defaultMessageTemplate ?? existing.messageTemplate;

      return await this.prisma.notificationTemplate.update({
        where: { id },
        data: {
          titleTemplate: defaultTitle,
          messageTemplate: defaultMessage,
        },
      });
    } catch (error) {
      this.logger.error("[EXCEPTION] resetNotificationTemplate");
      this.throwError(error);
    }
  }

  /**
   * Render title and message with sample data without persisting.
   * Returns the rendered strings plus the list of variables used.
   */
  public async preview(
    supportedVariablesJson: string | null,
    titleTemplate: string,
    messageTemplate: string
  ): Promise<IPreviewSample> {
    const supportedVariables = this.parseSupportedVariables(
      supportedVariablesJson
    );
    this.assertVariablesAllowed(
      supportedVariablesJson,
      titleTemplate,
      messageTemplate
    );

    const variables = this.buildSampleVariables(supportedVariables);
    const usedSet = new Set<string>();
    for (const name of this.extractVariables(titleTemplate)) usedSet.add(name);
    for (const name of this.extractVariables(messageTemplate))
      usedSet.add(name);

    const used = Array.from(usedSet);

    return {
      title: this.renderTemplate(titleTemplate, variables),
      message: this.renderTemplate(messageTemplate, variables),
      variablesUsed: used,
    };
  }

  /**
   * Reject any `{var}` placeholder not in the template's declared
   * supported variables. Empty string is also treated as a
   * supported variable in templates that opt in.
   */
  public assertVariablesAllowed(
    supportedVariablesJson: string | null,
    titleTemplate: string,
    messageTemplate: string
  ): void {
    const supported = new Set(
      this.parseSupportedVariables(supportedVariablesJson)
    );

    const unknown: string[] = [];
    for (const name of this.extractVariables(titleTemplate)) {
      if (!supported.has(name)) unknown.push(name);
    }
    for (const name of this.extractVariables(messageTemplate)) {
      if (!supported.has(name)) unknown.push(name);
    }
    if (unknown.length > 0) {
      const uniqueUnknown = Array.from(new Set(unknown));
      throw this.error(
        "VALIDATION",
        400,
        `Variabel tidak dikenal pada template: ${uniqueUnknown.join(", ")}`
      );
    }
  }

  private parseSupportedVariables(json: string | null): string[] {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
      return [];
    } catch {
      return [];
    }
  }
}

export default NotificationTemplateService;