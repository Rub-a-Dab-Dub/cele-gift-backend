import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  // UseGuards,
  Request,
} from '@nestjs/common';
import { CelebritySearchDto } from './dto/celebrity-search.dto';
import { CreateCelebrityDto } from './dto/create-celebrity.dto';
import { UpdateCelebrityDto } from './dto/update-celebrity.dto';
import { CelebrityFollowerService } from './services/celebrity-follower.service';
import { CelebrityService } from './services/celebrity.service';

// @ApiTags('celebrities')
@Controller('celebrities')
export class CelebrityController {
  constructor(
    private readonly celebrityService: CelebrityService,
    private readonly followerService: CelebrityFollowerService,
  ) {}

  @Post()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'moderator')
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Create celebrity profile' })
  // @ApiResponse({ status: 201, description: 'Celebrity created successfully' })
  create(
    @Body() createCelebrityDto: CreateCelebrityDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.celebrityService.create(createCelebrityDto, req.user.id);
  }

  @Get()
  // @ApiOperation({ summary: 'Search celebrities' })
  // @ApiResponse({ status: 200, description: 'Celebrities found' })
  findAll(@Query() searchDto: CelebritySearchDto) {
    return this.celebrityService.findAll(searchDto);
  }

  @Get('top')
  // @ApiOperation({ summary: 'Get top celebrities' })
  getTop(@Query('category') category?: string, @Query('limit') limit?: number) {
    return this.celebrityService.getTopCelebrities(category as any, limit);
  }

  @Get(':id')
  // @ApiOperation({ summary: 'Get celebrity by ID' })
  // @ApiResponse({ status: 200, description: 'Celebrity found' })
  // @ApiResponse({ status: 404, description: 'Celebrity not found' })
  findOne(@Param('id') id: string) {
    return this.celebrityService.findOne(id);
  }

  @Patch(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin', 'moderator')
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Update celebrity profile' })
  update(
    @Param('id') id: string,
    @Body() updateCelebrityDto: UpdateCelebrityDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.celebrityService.update(id, updateCelebrityDto, req.user.id);
  }

  @Patch(':id/verify')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('admin')
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Verify celebrity account' })
  verify(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.celebrityService.verify(
      id,
      body.status as any,
      body.notes,
      req.user.id,
    );
  }

  @Post(':id/follow')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Follow celebrity' })
  follow(
    @Param('id') celebrityId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.followerService.follow(celebrityId, req.user.id);
  }

  @Delete(':id/follow')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Unfollow celebrity' })
  unfollow(
    @Param('id') celebrityId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.followerService.unfollow(celebrityId, req.user.id);
  }

  @Get(':id/followers')
  // @ApiOperation({ summary: 'Get celebrity followers' })
  getFollowers(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.followerService.getFollowers(id, limit, offset);
  }

  @Get(':id/following')
  // @ApiOperation({ summary: 'Get celebrity following' })
  getFollowing(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.followerService.getFollowing(id, limit, offset);
  }
}
