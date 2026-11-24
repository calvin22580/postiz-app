// OURS: content engine E5. The "What we've learned" screen, under
// /ours/brand-memory: the lessons brand memory has learned, which the owner
// can edit, switch off or on, delete, or add to. The organisation always
// comes from the signed-in session.
import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { BrandMemoryService } from '@gitroom/nestjs-libraries/ours/memory/brand.memory.service';
import { OwnerLessonDto } from '@gitroom/nestjs-libraries/ours/memory/dtos/brand.memory.dto';

@ApiTags('Brand memory')
@Controller('/ours/brand-memory')
export class BrandMemoryController {
  constructor(private _brandMemoryService: BrandMemoryService) {}

  @Get('/')
  getOverview(@GetOrgFromRequest() org: Organization) {
    return this._brandMemoryService.overview(org.id);
  }

  @Post('/lessons')
  addLesson(@GetOrgFromRequest() org: Organization, @Body() body: OwnerLessonDto) {
    return this._brandMemoryService.addLesson(org.id, body.lesson);
  }

  @Put('/lessons/:id')
  async editLesson(@GetOrgFromRequest() org: Organization, @Param('id') id: string, @Body() body: OwnerLessonDto) {
    await this._brandMemoryService.editLesson(org.id, id, body.lesson);
  }

  @Put('/lessons/:id/off')
  async switchOff(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    await this._brandMemoryService.switchLesson(org.id, id, false);
  }

  @Put('/lessons/:id/on')
  async switchOn(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    await this._brandMemoryService.switchLesson(org.id, id, true);
  }

  @Delete('/lessons/:id')
  async deleteLesson(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    await this._brandMemoryService.deleteLesson(org.id, id);
  }
}
