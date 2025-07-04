import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ProductService } from "./product.service"
import { ProductController } from "./product.controller"
import { Product } from "./entities/product.entity"
import { LifecycleModule } from "../lifecycle/lifecycle.module"

@Module({
  imports: [TypeOrmModule.forFeature([Product]), LifecycleModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
