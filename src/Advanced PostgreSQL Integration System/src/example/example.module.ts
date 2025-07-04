import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ExampleEntity } from "../entities/example.entity"
import { ExampleRepository } from "../repositories/example.repository"
import { ExampleService } from "./example.service"
import { ExampleController } from "./example.controller"

@Module({
  imports: [TypeOrmModule.forFeature([ExampleEntity])],
  providers: [ExampleRepository, ExampleService],
  controllers: [ExampleController],
  exports: [ExampleRepository, ExampleService],
})
export class ExampleModule {}
