import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { UserService } from "./user.service"
import { UserController } from "./user.controller"
import { User } from "./entities/user.entity"
import { LifecycleModule } from "../lifecycle/lifecycle.module"

@Module({
  imports: [TypeOrmModule.forFeature([User]), LifecycleModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
