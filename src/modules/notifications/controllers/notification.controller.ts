import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
  } from '@nestjs/common';
  import { NotificationService } from '../services/notification.service';
  import { NotificationAggregationService } from '../services/notification-aggregation.service';
  import { CreateNotificationDto } from '../dto/create-notification.dto';
  import { GetNotificationsDto } from '../dto/get-notifications.dto';
  import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
  import { GetUser } from '../../../shared/decorators/get-user.decorator';
  import { User } from '../../users/entities/user.entity';
  
  @Controller('notifications')
  @UseGuards(JwtAuthGuard)
  export class NotificationController {
    constructor(
      private notificationService: NotificationService,
      private aggregationService: NotificationAggregationService,
    ) {}
  
    @Get()
    async getNotifications(
      @GetUser() user: User,
      @Query() query: GetNotificationsDto,
    ) {
      return this.notificationService.getNotificationsForUser(user.id, query);
    }
  
    @Get('aggregated')
    async getAggregatedNotifications(@GetUser() user: User) {
      return this.aggregationService.aggregateNotifications(user.id);
    }
  
    @Post()
    async createNotification(@Body() createDto: CreateNotificationDto) {
      return this.notificationService.createNotification(createDto);
    }
  
    @Patch(':id/read')
    async markAsRead(@Param('id') id: string, @GetUser() user: User) {
      return this.notificationService.markAsRead(id, user.id);
    }
  }