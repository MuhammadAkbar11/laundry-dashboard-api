import dayjs from "dayjs";
import "dayjs/locale/id";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const dateIndoWIB = (date?: dayjs.ConfigType) =>
  dayjs(date, { locale: "id" }).tz("Asia/Jakarta");
export const dateUTC = dayjs.utc;
