import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(q?: string) {
    const term = q?.trim();

    return this.prisma.product.findMany({
      where: term
        ? {
            productName: {
              contains: term,
              mode: 'insensitive',
            },
          }
        : undefined,
      select: {
        id: true,
        productName: true,
        productPrice: true,
        productQuantity: true,
      },
      orderBy: { productName: 'asc' },
    });
  }
}
