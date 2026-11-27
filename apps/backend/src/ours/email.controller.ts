// OURS: the business's email list (email campaigns EM1), sending (EM2) and
// list emails written for the owner to approve (EM3), under /ours/email.
// The organisation always comes from the signed-in session.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Organization, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { EmailService } from '@gitroom/nestjs-libraries/ours/email/email.service';
import { EmailCampaignService } from '@gitroom/nestjs-libraries/ours/email/email.campaign.service';
import { MAX_UPLOAD_BYTES } from '@gitroom/nestjs-libraries/ours/email/email.contacts';
import {
  AddContactDto,
  ApproveEmailCampaignDto,
  EditEmailCampaignDto,
  EmailFormDto,
  ImportContactsDto,
  ListContactsQueryDto,
  RewriteEmailCampaignDto,
} from '@gitroom/nestjs-libraries/ours/email/dtos/email.dto';

@ApiTags('Email list')
@Controller('/ours/email')
export class EmailController {
  constructor(
    private _emailService: EmailService,
    private _emailCampaignService: EmailCampaignService
  ) {}

  @Get('/')
  getOverview(@GetOrgFromRequest() org: Organization) {
    return this._emailService.overview(org.id);
  }

  @Get('/contacts')
  listContacts(@GetOrgFromRequest() org: Organization, @Query() query: ListContactsQueryDto) {
    return this._emailService.listContacts(org.id, query);
  }

  @Post('/contacts')
  addContact(@GetOrgFromRequest() org: Organization, @Body() body: AddContactDto) {
    return this._emailService.addContact(org.id, body);
  }

  // multipart: a CSV `file`, or pasted `text`, kept in memory (up to 5 MB)
  @Post('/contacts/import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { files: 1, fileSize: MAX_UPLOAD_BYTES, fieldSize: MAX_UPLOAD_BYTES } })
  )
  importContacts(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: ImportContactsDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this._emailService.importContacts(org.id, user.id, {
      ...body,
      csv: file?.buffer.toString('utf8'),
      fileName: file?.originalname,
    });
  }

  @Delete('/contacts/:id')
  deleteContact(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._emailService.deleteContact(org.id, id);
  }

  // the whole list as a CSV file, for the owner
  @Get('/contacts/export')
  async exportContacts(@GetOrgFromRequest() org: Organization, @Res() res: Response) {
    const csv = await this._emailService.exportCsv(org.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="email-list.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  // which sender is on, and the owner's latest test email (EM2)
  @Get('/sending')
  getSending(@GetOrgFromRequest() org: Organization) {
    return this._emailCampaignService.status(org.id);
  }

  // one test email to the signed-in owner's own address
  @Post('/test')
  sendTest(@GetOrgFromRequest() org: Organization, @GetUserFromRequest() user: User) {
    return this._emailCampaignService.sendTest(org.id, user);
  }

  // EM3: the business's list emails: waiting, scheduled and recent
  @Get('/campaigns')
  getCampaigns(@GetOrgFromRequest() org: Organization) {
    return this._emailCampaignService.campaigns(org.id);
  }

  // a new email from the business profile, waiting for approval
  @Post('/campaigns')
  writeCampaign(@GetOrgFromRequest() org: Organization) {
    return this._emailCampaignService.write(org.id);
  }

  @Put('/campaigns/:id')
  editCampaign(@GetOrgFromRequest() org: Organization, @Param('id') id: string, @Body() body: EditEmailCampaignDto) {
    return this._emailCampaignService.edit(org.id, id, body);
  }

  @Post('/campaigns/:id/rewrite')
  rewriteCampaign(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: RewriteEmailCampaignDto
  ) {
    return this._emailCampaignService.rewrite(org.id, id, body.note);
  }

  @Post('/campaigns/:id/reject')
  rejectCampaign(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._emailCampaignService.reject(org.id, id);
  }

  // the only way a list email is scheduled
  @Post('/campaigns/:id/approve')
  approveCampaign(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: ApproveEmailCampaignDto
  ) {
    return this._emailCampaignService.approve(org.id, id, user.id, body.sendAt);
  }

  @Post('/campaigns/:id/cancel')
  cancelCampaign(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._emailCampaignService.cancel(org.id, id);
  }

  @Put('/form')
  setForm(@GetOrgFromRequest() org: Organization, @Body() body: EmailFormDto) {
    return this._emailService.setForm(org.id, body.enabled);
  }
}
