import { Prisma, Payment } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseService } from "../../core";
import { dateIndoWIB } from "../../configs/date.config";


type DashboardPeriod = "today" | "this_month" | "last_7_days" | "last_30_days";

interface LaundryQueueStatusSummary {
  status: string;
  count: number;
}

interface PaymentStatusSummary {
  status: string;
  count: number;
}

interface RecentOrder {
  orderNumber: string;
  customerName: string | null;
  status: string;
  createdAt: Date;
  total: number;
}

interface RecentMember {
  memberId: string;
  username: string;
  email: string;
  status: string;
  createdAt: Date;
}

interface RevenuePoint {
  date: string;
  revenue: number;
}

interface AdminDashboardData {
  kpi: {
    revenueToday: number;
    revenueThisMonth: number;
    activeOrders: number;
    finishedOrdersToday: number;
    newMembersThisMonth: number;
  };
  laundryStatusSummary: LaundryQueueStatusSummary[];
  paymentStatusSummary: PaymentStatusSummary[];
  revenueAnalytics: {
    labels: string[];
    data: number[];
    period: string;
  };
  recentOrders: RecentOrder[];
  recentMembers: RecentMember[];
}

interface MemberDashboardData {
  summary: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    totalSpending: number;
    currentMonthSpending: number;
  };
  activeLaundryQueues: RecentOrder[];
  recentOrders: RecentOrder[];
}

@BindAllMethods
class DashboardService extends BaseService {
  constructor() {
    super();
  }

  private startOfToday(): Date {
    return dateIndoWIB().startOf("day").toDate();
  }

  private endOfToday(): Date {
    return dateIndoWIB().endOf("day").toDate();
  }

  private startOfMonth(): Date {
    return dateIndoWIB().startOf("month").toDate();
  }

  private endOfMonth(): Date {
    return dateIndoWIB().endOf("month").toDate();
  }

