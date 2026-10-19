//src/modules/terminals/dto/update-terminal.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateTerminalDto } from './create-terminal.dto';

export class UpdateTerminalDto extends PartialType(CreateTerminalDto) { }