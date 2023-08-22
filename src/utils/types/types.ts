import { ROLES, USER_STATUS } from "../../configs/vars.config";

export type SortingTypes<T> = T | T[];
export type ModeTypes = "development" | "production" | "testing";
export type UserStatusTypes = keyof typeof USER_STATUS;
export type RoleTypes = keyof typeof ROLES;

export type IncTablesNameTypes =
  | "tb_users"
  | "tb_members"
  | "tb_customer_levels"
  | "tb_customers"
  | "tb_services"
  | "tb_laundries"
  | "tb_laundry_queues"
  | "tb_laundry_rooms"
  | "tb_history_services"
  | "tb_payments"
  | "tb_expenses"
  | "tb_cashflow";

export type IncTablesFieldTypes =
  | "user_id"
  | "member_id"
  | "cs_level_id"
  | "customer_id"
  | "service_id"
  | "laundry_id"
  | "laundry_queue_id"
  | "laundry_room_id"
  | "history_service_id"
  | "payment_id"
  | "invoice"
  | "expenses_id"
  | "expenses_invoice"
  | "cashflow_id"
  | "cashflow_invoice";
