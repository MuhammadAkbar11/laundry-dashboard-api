import { NextFunction, Request, Response } from "express";
import { BaseController } from "../../core";
import { BindAllMethods } from "../../utils/decorators.utils";
import SettingService from "./setting.service";
import { parsingResult } from "../../utils/utils";

@BindAllMethods
class SettingController extends BaseController {
  private readonly service = new SettingService();

  constructor() {
    super();
  }

  public async get(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await this.service.getAll();

      res.status(200).json({
        message: this.getSuccessMessage("read", "Pengatuan"),
        settings: parsingResult(settings),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default SettingController;
