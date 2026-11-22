// OURS: erasing the data of deleted organisations and disconnected channels.
// Upstream "deletes" both by setting deletedAt (and, for a deleted account,
// hashing the user and channel identifiers), which leaves post text, media,
// our business profiles and captions, and disconnected channels' tokens in
// the database. The privacy policy promises removal, so this finishes the job.
//
// Rows that other rows point at are scrubbed, not deleted, so no upstream
// foreign key can block the erasure. Every write is scoped to one
// organisation; only the two "which ones still need erasing" lookups look
// across organisations, because they run as a system sweep.
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export type ErasureKind = 'organisation' | 'channel';

// Same hashing upstream uses when it deletes an account
// (IntegrationRepository.deleteIntegrationsForAccount).
const hash = (value: string) => createHash('md5').update(value).digest('hex');

const PAGE = 200;

@Injectable()
export class ErasureRepository {
  constructor(
    private _erasure: PrismaRepository<'oursErasure'>,
    private _upstream: PrismaRepository<
      | 'organization'
      | 'integration'
      | 'post'
      | 'comments'
      | 'errors'
      | 'notifications'
      | 'signatures'
      | 'sets'
      | 'webhooks'
      | 'integrationsWebhooks'
      | 'autoPost'
      | 'thirdParty'
      | 'plugs'
      | 'oAuthAuthorization'
      | 'gitHub'
      | 'media'
      | 'tags'
      | 'customer'
      | 'clipping'
      | 'clippingClip'
      | 'oAuthApp'
    >,
    private _ours: PrismaRepository<
      | 'oursBusinessProfile'
      | 'oursBrandKit'
      | 'oursCaptionDraft'
      | 'oursCaptionWeek'
      | 'oursSeasonalSettings'
      | 'oursPostPerformance'
      | 'oursBrandSignal'
      | 'oursBrandMemory'
      | 'oursBrandMemoryRun'
    >
  ) {}

  // Deleted organisations, a page at a time, oldest deletion first.
  deletedOrganisations(skip: number) {
    return this._upstream.model.organization.findMany({
      where: { deletedAt: { not: null } },
      orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
      skip,
      take: PAGE,
      select: { id: true },
    });
  }

  // Disconnected (deleted) channels, of one organisation or of all.
  deletedChannels(skip: number, orgId?: string) {
    return this._upstream.model.integration.findMany({
      where: {
        deletedAt: { not: null },
        ...(orgId ? { organizationId: orgId } : {}),
      },
      orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
      skip,
      take: PAGE,
      select: { id: true, organizationId: true, deletedAt: true },
    });
  }

  // When each target was last erased. A channel can be connected again (the
  // same row comes back) and disconnected again, so the caller compares this
  // with the row's deletedAt.
  async lastErased(kind: ErasureKind, targetIds: string[]) {
    const rows = await this._erasure.model.oursErasure.findMany({
      where: { kind, targetId: { in: targetIds } },
      select: { targetId: true, erasedAt: true },
    });
    return new Map(rows.map((row) => [row.targetId, row.erasedAt]));
  }

  recordErasure(kind: ErasureKind, orgId: string, targetId: string) {
    return this._erasure.model.oursErasure.upsert({
      where: { kind_targetId: { kind, targetId } },
      create: { kind, organizationId: orgId, targetId },
      update: { erasedAt: new Date() },
      select: { id: true },
    });
  }

  // Files to remove from storage before their rows are scrubbed: the media
  // library and the graphics attached to our captions.
  async storedFiles(orgId: string) {
    const [media, drafts, clippings, clips] = await Promise.all([
      this._upstream.model.media.findMany({
        where: { organizationId: orgId, path: { not: '' } },
        select: { path: true, thumbnail: true },
      }),
      this._ours.model.oursCaptionDraft.findMany({
        where: { organizationId: orgId, graphicPath: { not: null } },
        select: { graphicPath: true },
      }),
      this._upstream.model.clipping.findMany({
        where: { organizationId: orgId, thumbnail: { not: null } },
        select: { thumbnail: true },
      }),
      this._upstream.model.clippingClip.findMany({
        where: { clipping: { organizationId: orgId } },
        select: { path: true, thumbnail: true },
      }),
    ]);
    // an approved graphic is also in the media library: list each file once
    const paths = [
      ...media.flatMap((item) => [item.path, item.thumbnail]),
      ...drafts.map((draft) => draft.graphicPath),
      ...clippings.map((clipping) => clipping.thumbnail),
      ...clips.flatMap((clip) => [clip.path, clip.thumbnail]),
    ].filter((path): path is string => !!path);
    return [...new Set(paths)];
  }

  // A disconnected channel: its tokens, profile and picture are platform
  // data. internalId and name stay: connecting the same page again revives
  // this row through upstream's upsert, which sets new tokens but not the
  // name. The refresh token is emptied, not hashed, so a reconnect that gets
  // no new one is asked to reconnect rather than refreshing with garbage.
  async eraseChannel(orgId: string, channelId: string) {
    const channel = await this._upstream.model.integration.findFirst({
      where: { id: channelId, organizationId: orgId, deletedAt: { not: null } },
      select: {
        token: true,
        profile: true,
        customInstanceDetails: true,
      },
    });
    if (!channel) {
      return false;
    }
    await this._upstream.model.integration.updateMany({
      where: { id: channelId, organizationId: orgId, deletedAt: { not: null } },
      data: {
        token: hash(channel.token),
        refreshToken: '',
        profile: channel.profile ? hash(channel.profile) : null,
        customInstanceDetails: channel.customInstanceDetails
          ? hash(channel.customInstanceDetails)
          : null,
        picture: null,
      },
    });
    return true;
  }

