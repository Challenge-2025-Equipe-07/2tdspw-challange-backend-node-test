import { Controller, Get, Query } from '@nestjs/common';

import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.productsService.list(q);
  }
}
