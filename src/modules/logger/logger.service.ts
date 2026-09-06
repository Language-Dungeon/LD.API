import { Injectable, type LoggerService as NestLogger } from "@nestjs/common";
import { createLogger, format, transports, type Logger } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type { ConfigService } from "@nestjs/config";
import type { Config, Embed } from "@types";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class LoggerService implements NestLogger {
  private logger: Logger;
  private context: string;
  private config: ConfigService<Config>;

  constructor(context: string, config: ConfigService<Config>) {
    this.context = context;
    this.config = config;

    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const transportOptions = {
      file: new DailyRotateFile({
        filename: path.join(logDir, "application-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "30d",
        auditFile: path.join(logDir, "audit.json"),
        format: format.combine(format.timestamp(), format.json()),
      }),
      console: new transports.Console({
        format: format.combine(
          format.colorize(),
          format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          format.printf(({ timestamp, level, message, context }) => {
            return `${timestamp} [${level}] ${context ? `[${context}] ` : ""}${message}`;
          }),
        ),
      }),
      webhook: new transports.Http({
        host: config.getOrThrow("WEBHOOK"),
      }),
    };

    this.logger = createLogger({
      level: "info",
      format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
      transports: [transportOptions.file, transportOptions.console],
      exceptionHandlers: [transportOptions.file, transportOptions.console],
      exitOnError: false,
    });
  }

  log(message: unknown, ..._optionalParams: unknown[]) {
    this.logger.log("info", message);
    // this.discordLog(message, false).catch();
  }

  error(message: unknown, ..._optionalParams: unknown[]) {
    // this.logger.log("error", `${} ${message}`);
    this.discordLog(message, false).catch();
  }

  warn(message: unknown, ..._optionalParams: unknown[]) {
    this.logger.log("warn", message);
    // this.discordLog(message, false).catch();
  }

  private async discordLog(message: unknown, mention: boolean): Promise<void> {
    const body = {
      content: `\` ${this.context} \` ${mention ? "@everyone" : ""}`,
      embeds: [this.createEmbed(message)],
    };

    await fetch(this.config.getOrThrow("WEBHOOK"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  private createEmbed(message: unknown): Embed {
    return {
      color: 16347926,
      description: `\`\`\`${JSON.stringify(message, null, 4)}\`\`\``,
      type: "rich",
    };
  }
}
