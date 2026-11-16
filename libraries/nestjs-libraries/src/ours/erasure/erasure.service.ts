// OURS: erases what upstream leaves behind when an account is deleted or a
// channel is disconnected (see erasure.repository.ts for exactly what).
//
// When it runs:
// - straight after upstream's own delete (ErasureInterceptor in the backend),
// - when the backend starts, and once a day after that, to catch anything a
//   failed or interrupted run left, and anything deleted before this existed.
// Every run is safe to repeat: a target is recorded once it is fully erased,
// and one that fails is retried next time.
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { ErasureRepository } from '@gitroom/nestjs-libraries/ours/erasure/erasure.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ErasureService implements OnApplicationBootstrap, OnModuleDestroy {
  private _logger = new Logger(ErasureService.name);
  private _timer?: NodeJS.Timeout;
  private _running?: Promise<void>;

  constructor(private _repository: ErasureRepository) {}

  onApplicationBootstrap() {
    if (process.env.OURS_ERASURE_SWEEP === 'false') {
      return;
    }
    this.sweep();
    this._timer = setInterval(() => this.sweep(), DAY_MS);
    this._timer.unref();
  }

  onModuleDestroy() {
    if (this._timer) {
      clearInterval(this._timer);
    }
  }

  // Never throws. Runs one at a time in this process: a sweep asked for while
  // another runs starts when that one ends.
  sweep(orgId?: string): Promise<void> {
    const next = (this._running || Promise.resolve()).then(() =>
      this.run(orgId)
    );
    this._running = next;
    return next;
  }

  private async run(orgId?: string) {
    try {
      if (!orgId) {
        await this.sweepOrganisations();
      }
      await this.sweepChannels(orgId);
    } catch (e) {
      this._logger.error(`Erasure sweep failed: ${(e as Error)?.message}`);
    }
  }

  async sweepOrganisations() {
    let erased = 0;
    for (let skip = 0; ; ) {
      const page = await this._repository.deletedOrganisations(skip);
      if (!page.length) {
        break;
      }
      const done = await this._repository.alreadyErased(
        'organisation',
        page.map((org) => org.id)
      );
      for (const org of page.filter((item) => !done.has(item.id))) {
        if (await this.eraseOrganisation(org.id)) {
          erased++;
        }
      }
      skip += page.length;
    }
    if (erased) {
      this._logger.log(`Erased ${erased} deleted organisation(s)`);
    }
    return erased;
  }

  async sweepChannels(orgId?: string) {
    let erased = 0;
    for (let skip = 0; ; ) {
      const page = await this._repository.deletedChannels(skip, orgId);
      if (!page.length) {
        break;
      }
      const done = await this._repository.alreadyErased(
        'channel',
        page.map((channel) => channel.id)
      );
      for (const channel of page.filter((item) => !done.has(item.id))) {
        try {
          if (
            await this._repository.eraseChannel(channel.organizationId, channel.id)
          ) {
            await this._repository.recordErasure(
              'channel',
              channel.organizationId,
              channel.id
            );
            erased++;
          }
        } catch (e) {
          this._logger.error(
            `Could not erase channel=${channel.id} org=${channel.organizationId}: ${(e as Error)?.message}`
          );
        }
      }
      skip += page.length;
    }
    if (erased) {
      this._logger.log(`Erased ${erased} disconnected channel(s)`);
    }
    return erased;
  }

  private async eraseOrganisation(orgId: string) {
    try {
      // never touch an organisation that is still in use
      if (!(await this._repository.isDeletedOrganisation(orgId))) {
        return false;
      }
      await this.removeFiles(orgId);
      await this._repository.eraseOrganisation(orgId);
      await this._repository.recordErasure('organisation', orgId, orgId);
      return true;
    } catch (e) {
      this._logger.error(
        `Could not erase organisation=${orgId}: ${(e as Error)?.message}`
      );
      return false;
    }
  }

  // A file that is already gone, or can't be removed, doesn't stop the rest:
  // the rows that point at it are scrubbed either way.
  private async removeFiles(orgId: string) {
    const files = await this._repository.storedFiles(orgId);
    if (!files.length) {
      return;
    }
    const storage = UploadFactory.createStorage();
    let failed = 0;
    for (const file of files) {
      try {
        await storage.removeFile(file);
      } catch {
        failed++;
      }
    }
    if (failed) {
      this._logger.warn(
        `org=${orgId}: ${failed} of ${files.length} stored file(s) could not be removed (already gone or outside storage)`
      );
    }
  }
}