  async getAdminDashboard(period?: string): Promise<AdminDashboardData> {
    const todayStart = this.startOfToday();
    const todayEnd = this.endOfToday();
    const monthStart = this.startOfMonth();
    const monthEnd = this.endOfMonth();
    const monthStartStr = dateIndoWIB().startOf("month").format();
    const monthEndStr = dateIndoWIB().endOf("month").format();
    const last7Start = dateIndoWIB().subtract(6, "day").startOf("day").toDate();
    const last30Start = dateIndoWIB().subtract(29, "day").startOf("day").toDate();

    // Revenue today
    const todayStartStr = dateIndoWIB().startOf("day").format();
    const todayEndStr = dateIndoWIB().endOf("day").format();
    const revenueTodayAgg = await this.prisma.payment.aggregate({
      _sum: { totalPrice: true },
      where: {
        createdAt: {
          gte: todayStartStr,
          lte: todayEndStr,
        },
      },
    });
    const revenueToday = Number(revenueTodayAgg._sum.totalPrice || 0);

    // Revenue this month
    const revenueMonthAgg = await this.prisma.payment.aggregate({
      _sum: { totalPrice: true },
      where: {
        createdAt: {
          gte: monthStartStr,
          lte: monthEndStr,
        },
      },
    });
    const revenueThisMonth = Number(revenueMonthAgg._sum.totalPrice || 0);

    // Active orders (not FINISHED and not CANCELED)
    const activeOrders = await this.prisma.laundryQueue.count({
      where: {
        status: { notIn: ["FINISHED", "CANCELED"] },
      },
    });

    // Finished orders today
    const finishedOrdersToday = await this.prisma.laundryQueue.count({
      where: {
        status: "FINISHED",
        finishedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // New members this month
    const newMembersThisMonth = await this.prisma.member.count({
      where: {
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Laundry status summary
    const laundryStatusSummary = await this.prisma.laundryQueue.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    // Payment status summary
    const paymentStatusSummary = await this.prisma.laundryQueue.groupBy({
      by: ["queuePaymentStatus"],
      _count: { queuePaymentStatus: true },
    });

    // Revenue analytics by period (default 7 days)
    const selectedPeriod = period || "7";
    const revenueAnalytics = await this.getRevenueAnalytics(selectedPeriod);

    // Recent orders
    const recentLaundryQueues = await this.prisma.laundryQueue.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });

    const recentOrders: RecentOrder[] = recentLaundryQueues.map(q => ({
      orderNumber: q.laundryQueueId,
      customerName: q.customer?.name || null,
      status: q.status,
      createdAt: q.createdAt,
      total: 0,
    }));

    // Recent members
    const recentMembersRaw = await this.prisma.member.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    const recentMembers: RecentMember[] = recentMembersRaw.map(m => ({
      memberId: m.memberId,
      username: m.username,
      email: m.email,
      status: m.status,
      createdAt: m.createdAt,
    }));

    return {
      kpi: {
        revenueToday,
        revenueThisMonth,
        activeOrders,
        finishedOrdersToday,
        newMembersThisMonth,
      },
      laundryStatusSummary: laundryStatusSummary.map(s => ({
        status: s.status,
        count: s._count.status,
      })),
      paymentStatusSummary: paymentStatusSummary.map(s => ({
        status: s.queuePaymentStatus,
        count: s._count.queuePaymentStatus,
      })),
      revenueAnalytics: revenueAnalytics,
      recentOrders,
      recentMembers,
    };
  }

  async getMemberDashboard(memberId: string): Promise<MemberDashboardData> {
    const member = await this.prisma.member.findUnique({
      where: { memberId },
    });
    if (!member) {
      throw this.error("NOT_FOUND", 404, "Member tidak ditemukan");
    }

    const todayStart = this.startOfToday();
    const todayEnd = this.endOfToday();
    const monthStart = this.startOfMonth();
    const monthEnd = this.endOfMonth();
    const monthStartStr = dateIndoWIB().startOf("month").format();
    const monthEndStr = dateIndoWIB().endOf("month").format();

    // Total orders
    const totalOrders = await this.prisma.laundryQueue.count({
      where: { customerId: member.customerId ?? undefined },
    });

    // Active orders
    const activeOrders = await this.prisma.laundryQueue.count({
      where: {
        customerId: member.customerId ?? undefined,
        status: { notIn: ["FINISHED", "CANCELED"] },
      },
    });

    // Completed orders
    const completedOrders = await this.prisma.laundryQueue.count({
      where: {
        customerId: member.customerId ?? undefined,
        status: "FINISHED",
      },
    });

    // Total spending
    const totalSpendingAgg = await this.prisma.payment.aggregate({
      _sum: { totalPrice: true },
      where: {
        laundryQueue: {
          customerId: member.customerId ?? undefined,
        },
      },
    });
    const totalSpending = Number(totalSpendingAgg._sum.totalPrice || 0);

    // Current month spending
    const monthSpendingAgg = await this.prisma.payment.aggregate({
      _sum: { totalPrice: true },
      where: {
        laundryQueue: {
          customerId: member.customerId ?? undefined,
        },
        createdAt: {
          gte: monthStartStr,
          lte: monthEndStr,
        },
      },
    });
    const currentMonthSpending = Number(monthSpendingAgg._sum.totalPrice || 0);

    // Active laundry queues
    const activeLaundryQueues = await this.prisma.laundryQueue.findMany({
      where: {
        customerId: member.customerId ?? undefined,
        status: { notIn: ["FINISHED", "CANCELED"] },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });

    // Recent orders (all)
    const recentLaundryQueues = await this.prisma.laundryQueue.findMany({
      where: { customerId: member.customerId ?? undefined },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });

    const mapOrder = (q: any): RecentOrder => ({
      orderNumber: q.laundryQueueId,
      customerName: q.customer?.name || null,
      status: q.status,
      createdAt: q.createdAt,
      total: 0,
    });

    return {
      summary: {
        totalOrders,
        activeOrders,
        completedOrders,
        totalSpending,
        currentMonthSpending,
      },
      activeLaundryQueues: activeLaundryQueues.map(mapOrder),
      recentOrders: recentLaundryQueues.map(mapOrder),
    };
  }

  private async getRevenueAnalytics(period: string) {
    const todayEndStr = dateIndoWIB().endOf("day").format();
    let payments: Array<{ createdAt: string; totalPrice: bigint }> = [];
    let labels: string[] = [];
    let data: number[] = [];

    if (period === "30") {
      const startStr = dateIndoWIB().subtract(29, "day").startOf("day").format();
      payments = await this.prisma.payment.findMany({
        where: { createdAt: { gte: startStr, lte: todayEndStr } },
        select: { createdAt: true, totalPrice: true },
      });
      const dailyMap = this.aggregateByPeriod(payments, "day");
      labels = dailyMap.map((d) => d.label);
      data = dailyMap.map((d) => d.value);
    } else if (period === "365") {
      const startStr = dateIndoWIB().subtract(11, "month").startOf("month").format();
      payments = await this.prisma.payment.findMany({
        where: { createdAt: { gte: startStr, lte: todayEndStr } },
        select: { createdAt: true, totalPrice: true },
      });
      const monthlyMap = this.aggregateByPeriod(payments, "month");
      labels = monthlyMap.map((d) => d.label);
      data = monthlyMap.map((d) => d.value);
    } else {
      // Default: last 7 days
      const startStr = dateIndoWIB().subtract(6, "day").startOf("day").format();
      payments = await this.prisma.payment.findMany({
        where: { createdAt: { gte: startStr, lte: todayEndStr } },
        select: { createdAt: true, totalPrice: true },
      });
      const dailyMap = this.aggregateByPeriod(payments, "day");
      labels = dailyMap.map((d) => d.label);
      data = dailyMap.map((d) => d.value);
    }

    return { labels, data, period };
  }

  private aggregateByPeriod(
    payments: Array<{ createdAt: string | Date; totalPrice: bigint | number }>,
    granularity: "day" | "month",
  ): Array<{ label: string; value: number }> {
    const map = new Map<string, number>();
    for (const p of payments) {
	const d = new Date(p.createdAt);
	const key = granularity === "month"
	  ? dateIndoWIB(d).format("MMM YYYY")
          : dateIndoWIB(d).format("YYYY-MM-DD");
      map.set(key, (map.get(key) || 0) + Number(p.totalPrice));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));
  }
}

export default DashboardService;
