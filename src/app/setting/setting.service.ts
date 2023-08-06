import { Setting } from "@prisma/client";
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
}

export default SettingService;
