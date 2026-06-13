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
   * Create a notification using the active template for the given type,
   * render title and message, and assign it to a member.
   */
  async notifyMember(
    memberId: string,
    typeCode: string,
    variables: Record<string, string | number>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const notificationType = await this.prisma.notificationType.findFirst({
      where: { code: typeCode, isActive: true },
    });
    if (!notificationType) return;

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        notificationTypeId: notificationType.id,
        channel: "IN_APP",
        isActive: true,
      },
    });
    if (!template) return;

    const title = this.renderTemplate(template.titleTemplate, variables);
    const message = this.renderTemplate(template.messageTemplate, variables);

    await this.prisma.notification.create({
      data: {
        notificationTypeId: notificationType.id,
        title,
        message,
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
    const notificationType = await this.prisma.notificationType.findFirst({
      where: { code: typeCode, isActive: true },
    });
    if (!notificationType) return;

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        notificationTypeId: notificationType.id,
        channel: "IN_APP",
        isActive: true,
      },
    });
    if (!template) return;

    const title = this.renderTemplate(template.titleTemplate, variables);
    const message = this.renderTemplate(template.messageTemplate, variables);

    await this.prisma.notification.create({
      data: {
        notificationTypeId: notificationType.id,
        title,
        message,
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
   * Create a global notification visible to all active users.
   */
  async notifyAllUsers(
    typeCode: string,
    variables: Record<string, string | number>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const notificationType = await this.prisma.notificationType.findFirst({
      where: { code: typeCode, isActive: true },
    });
    if (!notificationType) return;

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        notificationTypeId: notificationType.id,
        channel: "IN_APP",
        isActive: true,
      },
    });
    if (!template) return;

    const title = this.renderTemplate(template.titleTemplate, variables);
    const message = this.renderTemplate(template.messageTemplate, variables);

    await this.prisma.notification.create({
      data: {
        notificationTypeId: notificationType.id,
        title,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        userNotifications: {
          create: {
            isGlobal: true,
          },
        },
      },
    });
  }

  async markMemberNotificationAsRead(memberNotificationId: string): Promise<void> {
    await this.prisma.memberNotification.update({
      where: { id: memberNotificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllMemberNotificationsAsRead(memberId: string): Promise<void> {
    await this.prisma.memberNotification.updateMany({
      where: { memberId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markUserNotificationAsRead(userNotificationId: string): Promise<void> {
    await this.prisma.userNotification.update({
      where: { id: userNotificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllUserNotificationsAsRead(userId: string): Promise<void> {
    await this.prisma.userNotification.updateMany({
      where: {
        OR: [
          { userId, isRead: false },
          { isGlobal: true, isRead: false },
        ],
      },
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
   * Fetch paginated notifications for a user. Includes both direct
   * assignments and global notifications.
   */
  async getUserNotifications(userId: string, options: {
    skip?: number;
    take?: number;
  } = {}): Promise<any[]> {
    return this.prisma.userNotification.findMany({
      where: {
        OR: [{ userId }, { isGlobal: true }],
      },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
      include: { notification: true },
    });
  }

  async getUserUnreadCount(userId: string): Promise<number> {
    return this.prisma.userNotification.count({
      where: {
        OR: [{ userId }, { isGlobal: true }],
        isRead: false,
      },
    });
  }
}

export default NotificationService;
