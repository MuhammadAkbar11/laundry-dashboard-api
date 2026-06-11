import pino from "pino";
import pinoPretty from "pino-pretty";
import { dateUTC } from "./date.config";
import { getCorrelationId } from "../middlewares/correlation.middleware";

const timeformat = "DD.MM.YYYY|HH:mm:ss";
const time = dateUTC().tz("Asia/Jakarta").format(timeformat);
const streams = [
  {
    stream: pinoPretty({
      sync: true,
      colorize: true,
      destination: 1,
      ignore: "pid",
    }),
  },
];

const logger = pino(
  {
    level: process.env.NODE_ENV === "testing" ? "silent" : "info",
    formatters: {
      level: label => {
        return { level: label };
      },
    },
    mixin() {
      const correlationId = getCorrelationId();
      return correlationId ? { correlationId } : {};
    },
    timestamp: () => `,"time": "${time}"`,
  },
  pino.multistream(streams)
);

export default logger;
