import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus } from "@nestjs/common"
import type { ProductService, CreateProductDto, UpdateProductDto } from "./product.service"
import type { AuditService } from "../lifecycle/services/audit.service"
import type { VersioningService } from "../lifecycle/services/versioning.service"

@Controller("products")
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly auditService: AuditService,
    private readonly versioningService: VersioningService,
  ) {}

  @Post()
  create(createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto, {
      userId: "system",
      reason: "Product creation via API",
    })
  }

  @Get()
  findAll() {
    return this.productService.findAll()
  }

  @Get('category/:category')
  findByCategory(@Param('category') category: string) {
    return this.productService.findByCategory(category);
  }

  @Get('low-stock')
  findLowStock(@Query('threshold') threshold?: number) {
    return this.productService.findLowStock(threshold);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Get(':id/audit-trail')
  getAuditTrail(@Param('id') id: string) {
    return this.auditService.getAuditTrail('Product', id);
  }

  @Get(':id/versions')
  getVersionHistory(@Param('id') id: string) {
    return this.versioningService.getVersionHistory('Product', id);
  }

  @Patch(":id")
  update(@Param('id') id: string, updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto, {
      userId: "system",
      reason: "Product update via API",
    })
  }

  @Patch(":id/stock")
  updateStock(@Param('id') id: string, @Body('stock') stock: number) {
    return this.productService.updateStock(id, stock, {
      userId: "system",
      reason: "Stock update via API",
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id') id: string) {
    return this.productService.softDelete(id, {
      userId: 'system',
      reason: 'Product deletion via API',
    });
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.productService.restore(id, {
      userId: 'system',
      reason: 'Product restoration via API',
    });
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.productService.archive(id, {
      userId: 'system',
      reason: 'Product archival via API',
    });
  }

  @Post('bulk/prices')
  bulkUpdatePrices(@Body() updates: Array<{ id: string; price: number }>) {
    return this.productService.bulkUpdatePrices(updates, {
      userId: 'system',
      reason: 'Bulk price update via API',
    });
  }
}
