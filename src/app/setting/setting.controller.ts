import { NextFunction, Request, Response } from "express";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import SettingService from "./setting.service";
import { parsingResult } from "../../utils/utils";
import {
  UpdateSettingPayload,
  ReadSettingPayload,
} from "./setting.schema";

@BindAllMethods
class SettingController extends BaseController {
  private readonly service = new SettingService();

  constructor() {
    super();
  }

  public async get(
    req: Request<{}, {}, {}, ReadSettingPayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search } = req.query;

      let settings;
      if (_search) {
        const result = await this.service.getByName(_search);
        settings = result ? [result] : [];
      } else {
        settings = await this.service.getAll();
      }

      res.status(200).json({
        message: this.getSuccessMessage("read", "Pengaturan"),
        settings: parsingResult(settings),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<{}, {}, UpdateSettingPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { settings } = req.body;

      const updated = await this.service.bulkUpdate(settings);

      res.status(200).json({
        message: this.getSuccessMessage("update", "Pengaturan"),
        settings: parsingResult(updated),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default SettingController;