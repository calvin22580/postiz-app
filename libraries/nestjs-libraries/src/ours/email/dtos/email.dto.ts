// OURS: request bodies for the email list endpoints (email campaigns EM1, EM3).
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  EMAIL_BASES,
  MAX_NAME_LENGTH,
  MAX_UPLOAD_BYTES,
  REFUSED_BASIS,
} from '@gitroom/nestjs-libraries/ours/email/email.contacts';

// the two accepted ways, plus "bought list, or other", which the service
// refuses with an explanation
const BASIS_CHOICES = [...EMAIL_BASES.map((b) => b.key), REFUSED_BASIS];

export class ListContactsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['subscribed', 'waiting', 'unsubscribed', 'blocked'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;
}

export class AddContactDto {
  @IsString()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @IsIn(BASIS_CHOICES)
  basis: string;
}

// The fields sent with an upload (multipart form). The CSV itself is the
// `file` part; addresses typed or pasted into a box come as `text`.
export class ImportContactsDto {
  @IsIn(BASIS_CHOICES)
  basis: string;

  // form fields arrive as text
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  confirmed: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_UPLOAD_BYTES)
  text?: string;
}

export class EmailFormDto {
  @IsBoolean()
  enabled: boolean;
}

// The public sign-up form. `website` is a hidden field people never see.
export class SignUpDto {
  @IsString()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @IsBoolean()
  consent: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

// EM3: the owner's own words for a list email. Lengths are checked again by
// the service with friendlier messages.
export class EditEmailCampaignDto {
  @IsString()
  @MaxLength(200)
  subject: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  previewText?: string;

  @IsString()
  @MaxLength(6000)
  body: string;
}

export class RewriteEmailCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class ApproveEmailCampaignDto {
  // when to send it, as an ISO date and time
  @IsISO8601()
  sendAt: string;
}
