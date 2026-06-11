import { NextFunction, Request, Response } from "express";
import { Prisma, Role, Status, User } from "@prisma/client";
import { BindAllMethods } from "../../utils/decorators.utils";
import {
  CreateUserPayload,
  DeleteUserPayload,
  ReadOneUserPayload,
  ReadUserPayload,
  UpdateUserPayload,
} from "./user.schema";
import UserService from "./user.service";
import { BaseController } from "../../core";
import { SortingTypes } from "../../utils/types/types";
import Pagination from "../../helpers/pagination.helper";
import { parsingResult, searchArray } from "../../utils/utils";
import {
  DEFAULT_USER_AVATAR,
  DEFAULT_USER_PASSWORD,
  ENV_STATIC_FOLDER_PATH,
  ROLES,
  USER_STATUS,
} from "../../configs/vars.config";
import FileHelper from "../../helpers/file.helper";
import { sanitizeText } from "../../utils/sanitizer.utils";

type UserSorting =
  SortingTypes<Prisma.UserOrderByWithRelationAndSearchRelevanceInput>;

@BindAllMethods
class UserController extends BaseController {
  private service = new UserService();
  constructor() {
    super();
  }

  private sorting(orderBy: string, sortBy: Prisma.SortOrder): UserSorting {
    let sortingOptions: UserSorting = {
      [`${orderBy || "role"}`]: sortBy || "asc",
    };

    if (!orderBy) {
      sortingOptions = [{ role: "asc" }, { userId: "desc" }];
    }

    return sortingOptions;
  }

  private searching(query: string): Prisma.Enumerable<Prisma.UserWhereInput> {
    const roleByQuery = searchArray<string>(Object.keys(ROLES), query);
    const statusByQuery = searchArray<string>(Object.keys(USER_STATUS), query);
    const ORsearching: Prisma.Enumerable<Prisma.UserWhereInput> = [
      { name: { contains: query } },
      { email: { contains: query } },
      { userId: { contains: query } },
    ];

    if (roleByQuery.length !== 0) {
      ORsearching.push({ role: { equals: roleByQuery[0] as Role } });
    }
    if (statusByQuery.length !== 0) {
      ORsearching.push({ status: { equals: statusByQuery[0] as Status } });
    }

    return ORsearching;
  }

  public async get(
    req: Request<{}, {}, {}, ReadUserPayload["query"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { _search, _page = 1, _limit = 10, _orderBy, _sortBy } = req.query;

      let whereQuery: Prisma.UserWhereInput = {};

      const paginated = new Pagination<User>(+_page, +_limit, {
        defaultLimit: 20,
        itemKeyName: "users",
      });

      const { limit, skip } = paginated.getPagination();

      const sorting = this.sorting(
        _orderBy as string,
        _sortBy as Prisma.SortOrder
      );

      if (_search) {
        whereQuery = {
          OR: this.searching(_search),
        };
      }

      const users = await this.service.getAll({
        where: {
          ...whereQuery,
          AND: [
            { NOT: { userId: req.user?.userId } },
            {
              NOT: { email: { contains: "superadmin" } },
            },
          ],
        },
        skip,
        orderBy: sorting,
        take: limit,
      });

      const totalUsers = (await this.service.count({
        where: {
          ...whereQuery,
          NOT: {
            userId: req.user?.userId,
          },
        },
      })) as number;

      const data = paginated.getPagingData(totalUsers, users as User[]);
      res.status(200).json({
        message: this.getSuccessMessage("read", "Laundry Services"),
        data: { search: _search, ...parsingResult(data) },
      });
    } catch (error) {
      this.nextError(next, error);
    }
  }

  public async post(
    req: Request<{}, {}, CreateUserPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = await this.service.create({
        email: req.body.email,
        password: DEFAULT_USER_PASSWORD,
        avatar: DEFAULT_USER_AVATAR,
        name: sanitizeText(req.body.name),
        status: "ACTIVE",
      });
      return res.status(201).json({
        message: `${this.getSuccessMessage(
          "create",
          "User"
        )}. default password untuk user baru yaitu '${DEFAULT_USER_PASSWORD}'
          `,
        user: user,
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async put(
    req: Request<UpdateUserPayload["params"], {}, UpdateUserPayload["body"]>,
    res: Response,
    next: NextFunction
  ) {
    const userIdParam = req.params.userId as string;

    const fileimgData = req.fileimg?.data;
    let avatar = null;

    try {
      const { name, role, email } = req.body;

      const existingUser = await this.service.getById(userIdParam);

      if (!existingUser) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "User", userIdParam)
        );
      }

      avatar = existingUser.avatar;
      if (fileimgData) {
        avatar = await FileHelper.resizeImageUpload(fileimgData, {
          prefix: "AVATAR",
          name: "USER",
        });

        if (DEFAULT_USER_AVATAR != existingUser.avatar) {
          FileHelper.unlinkFile(
            ENV_STATIC_FOLDER_PATH + existingUser.avatar,
            false
          );
        }
      }

      const updatedUser = await this.service.update(userIdParam, {
        name: sanitizeText(name) || existingUser.name,
        role: (role as Role) || existingUser.role,
        email: email || existingUser.email,
        avatar: avatar,
      });

      res.status(200).json({
        message: this.getSuccessMessage("update", "User", userIdParam),
        user: parsingResult(updatedUser),
      });
    } catch (error: any) {
      if (fileimgData) {
        FileHelper.unlinkFile(ENV_STATIC_FOLDER_PATH + avatar, false);
      }
      this.nextError(next, error);
    }
  }

  public async getId(
    req: Request<ReadOneUserPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const userIdParam = req.params.userId as string;

    try {
      const user = await this.service.getById(userIdParam);

      if (!user) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "User", userIdParam)
        );
      }

      res.status(200).json({
        message: this.getSuccessMessage("readById", "User", userIdParam),
        user: parsingResult(user),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }

  public async delete(
    req: Request<DeleteUserPayload["params"]>,
    res: Response,
    next: NextFunction
  ) {
    const userId = req.params.userId as string;

    try {
      const service = await this.service.getById(userId);

      if (!service) {
        throw this.error(
          "NOT_FOUND",
          404,
          this.getErrorMessage("readByIdNotFound", "User", userId)
        );
      }

      const deletedService = await this.service.delete(userId);

      res.status(200).json({
        message: this.getSuccessMessage("delete", "User", userId),
        user: parsingResult(deletedService),
      });
    } catch (error: any) {
      this.nextError(next, error);
    }
  }
}

export default UserController;
