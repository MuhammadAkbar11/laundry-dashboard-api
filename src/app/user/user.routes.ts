import express from "express";
import { BaseRouter } from "../../core";
import { requiredUser } from "../../middlewares/auth.middleware";
import { BindAllMethods } from "../../utils/decorators.utils";
import validateResource from "../../middlewares/validate.middleware";
import UserController from "./user.controller";
import {
  createUserSchema,
  deleteUserSchema,
  readUserNotificationsSchema,
  readUserNotificationByIdSchema,
  readUserSchema,
  updateUserSchema,
} from "./user.schema";
import uploadSingleImage from "../../middlewares/upload.middleware";

@BindAllMethods
class UserRouter extends BaseRouter<UserController> {
  constructor(protected express: express.Express) {
    super(UserController, express);
  }

  protected routes(): void {
    this.router
      .route("/all")
      .post(
        requiredUser,
        [validateResource(createUserSchema)],
        this.controller.post
      )
      .get(
        requiredUser,
        [validateResource(readUserSchema)],
        this.controller.get
      );
    this.router
      .route("/:userId")
      .put(
        requiredUser,
        uploadSingleImage("/users"),
        [validateResource(updateUserSchema)],
        this.controller.put
      )
      .delete(
        requiredUser,
        [validateResource(deleteUserSchema)],
        this.controller.delete
      );

    // User notifications
    this.router.get(
      "/notifications",
      requiredUser,
      [validateResource(readUserNotificationsSchema)],
      this.controller.getUserNotifications,
    );
    this.router.get(
      "/notifications/unread-count",
      requiredUser,
      this.controller.getUserUnreadCount,
    );
    this.router.patch(
      "/notifications/:notificationId/read",
      requiredUser,
      [validateResource(readUserNotificationByIdSchema)],
      this.controller.patchReadUserNotification,
    );
    this.router.patch(
      "/notifications/read-all",
      requiredUser,
      this.controller.patchReadAllUserNotifications,
    );
  }
}

export default UserRouter;
