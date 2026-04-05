import { notFound } from "next/navigation";
import * as productService from "@/modules/inventory/services/product.service";
import { serializePrisma } from "@/lib/serialize";
import { ProductDetailClient } from "./ProductDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  let product;
  try {
    product = await productService.getProductById(id);
  } catch {
    notFound();
  }

  return <ProductDetailClient product={serializePrisma(product)} />;
}
