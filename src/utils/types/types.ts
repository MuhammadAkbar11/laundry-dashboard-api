import { ROLES, USER_STATUS } from "../../configs/vars.config";

export type SortingTypes<T> = T | T[];
export type ModeTypes = "development" | "production" | "testing";
export type UserStatusTypes = keyof typeof USER_STATUS;
export type RoleTypes = keyof typeof ROLES;

export type IncTablesNameTypes =
  | "tb_users"
  | "tb_customer_levels"
  | "tb_customers"
  | "tb_services"
  | "tb_laundries"
  | "tb_laundry_queues"
  | "tb_laundry_rooms"
  | "tb_history_service"
  | "tb_payments";
export type IncTablesFieldTypes =
  | "user_id"
  | "cs_level_id"
  | "customer_id"
  | "service_id"
  | "laundry_id"
  | "laundry_queue_id"
  | "laundry_room_id"
  | "history_service_id"
  | "payment_id";
