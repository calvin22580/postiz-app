// OURS: the business's brand kit (colour and logo for post graphics), under
// /ours/brand-kit. The organisation always comes from the signed-in session.
import { Body, Controller, Delete, Get, Put, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { Response } from 'express';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GraphicService } from '@gitroom/nestjs-libraries/ours/graphics/graphic.service';
import {
  BrandColourDto,
  BrandLogoDto,
} from '@gitroom/nestjs-libraries/ours/graphics/dtos/brand.kit.dto';

@ApiTags('Brand kit')
@Controller('/ours/brand-kit')
export class BrandKitController {
  constructor(private _graphicService: GraphicService) {}

  @Get('/')
  getBrandKit(@GetOrgFromRequest() org: Organization) {
    return this._graphicService.getBrandKit(org.id);
  }

  @Put('/colour')
  setColour(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BrandColourDto
  ) {
    return this._graphicService.setColour(org.id, body.colour);
  }

  @Put('/logo')
  setLogo(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BrandLogoDto
  ) {
    return this._graphicService.setLogo(org.id, body.dataUrl);
  }

  @Delete('/logo')
  removeLogo(@GetOrgFromRequest() org: Organization) {
    return this._graphicService.removeLogo(org.id);
  }

  @Get('/logo')
  async getLogo(
    @GetOrgFromRequest() org: Organization,
    @Res() res: Response
  ) {
    const png = await this._graphicService.getLogo(org.id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(png);
  }
}
