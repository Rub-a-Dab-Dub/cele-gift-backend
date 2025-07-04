import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Product } from "./entities/product.entity"
import type { LifecycleService, LifecycleContext } from "../lifecycle/services/lifecycle.service"

export interface CreateProductDto {
  name: string
  description?: string
  price: number
  stock?: number
  category?: string
  tags?: string[]
  ownerId?: string
}

export interface UpdateProductDto {
  name?: string
  description?: string
  price?: number
  stock?: number
  isActive?: boolean
  category?: string
  tags?: string[]
  ownerId?: string
}

@Injectable()
export class ProductService {
  private productRepository: Repository<Product>
  private lifecycleService: LifecycleService

  constructor(productRepository: Repository<Product>, lifecycleService: LifecycleService) {
    this.productRepository = productRepository
    this.lifecycleService = lifecycleService
  }

  async create(createProductDto: CreateProductDto, context: LifecycleContext = {}): Promise<Product> {
    return this.lifecycleService.create(Product, createProductDto, {
      ...context,
      reason: "Product creation",
      isMajorVersion: true,
    })
  }

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      where: { archivedAt: null },
      relations: ["owner"],
    })
  }

  async findOne(id: string): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { id, archivedAt: null },
      relations: ["owner"],
    })
  }

  async update(id: string, updateProductDto: UpdateProductDto, context: LifecycleContext = {}): Promise<Product> {
    return this.lifecycleService.update(Product, id, updateProductDto, {
      ...context,
      reason: context.reason || "Product update",
    })
  }

  async updateStock(id: string, newStock: number, context: LifecycleContext = {}): Promise<Product> {
    return this.lifecycleService.update(
      Product,
      id,
      { stock: newStock },
      {
        ...context,
        reason: `Stock updated to ${newStock}`,
        isMajorVersion: false,
      },
    )
  }

  async softDelete(id: string, context: LifecycleContext = {}): Promise<Product> {
    return this.lifecycleService.softDelete(Product, id, {
      ...context,
      reason: context.reason || "Product deletion",
    })
  }

  async restore(id: string, context: LifecycleContext = {}): Promise<Product> {
    return this.lifecycleService.restore(Product, id, {
      ...context,
      reason: context.reason || "Product restoration",
    })
  }

  async archive(id: string, context: LifecycleContext = {}): Promise<Product> {
    return this.lifecycleService.archive(Product, id, {
      ...context,
      reason: context.reason || "Product archival",
    })
  }

  async bulkUpdatePrices(updates: Array<{ id: string; price: number }>, context: LifecycleContext = {}) {
    const updateData = updates.map((update) => ({
      id: update.id,
      data: { price: update.price },
    }))

    return this.lifecycleService.bulkUpdate(Product, updateData, {
      ...context,
      reason: "Bulk price update",
    })
  }

  async findByCategory(category: string): Promise<Product[]> {
    return this.productRepository.find({
      where: { category, archivedAt: null },
      relations: ["owner"],
    })
  }

  async findLowStock(threshold = 10): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder("product")
      .where("product.stock <= :threshold", { threshold })
      .andWhere("product.archivedAt IS NULL")
      .leftJoinAndSelect("product.owner", "owner")
      .getMany()
  }
}
