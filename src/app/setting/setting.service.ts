import { Setting, Prisma } from "@prisma/client";
import { BaseService } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";

@BindAllMethods
class SettingService extends BaseService {
  constructor() {
    super();
  }

  public async getAll(): Promise<Setting[] | void> {
    try {
      const data = await this.prisma.setting.findMany({});

      return data;
    } catch (error) {
      this.logger.error(`[EXCEPTION] getAllSetting`);
      this.throwError(error);
    }
  }

  public async getById(id: number): Promise<Setting | void | null> {
    try {
      const data = await this.prisma.setting.findUnique({
        where: { settingId: id },
      });

      return data;
    } catch (error) {
      this.logger.error(`[EXCEPTION] getSettingById`);
      this.throwError(error);
    }
  }

  public async getByName(name: string): Promise<Setting | void | null> {
    try {
      const data = await this.prisma.setting.findUnique({
        where: { name },
      });

      return data;
    } catch (error) {
      this.logger.error(`[EXCEPTION] getSettingByName`);
      this.throwError(error);
    }
  }

  public async bulkUpdate(
    updates: { name: string; value: string }[]
  ): Promise<Setting[] | void> {
    try {
      const updatedSettings = await this.prisma.$transaction(async (trx) => {
        const results: Setting[] = [];

        for (const update of updates) {
          const updated = await trx.setting.upsert({
            where: { name: update.name },
            create: {
              name: update.name,
              description: update.name,
              value: update.value,
            },
            update: {
              value: update.value,
              updatedAt: new Date(),
            },
          });
          results.push(updated);
        }

        return results;
      });

      return updatedSettings;
    } catch (error) {
      this.logger.error(`[EXCEPTION] bulkUpdateSetting`);
      this.throwError(error);
    }
  }
}

export default SettingService;
