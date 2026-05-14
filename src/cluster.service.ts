import cluster, { Worker } from 'node:cluster';
import { cpus } from 'node:os';
import { Logger } from '@nestjs/common';

const logger = new Logger('ClusterService');

export class ClusterService {
  /**
   * Запускает приложение в режиме кластера.
   *
   * Master-процесс:
   *   - форкает по одному воркеру на каждое CPU-ядро
   *   - перезапускает упавший воркер
   *
   * Worker-процессы:
   *   - каждый выполняет callback (bootstrap NestJS)
   *   - все слушают один и тот же порт — ОС балансирует соединения (round-robin)
   *
   * В development-режиме кластер не используется: nest --watch
   * перезапускает весь процесс при изменении файлов, и multiple
   * forked workers будут мешать hot-reload.
   */
  static clusterize(callback: () => Promise<void>): void {
    if (cluster.isPrimary) {
      const numWorkers = cpus().length;
      logger.log(`Master PID=${process.pid} — запускаю ${numWorkers} воркеров`);

      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }

      cluster.on('online', (worker: Worker) => {
        logger.log(`Воркер PID=${worker.process.pid} онлайн`);
      });

      cluster.on('exit', (worker: Worker, code: number, signal: string) => {
        logger.warn(
          `Воркер PID=${worker.process.pid} упал ` +
            `(code=${code ?? '-'}, signal=${signal ?? '-'}). Перезапускаю...`,
        );
        cluster.fork();
      });
    } else {
      logger.log(
        `Воркер #${cluster.worker?.id} PID=${process.pid} стартует`,
      );
      void callback();
    }
  }
}
