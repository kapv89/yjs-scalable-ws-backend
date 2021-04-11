import winston, {Logger} from 'winston';
import {consoleFormat} from 'winston-console-format';
import {format as formatDate} from 'date-fns';
import config from '../config.js';

const {createLogger, format, transports} = winston;

const createLoggerForSpecificModule = (component: string): Logger => {
  const logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    defaultMeta: { component },
    transports: [
      new transports.Console({
        level: 'debug',
        handleExceptions: true,
        format: format.combine(
          format.colorize({ all: true }),
          format.padLevels(),
          consoleFormat({
            showMeta: true,
            metaStrip: ['timestamp'],
            inspectOptions: {
              depth: Infinity,
              colors: true,
              maxArrayLength: Infinity,
              breakLength: 120,
              compact: Infinity,
            },
          })
        ),
      }),
      ...(!config.testing ? [] : [
        new transports.File({
          handleExceptions: true,
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          filename: `${process.cwd()}/logs/${formatDate(new Date(), 'yyyy-MM-dd')}/${component}/out.log`,
        })
      ])
    ],
    exitOnError: false,
  });

  return logger;
};

export default createLoggerForSpecificModule;
