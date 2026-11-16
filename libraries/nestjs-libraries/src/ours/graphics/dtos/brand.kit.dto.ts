// OURS: request bodies for the brand kit and graphic endpoints.
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import {
  GRAPHIC_LAYOUTS,
  HEX_COLOUR,
  NO_GRAPHIC,
} from '@gitroom/nestjs-libraries/ours/graphics/graphic.content';

export class BrandColourDto {
  @IsString()
  @Matches(HEX_COLOUR, { message: 'Choose a colour like #1F5F5B.' })
  colour: string;
}

// A logo image as a data URL (PNG, JPEG or WebP). About 3 MB of base64.
export class BrandLogoDto {
  @IsString()
  @MaxLength(4_000_000)
  dataUrl: string;
}

export class GraphicLayoutDto {
  @IsString()
  @IsIn(['auto', NO_GRAPHIC, ...GRAPHIC_LAYOUTS.map((l) => l.key)])
  layout: string;
}
