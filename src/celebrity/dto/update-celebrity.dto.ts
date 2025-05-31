import { PartialType } from '@nestjs/mapped-types';
import { CreateCelebrityDto } from './create-celebrity.dto';

export class UpdateCelebrityDto extends PartialType(CreateCelebrityDto) {}
