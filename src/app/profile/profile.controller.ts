import { NextFunction, Request, Response } from "express";
import { BindAllMethods } from "../../utils/decorators.utils";
import { BaseController } from "../../core";
import _ from "lodash";
import { isDataValid } from "../../utils/utils";

@BindAllMethods
class ProfileController extends BaseController {
  constructor() {
    super();
  }

  public async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(404).json({
          message: "Failed to get user session",
        });
      }

      const userId = user.userId;

      const profile = await this.prisma.user.findUnique({
        where: {
          userId: userId,
        },
      });

      res.status(200).json({
        message: this.getSuccessMessage("read", "User"),
        user: profile,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async getMember(req: Request, res: Response, next: NextFunction) {
    try {
      const member = req.member;
      if (!member) {
        return res.status(404).json({
          message: this.getErrorMessage("read", "Member"),
        });
      }

      const memberId = member.memberId;

      const profile = await this.prisma.member.findUnique({
        where: {
          memberId: memberId,
        },
        include: {
          customer: true,
        },
      });

      const isValidProfile = isDataValid(profile);

      res.status(200).json({
        message: this.getSuccessMessage("read", "Member"),
        profile: {
          ..._.omit(profile, "password"),
          isValidProfile: isValidProfile,
        },
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default ProfileController;
