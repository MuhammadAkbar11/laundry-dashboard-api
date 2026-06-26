import { Prisma, Payment } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseService } from "../../core";
import { dateIndoWIB } from "../../configs/date.config";
import { aggregateByPeriod } from "../../utils/analytics.utils";


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
  financialAnalytics: {
    labels: string[];
    revenue: number[];
    expenses: number[];
    period: string;
  };
  revenueByService: {
    labels: string[];
    data: number[];
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
    const financialAnalytics = await this.getFinancialAnalytics(selectedPeriod);
    const revenueByService = await this.getRevenueByService(selectedPeriod);

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
      financialAnalytics: financialAnalytics,
      revenueByService: revenueByService,
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

  async getRevenueAnalytics(period: string) {
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

  private getPeriodRange(period: string): {
    startStr: string;
    granularity: "day" | "month";
  } {
    if (period === "365") {
      return {
        startStr: dateIndoWIB().subtract(11, "month").startOf("month").format(),
        granularity: "month",
      };
    }
    if (period === "30") {
      return {
        startStr: dateIndoWIB().subtract(29, "day").startOf("day").format(),
        granularity: "day",
      };
    }
    return {
      startStr: dateIndoWIB().subtract(6, "day").startOf("day").format(),
      granularity: "day",
    };
  }

  // Income (Payment) vs Expenses (CashFlow OUT) time-series, aligned on shared labels.
  async getFinancialAnalytics(period: string) {
    const todayEndStr = dateIndoWIB().endOf("day").format();
    const { startStr, granularity } = this.getPeriodRange(period);

    const payments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: startStr, lte: todayEndStr } },
      select: { createdAt: true, totalPrice: true },
    });

    const cashflows = await this.prisma.cashFlow.findMany({
      where: {
        cashflowType: "OUT",
        createdAt: { gte: new Date(startStr), lte: new Date(todayEndStr) },
      },
      select: { createdAt: true, total: true },
    });

    const revenueAgg = this.aggregateByPeriod(payments, granularity);
    const expensesAgg = this.aggregateByPeriod(
      cashflows.map((c) => ({ createdAt: c.createdAt, totalPrice: c.total })),
      granularity,
    );

    // Key by sortKey (YYYY-MM / YYYY-MM-DD) so the union and sort are
    // chronological, then swap in the display label for the response.
    const revenueMap = new Map(revenueAgg.map((d) => [d.sortKey, d]));
    const expensesMap = new Map(expensesAgg.map((d) => [d.sortKey, d]));
    const sortedKeys = Array.from(
      new Set([...revenueMap.keys(), ...expensesMap.keys()]),
    ).sort((a, b) => a.localeCompare(b));

    const labels = sortedKeys.map(
      (k) => (revenueMap.get(k) ?? expensesMap.get(k))!.label,
    );
    const revenue = sortedKeys.map((k) => revenueMap.get(k)?.value || 0);
    const expenses = sortedKeys.map((k) => expensesMap.get(k)?.value || 0);

    return { labels, revenue, expenses, period };
  }

  // Revenue grouped by service type (HistoryService.name) within the period window.
  async getRevenueByService(period: string) {
    const todayEndStr = dateIndoWIB().endOf("day").format();
    const { startStr } = this.getPeriodRange(period);

    const items = await this.prisma.laundryItem.findMany({
      where: {
        laundryQueue: {
          payment: { createdAt: { gte: startStr, lte: todayEndStr } },
        },
      },
      select: {
        totalPrice: true,
        historyService: { select: { name: true } },
      },
    });

    const map = new Map<string, number>();
    for (const it of items) {
      const name = it.historyService?.name || "Lainnya";
      map.set(name, (map.get(name) || 0) + Number(it.totalPrice));
    }

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(([name]) => name),
      data: sorted.map(([, value]) => value),
    };
  }

  private aggregateByPeriod(
    payments: Array<{ createdAt: string | Date; totalPrice: bigint | number }>,
    granularity: "day" | "month",
  ): Array<{ sortKey: string; label: string; value: number }> {
    return aggregateByPeriod(payments, granularity);
  }
}

export default DashboardService;