  // A deleted organisation: everything the business wrote or uploaded, every
  // credential it stored, and all of our own rows about it. Kept: our AI cost
  // log, plan and usage counters (billing records, no customer content), and
  // the empty shells of upstream rows that others point at.
  async isDeletedOrganisation(orgId: string) {
    const deleted = await this._upstream.model.organization.findFirst({
      where: { id: orgId, deletedAt: { not: null } },
      select: { id: true },
    });
    return !!deleted;
  }

  // Only call for an organisation isDeletedOrganisation confirmed.
  async eraseOrganisation(orgId: string) {
    const org = { organizationId: orgId };
    const now = new Date();

    // our own rows
    await this._ours.model.oursPostPerformance.deleteMany({ where: org });
    await this._ours.model.oursBrandSignal.deleteMany({ where: org });
    await this._ours.model.oursBrandMemory.deleteMany({ where: org });
    await this._ours.model.oursBrandMemoryRun.deleteMany({ where: org });
    await this._ours.model.oursCaptionDraft.deleteMany({ where: org });
    await this._ours.model.oursCaptionWeek.deleteMany({ where: org });
    await this._ours.model.oursBusinessProfile.deleteMany({ where: org });
    await this._ours.model.oursBrandKit.deleteMany({ where: org });
    await this._ours.model.oursSeasonalSettings.deleteMany({ where: org });

    // upstream rows nothing points at
    await this._upstream.model.errors.deleteMany({ where: org });
    await this._upstream.model.notifications.deleteMany({ where: org });
    await this._upstream.model.signatures.deleteMany({ where: org });
    await this._upstream.model.sets.deleteMany({ where: org });
    await this._upstream.model.plugs.deleteMany({ where: org });
    await this._upstream.model.autoPost.deleteMany({ where: org });
    await this._upstream.model.gitHub.deleteMany({ where: org });
    await this._upstream.model.integrationsWebhooks.deleteMany({
      where: { webhook: org },
    });
    await this._upstream.model.webhooks.deleteMany({ where: org });

    // upstream rows other rows point at: scrubbed
    await this._upstream.model.post.updateMany({
      where: org,
      data: {
        content: '',
        title: null,
        description: null,
        settings: null,
        image: null,
        error: null,
        releaseURL: null,
      },
    });
    await this._upstream.model.post.updateMany({
      where: { ...org, deletedAt: null },
      data: { deletedAt: now },
    });
    await this._upstream.model.comments.updateMany({
      where: org,
      data: { content: '', displayName: null, anchorQuote: null },
    });
    await this._upstream.model.comments.updateMany({
      where: { ...org, deletedAt: null },
      data: { deletedAt: now },
    });
    await this._upstream.model.media.updateMany({
      where: org,
      data: {
        name: 'deleted',
        originalName: null,
        path: '',
        thumbnail: null,
        alt: null,
      },
    });
    await this._upstream.model.media.updateMany({
      where: { ...org, deletedAt: null },
      data: { deletedAt: now },
    });
    await this._upstream.model.oAuthAuthorization.updateMany({
      where: org,
      data: {
        accessToken: null,
        authorizationCode: null,
        codeChallenge: null,
        revokedAt: now,
      },
    });
    const thirdParties = await this._upstream.model.thirdParty.findMany({
      where: org,
      select: { id: true, apiKey: true, name: true },
    });
    for (const item of thirdParties) {
      await this._upstream.model.thirdParty.updateMany({
        where: { id: item.id, ...org },
        data: {
          apiKey: hash(item.apiKey),
          name: hash(item.name),
          deletedAt: now,
        },
      });
    }
    await this._upstream.model.tags.updateMany({
      where: { orgId },
      data: { name: 'deleted' },
    });
    // customer names are part of a unique key, so each gets its own hash
    const customers = await this._upstream.model.customer.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });
    for (const customer of customers) {
      await this._upstream.model.customer.updateMany({
        where: { id: customer.id, orgId },
        data: { name: hash(customer.name) },
      });
    }
    await this._upstream.model.clippingClip.updateMany({
      where: { clipping: org },
      data: { title: '', content: '', path: null, thumbnail: null, error: null },
    });
    await this._upstream.model.clipping.updateMany({
      where: org,
      data: { url: '', title: null, thumbnail: null, error: null },
    });
    await this._upstream.model.clipping.updateMany({
      where: { ...org, deletedAt: null },
      data: { deletedAt: now },
    });
    // without a secret the app can no longer sign anyone in
    await this._upstream.model.oAuthApp.updateMany({
      where: org,
      data: { name: 'deleted', description: null, clientSecret: null },
    });
    await this._upstream.model.integration.updateMany({
      where: org,
      data: { additionalSettings: '[]' },
    });
    await this._upstream.model.organization.updateMany({
      where: { id: orgId, deletedAt: { not: null } },
      data: { name: 'Deleted organisation', description: null, apiKey: null },
    });
  }
}
