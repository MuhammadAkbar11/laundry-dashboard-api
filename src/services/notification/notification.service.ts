import { Prisma } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseService } from "../../core";

@BindAllMethods
class NotificationService extends BaseService {
  constructor() {
    super();
  }

  /**
   * Render template by replacing {variable} placeholders
   * with values from the provided record.
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
   * Resolve the active notification type and IN_APP template, returning the
   * rendered title/message plus the type id. Returns null when the type or
   * template is missing or inactive so callers can silently skip.
   */
  private async resolveInAppTemplate(
    typeCode: string,
    variables: Record<string, string | number>
  ): Promise<{
    notificationTypeId: string;
    title: string;
    message: string;
  } | null> {
    const notificationType = await this.prisma.notificationType.findFirst({
      where: { code: typeCode, isActive: true },
    });
    if (!notificationType) return null;

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        notificationTypeId: notificationType.id,
        channel: "IN_APP",
        isActive: true,
      },
    });
    if (!template) return null;

    return {
      notificationTypeId: notificationType.id,
      title: this.renderTemplate(template.titleTemplate, variables),
      message: this.renderTemplate(template.messageTemplate, variables),
    };
  }

  /**
   * Create a notification using the active template for the given type,
   * render title and message, and assign it to a member.
   */
  async notifyMember(
    memberId: string,
    typeCode: string,
    variables: Record<string, string | number>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const resolved = await this.resolveInAppTemplate(typeCode, variables);
    if (!resolved) return;

    await this.prisma.notification.create({
      data: {
        notificationTypeId: resolved.notificationTypeId,
        title: resolved.title,
        message: resolved.message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        memberNotifications: {
          create: {
            memberId,
          },
        },
      },
    });
  }

  /**
   * Create a notification and assign it to a specific user.
   */
  async notifyUser(
    userId: string,
    typeCode: string,
    variables: Record<string, string | number>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const resolved = await this.resolveInAppTemplate(typeCode, variables);
    if (!resolved) return;

    await this.prisma.notification.create({
      data: {
        notificationTypeId: resolved.notificationTypeId,
        title: resolved.title,
        message: resolved.message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        userNotifications: {
          create: {
            userId,
            isGlobal: false,
          },
        },
      },
    });
  }

  /**
   * Create a global notification visible to all active users. Each
   * administrator gets their own recipient row so read state stays
   * isolated per user.
   */
  async notifyAllUsers(
    typeCode: string,
    variables: Record<string, string | number>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const resolved = await this.resolveInAppTemplate(typeCode, variables);
    if (!resolved) return;

    await this.prisma.$transaction(async tx => {
      const notification = await tx.notification.create({
        data: {
          notificationTypeId: resolved.notificationTypeId,
          title: resolved.title,
          message: resolved.message,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      const activeUsers = await tx.user.findMany({
        where: { status: "ACTIVE" },
        select: { userId: true },
      });

      if (activeUsers.length === 0) return;

      await tx.userNotification.createMany({
        data: activeUsers.map(u => ({
          notificationId: notification.id,
          userId: u.userId,
          isGlobal: true,
        })),
      });
    });
  }

  async markMemberNotificationAsRead(memberNotificationId: string): Promise<void> {
    try {
      await this.prisma.memberNotification.update({
        where: { id: memberNotificationId },
        data: { isRead: true, readAt: new Date() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw this.error(
          "NOT_FOUND",
          404,
          "Notifikasi tidak ditemukan"
        );
      }
      throw error;
    }
  }

  async markAllMemberNotificationsAsRead(memberId: string): Promise<void> {
    await this.prisma.memberNotification.updateMany({
      where: { memberId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark a single user notification as read. The userId guard prevents one
   * administrator from mutating another administrator's recipient row.
   */
  async markUserNotificationAsRead(
    userNotificationId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.prisma.userNotification.update({
        where: { id: userNotificationId, userId },
        data: { isRead: true, readAt: new Date() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw this.error(
          "NOT_FOUND",
          404,
          "Notifikasi tidak ditemukan"
        );
      }
      throw error;
    }
  }

  async markAllUserNotificationsAsRead(userId: string): Promise<void> {
    await this.prisma.userNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Fetch paginated notifications for a member including the rendered
   * notification details.
   */
  async getMemberNotifications(memberId: string, options: {
    skip?: number;
    take?: number;
  } = {}): Promise<any[]> {
    return this.prisma.memberNotification.findMany({
      where: { memberId },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
      include: { notification: true },
    });
  }

  async getMemberUnreadCount(memberId: string): Promise<number> {
    return this.prisma.memberNotification.count({
      where: { memberId, isRead: false },
    });
  }

  /**
   * Fetch paginated notifications for a user. With per-user recipient rows
   * the simpler userId scope already includes both direct assignments and
   * global notifications; the isGlobal flag is preserved on each row for
   * the UI to render the GLOBAL badge.
   */
  async getUserNotifications(userId: string, options: {
    skip?: number;
    take?: number;
  } = {}): Promise<any[]> {
    return this.prisma.userNotification.findMany({
      where: { userId },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
      include: { notification: true },
    });
  }

  async getUserUnreadCount(userId: string): Promise<number> {
    return this.prisma.userNotification.count({
      where: { userId, isRead: false },
    });
  }
}

export default NotificationService;
