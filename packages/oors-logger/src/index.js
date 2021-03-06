/* eslint-disable no-console */
import { validate, validators as v } from 'easevalidation';
import path from 'path';
import Table from 'cli-table';
import { inspect } from 'util';
import { Module } from 'oors';
import * as winston from 'winston';

class LoggerModule extends Module {
  static validateConfig = validate(
    v.isSchema({
      level: [v.isDefault('info'), v.isString()],
      printModules: [v.isDefault(true), v.isBoolean()],
      printDependencyGraph: [v.isDefault(true), v.isBoolean()],
      printMiddlewares: [v.isDefault(true), v.isBoolean()],
      logger: v.isAny(v.isUndefined(), v.isObject()),
      logsDir: [v.isRequired(), v.isString()],
      logGqlErrors: [v.isDefault(true), v.isBoolean()],
    }),
  );

  name = 'oors.logger';

  setup({
    printModules,
    printDependencyGraph,
    printMiddlewares,
    logsDir,
    level: defaultLevel,
    logGqlErrors,
  }) {
    const transports = [
      new winston.transports.File({
        level: 'error',
        filename: path.join(logsDir, 'errors.log'),
        maxsize: 5000000,
        maxFiles: 10,
        tailable: true,
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    ];

    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      );
    }

    const logger = this.getConfig(
      'logger',
      winston.createLogger({
        defaultLevel,
        transports,
        exceptionHandlers: [
          new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5000000,
            maxFiles: 10,
            tailable: true,
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
          }),
        ],
      }),
    );

    process.on('unhandledRejection', reason => logger.error(reason));

    this.export({
      logger,
      log: (...args) => logger.log(...args),
      ...Object.keys(logger.levels)
        .filter(level => logger.levels[level] <= logger.levels[logger.level])
        .reduce(
          (acc, level) => ({
            ...acc,
            [level]: (message, meta) =>
              logger[level](message, {
                meta,
              }),
          }),
          {},
        ),
      logError: this.logError,
    });

    if (printModules) {
      this.printModules();
    }

    if (printDependencyGraph) {
      this.printDependencyGraph();
    }

    if (printMiddlewares) {
      this.printMiddlewares();
    }

    if (logGqlErrors) {
      this.onModule('oors.graphql', 'error', error => {
        this.logError(error);
      });
    }
  }

  get logger() {
    return this.get('logger');
  }

  printModules() {
    const modulesTable = new Table({
      head: ['Modules'],
    });

    this.manager.on('module:loaded', module => {
      modulesTable.push([module.name]);
    });

    this.manager.once('after:setup', () => {
      console.log(modulesTable.toString());
    });
  }

  printDependencyGraph() {
    this.manager.once('after:setup', () => {
      console.log(this.manager.expandedDependencyGraph);
    });
  }

  printMiddlewares() {
    if (!this.manager.has('oors.express')) {
      return;
    }

    this.manager.once('after:setup', () => {
      const table = new Table({
        head: ['Id', 'Path', 'Params'],
      });

      this.manager
        .get('oors.express')
        .middlewares.reject({ enabled: false })
        .forEach(({ path: mPath, id, params }) => {
          table.push([id, mPath || '/', typeof params !== 'undefined' ? inspect(params) : 'N/A']);
        });

      console.log(table.toString());
    });
  }

  logError = error => this.logger.error(error.message, { meta: { error } });
}

export { LoggerModule as default };
