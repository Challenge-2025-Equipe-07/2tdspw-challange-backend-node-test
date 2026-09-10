export type ProductBid = {
  id: string;
  productName: string;
  productPrice: number;
};

export function normalizeProductKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function buildProductLookup(
  products: ProductBid[],
): Map<string, ProductBid> {
  return new Map(
    products.map((product) => [
      normalizeProductKey(product.productName),
      product,
    ]),
  );
}

export function resolveProduct(
  lookup: Map<string, ProductBid>,
  appointmentName: string,
): ProductBid | undefined {
  return lookup.get(normalizeProductKey(appointmentName));
}

export function resolveAppointmentPrice(
  appointmentPrice: number | null | undefined,
  linkedProductPrice?: number | null,
  lookupProductPrice?: number | null,
): number {
  return Number(
    appointmentPrice ?? linkedProductPrice ?? lookupProductPrice ?? 0,
  );
}
