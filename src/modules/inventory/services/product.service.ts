import * as productRepo from "../repositories/product.repository";
import type { CreateProductInput, UpdateProductInput, ProductFiltersInput } from "../schemas/product.schema";

export async function createProduct(data: CreateProductInput) {
  const existing = await productRepo.findProductBySku(data.sku);
  if (existing) throw new Error(`A product with SKU "${data.sku}" already exists.`);
  return productRepo.createProduct(data);
}

export async function getProducts(filters: ProductFiltersInput) {
  return productRepo.findProducts(filters);
}

export async function getProductById(id: string) {
  const product = await productRepo.findProductById(id);
  if (!product) throw new Error(`Product not found: ${id}`);
  return product;
}

export async function updateProduct(id: string, data: UpdateProductInput) {
  await getProductById(id);
  if (data.sku) {
    const existing = await productRepo.findProductBySku(data.sku);
    if (existing && existing.id !== id)
      throw new Error(`SKU "${data.sku}" is already used by another product.`);
  }
  return productRepo.updateProduct(id, data);
}

export async function deleteProduct(id: string) {
  await getProductById(id);
  return productRepo.deleteProduct(id);
}

export async function getCategories() {
  return productRepo.findAllCategories();
}
