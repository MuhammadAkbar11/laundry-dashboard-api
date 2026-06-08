import { Payment, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import { dateIndoWIB } from "../../configs/date.config";

// export interface IPaymentInput
//   extends Omit<Payment, "createdAt" | "updatedAt" | "laundries"> {}

@BindAllMethods
class ReportService extends BaseService {
  constructor() {
    super();
  }

  public async getReportTrx() {
    try {
      const data: any = {};

      data.cucian = await this.prisma.laundryQueue.count({
        where: {
          status: "WASHED",
        },
      });

      data.pelanggan = await this.prisma.customer.count();

      const today = new Date();
      const harianPembayaran = await this.prisma.payment.aggregate({
        _sum: {
          totalPrice: true,
        },
        where: {
          createdAt: {
            gte: new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
            ).toDateString(),
          },
        },
      });

      data.harian = harianPembayaran?._sum?.totalPrice || 0;

      const bulananPembayaran = await this.prisma.payment.aggregate({
        _sum: {
          totalPrice: true,
        },
        where: {
          createdAt: {
            gte: new Date(
              today.getFullYear(),
              today.getMonth(),
              0,
            ).toDateString(),
          },
        },
      });

      data.bulanan = bulananPembayaran?._sum?.totalPrice || 0;

      data.mingguan = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date();
        currentDate.setDate(today.getDate() - i);
        const mingguanTransaksi = await this.prisma.payment.count({
          where: {
            createdAt: {
              gte: new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate(),
              ).toDateString(),
              lt: new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate() + 1,
              ).toDateString(),
            },
          },
        });

        const mingguanNominal = await this.prisma.payment.aggregate({
          _sum: {
            totalPrice: true,
          },
          where: {
            createdAt: {
              gte: new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate(),
              ).toDateString(),
              lt: new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                currentDate.getDate() + 1,
              ).toDateString(),
            },
          },
        });

        data.mingguan.push({
          tanggal: currentDate.toISOString().split("T")[0],
          transaksi: mingguanTransaksi,
          nominal: mingguanNominal._sum.totalPrice || 0,
        });
      }

      data.member = await this.prisma.customer.findMany({
        // take: 5,
        orderBy: {
          point: "desc",
        },
        include: {
          customerLevel: true,
          laundryQueues: true,
        },
      });

      return data;
    } catch (error) {
      this.logger.error("[EXCEPTION] getReportTrx");
      this.throwError(error);
    }
  }

  public async getReportTrxYears() {
    try {
      const cashFlowData = await this.prisma.cashFlow.findMany({
        // take: 10,
        orderBy: {
          cashflowId: "desc",
        },
      });

      const yearGroups: Record<string, any[]> = {};

      for (const kas of cashFlowData) {
        const year = new Date(kas.createdAt).getFullYear().toString();
        if (!yearGroups[year]) {
          yearGroups[year] = [];
        }
        yearGroups[year].push(kas);
      }

      const data: any[] = [];

      for (const year in yearGroups) {
        if (yearGroups.hasOwnProperty(year)) {
          const cashFlowGroup = yearGroups[year];
          const incomeCount = cashFlowGroup.filter(
            kas => kas.cashflowType === "IN",
          ).length;
          const expenseCount = cashFlowGroup.filter(
            kas => kas.cashflowType === "OUT",
          ).length;
          const incomeSum = cashFlowGroup
            .filter(kas => kas.cashflowType === "IN")
            .reduce((sum, kas) => sum + Number(kas.total), 0);
          const expenseSum = cashFlowGroup
            .filter(kas => kas.cashflowType === "OUT")
            .reduce((sum, kas) => sum + Number(kas.total), 0);

          data.push({
            value: parseInt(year),
            income: incomeCount,
            expense: expenseCount,
            incomeTotal: incomeSum,
            expenseTotal: expenseSum,
          });
        }
      }

      return data;
    } catch (error) {
      this.logger.error("[EXCEPTION] getReportTrxByYear");
      this.throwError(error);
    }
  }

  public async getReportTrxByMonth(year: number) {
    try {
      const cashFlowData = await this.prisma.cashFlow.findMany({
        where: {
          createdAt: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
      });

      const monthGroups: Record<string, any[]> = {};

      for (const cashFlowItem of cashFlowData) {
        const month = new Date(cashFlowItem.createdAt).getMonth().toString();
        if (!monthGroups[month]) {
          monthGroups[month] = [];
        }
        monthGroups[month].push(cashFlowItem);
      }

      const data: any[] = [];

      for (const month in monthGroups) {
        if (monthGroups.hasOwnProperty(month)) {
          const cashFlowGroup = monthGroups[month];
          const incomeCount = cashFlowGroup.filter(
            kas => kas.cashflowType === "IN",
          ).length;
          const expenseCount = cashFlowGroup.filter(
            kas => kas.cashflowType === "OUT",
          ).length;
          const incomeSum = cashFlowGroup
            .filter(kas => kas.cashflowType === "IN")
            .reduce((sum, kas) => Number(sum) + Number(kas.total), 0);
          const expenseSum = cashFlowGroup
            .filter(kas => kas.cashflowType === "OUT")
            .reduce((sum, kas) => Number(sum) + Number(kas.total), 0);

          data.push({
            key: dateIndoWIB().month(parseInt(month)).format("MM"),
            value: dateIndoWIB()
              .year(year)
              .month(parseInt(month))
              .locale("id")
              .format("MMMM YYYY"),
            income: incomeCount,
            expense: expenseCount,
            incomeTotal: incomeSum,
            expenseTotal: expenseSum,
          });
        }
      }

      return data;
    } catch (error) {
      this.logger.error("[EXCEPTION] getReportTrxByYear");
      this.throwError(error);
    }
  }

  public async getReportTrxDate(year: number, month: number) {
    try {
      const cashFlowData = await this.prisma.cashFlow.findMany({
        where: {
          createdAt: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
      });

      const dayGroups: Record<string, any[]> = {};

      for (const cashFlow of cashFlowData) {
        const day = new Date(cashFlow.createdAt).getDate().toString();
        if (!dayGroups[day]) {
          dayGroups[day] = [];
        }
        dayGroups[day].push(cashFlow);
      }

      const data: any[] = [];

      for (const day in dayGroups) {
        if (dayGroups.hasOwnProperty(day)) {
          const cashFlowGroup = dayGroups[day];
          const incomeCount = cashFlowGroup.filter(
            cf => cf.cashflowType === "IN",
          ).length;
          const expenseCount = cashFlowGroup.filter(
            cf => cf.cashflowType === "OUT",
          ).length;
          const incomeSum = cashFlowGroup
            .filter(cf => cf.cashflowType === "IN")
            .reduce((sum, cf) => Number(sum) + Number(cf?.total), 0);
          const expenseSum = cashFlowGroup
            .filter(cf => cf.cashflowType === "OUT")
            .reduce((sum, cf) => Number(sum) + Number(cf?.total), 0);

          data.push({
            value: dateIndoWIB()
              .date(parseInt(day))
              .year(year)
              .month(month - 1)
              .locale("id")
              .format("DD MMMM YYYY"),
            day: day,
            month: dateIndoWIB()
              .year(year)
              .month(month - 1)
              .locale("id")
              .format("MM"),
            year: dateIndoWIB()
              .year(year)
              .month(month - 1)
              .format("YYYY"),

            income: incomeCount,
            expense: expenseCount,
            incomeTotal: incomeSum,
            expenseTotal: expenseSum,
          });
        }
      }

      return data;
    } catch (error) {
      this.logger.error("[EXCEPTION] getReportTrxByYear");
      this.throwError(error);
    }
  }

  public async getReportTrxFullDate(payload: {
    year: number;
    month: number;
    day: number;
    page: number;
    limit: number;
  }) {
    try {
      const { year, month, day, page, limit } = payload;

      const skip = (page - 1) * limit;
      const take = limit;

      const kasData = await this.prisma.cashFlow.findMany({
        where: {
          createdAt: {
            gte: new Date(year, month - 1, day),
            lt: new Date(year, month - 1, day + 1),
          },
        },
        skip,
        take,
      });

      const totalRecords = await this.prisma.cashFlow.count({
        where: {
          createdAt: {
            gte: new Date(year, month - 1, day),
            lt: new Date(year, month - 1, day + 1),
          },
        },
      });

      const data: any[] = [];

      for (const kas of kasData) {
        data.push({
          month: new Date(kas.createdAt).toLocaleString("id-ID", {
            month: "long",
          }),
          time: dateIndoWIB(kas.createdAt),
          invoice: kas.cashflowInvoice,
          description: kas.description,
          type: kas.cashflowType,
          amount: kas.total,
        });
      }

      return {
        data,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
      };
    } catch (error) {
      this.logger.error("[EXCEPTION] getReportTrxFullDate");
      this.throwError(error);
    }
  }

  public async getReportTrxPeriodDate(payload: {
    startDate: string;
    endDate: string;
    page: number;
    limit: number;
  }) {
    try {
      const { startDate, endDate, page, limit } = payload;

      const skip = (page - 1) * limit;
      const take = limit;

      const kasData = await this.prisma.cashFlow.findMany({
        where: {
          createdAt: {
            gte: dateIndoWIB(startDate).toISOString(),
            lt: dateIndoWIB(endDate).toISOString(),
          },
        },
        skip,
        take,
      });

      const totalRecords = await this.prisma.cashFlow.count({
        where: {
          createdAt: {
            // gte: startDate,
            // lt: endDate,
            gte: dateIndoWIB(startDate).toISOString(),
            lt: dateIndoWIB(endDate).toISOString(),
          },
        },
      });

      const data: any[] = [];

      for (const kas of kasData) {
        data.push({
          month: new Date(kas.createdAt).toLocaleString("id-ID", {
            month: "long",
          }),
          time: new Date(kas.createdAt).toISOString(),
          type: kas.cashflowType,
          invoice: kas.cashflowInvoice,
          description: kas.description,
          amount: kas.total,
        });
      }

      return {
        data,
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords,
        currentPage: page,
      };
    } catch (error) {
      this.logger.error("[EXCEPTION] getReportTrxPeriodDate");
      this.throwError(error);
    }
  }

  public async getReportCashFlow(payload: {
    page: number;
    limit: number;
    where?: Prisma.CashFlowWhereInput;
  }) {
    try {
      const { page, limit, where } = payload;

      const skip = (page - 1) * limit;
      const take = limit;

      const kasData = await this.prisma.cashFlow.findMany({
        where,
        skip,
        take,
      });

      const totalRecords = await this.prisma.cashFlow.count({
        where: {},
      });

      return {
        data: kasData,
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords,
        currentPage: page,
      };
    } catch (error) {
      this.logger.error("[EXCEPTION] getReportTrxPeriodDate");
      this.throwError(error);
    }
  }
}

export default ReportService;
