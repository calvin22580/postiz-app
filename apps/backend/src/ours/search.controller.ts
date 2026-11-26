// OURS: "How people find you" (D1), under /ours/search. The searches that
// matter to the business: suggested from its profile, chosen by the owner.
// The organisation always comes from the signed-in session.
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { SearchService } from '@gitroom/nestjs-libraries/ours/search/search.service';
import { AddSearchDto, TrackSearchesDto } from '@gitroom/nestjs-libraries/ours/search/dtos/search.dto';

@ApiTags('How people find you')
@Controller('/ours/search')
export class SearchController {
  constructor(private _searchService: SearchService) {}

  @Get('/')
  getOverview(@GetOrgFromRequest() org: Organization) {
    return this._searchService.overview(org.id);
  }

  // a fresh set of suggestions from the business profile
  @Post('/suggest')
  suggest(@GetOrgFromRequest() org: Organization) {
    return this._searchService.suggest(org.id);
  }

  // the owner chose these suggestions
  @Post('/track')
  track(@GetOrgFromRequest() org: Organization, @Body() body: TrackSearchesDto) {
    return this._searchService.track(org.id, body.ids);
  }

  // a search the owner typed in themselves
  @Post('/add')
  add(@GetOrgFromRequest() org: Organization, @Body() body: AddSearchDto) {
    return this._searchService.add(org.id, body.keyword);
  }

  // stop watching a search, or turn down a suggestion
  @Delete('/:id')
  remove(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._searchService.remove(org.id, id);
  }
}
