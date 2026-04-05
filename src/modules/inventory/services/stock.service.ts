import * as stockRepo from "../repositories/stock.repository";
import * as productRepo from "../repositories/product.repository";
import type { AddStockInput, RemoveStockInput, AdjustStockInput, MovementFiltersInput } from "../schemas/stock.schema";

export async function addStock(input: AddStockInput) {
  const found = await productRepo.findProductById(input.productId);
  if (!found) throw new Error(`Product not found: ${input.productId}`);

  return stockRepo.createMovementAndUpdateStock(
    input.productId,
    "IN",
    input.quantity,
    null,
    input.reference,
    input.notes
  );
}

export async function removeStock(input: RemoveStockInput) {
  const found = await productRepo.findProductById(input.productId);
  if (!found) throw new Error(`Product not found: ${input.productId}`);

  if (found.stockQuantity < input.quantity) {
    throw new Error(
      `Insufficient stock. Available: ${found.stockQuantity}, Requested: ${input.quantity}`
    );
  }

  return stockRepo.createMovementAndUpdateStock(
    input.productId,
    "OUT",
    -input.quantity,
    null,
    input.reference,
    input.notes
  );
}

export async function adjustStock(input: AdjustStockInput) {
  const found = await productRepo.findProductById(input.productId);
  if (!found) throw new Error(`Product not found: ${input.productId}`);

  const delta = input.newQuantity - found.stockQuantity;

  return stockRepo.createMovementAndUpdateStock(
    input.productId,
    "ADJUSTMENT",
    delta,
    input.newQuantity,
    input.reference,
    input.notes
  );
}

export async function getStockMovements(filters: MovementFiltersInput) {
  return stockRepo.findMovements(filters);
}

export async function getInventoryKPI() {
  return stockRepo.getInventoryKPI();
}
