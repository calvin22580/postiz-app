// OURS: content engine E1. Records what owners do with the posts we write.
// A signal is a side record: if it can't be stored, the owner's action still
// goes through and the failure is only logged.
import { Injectable, Logger } from '@nestjs/common';
import { BrandSignalRepository } from '@gitroom/nestjs-libraries/ours/memory/brand.signal.repository';
import { BrandSignal } from '@gitroom/nestjs-libraries/ours/memory/brand.signal';

@Injectable()
export class BrandSignalService {
  private _logger = new Logger(BrandSignalService.name);

  constructor(private _brandSignalRepository: BrandSignalRepository) {}

  async record(orgId: string, signal: BrandSignal) {
    try {
      return await this._brandSignalRepository.record(orgId, signal);
    } catch (e) {
      this._logger.error(
        `Could not store ${signal.kind} signal for org=${orgId}: ${(e as Error)?.message}`
      );
      return null;
    }
  }
}
