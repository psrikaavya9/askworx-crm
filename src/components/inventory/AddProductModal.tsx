"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea, Select } from "@/components/ui/Input";
import { useRouter } from "next/navigation";

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  categories: string[];
}

const PRESET_CATEGORIES = [
  "Electronics",
  "Furniture",
  "Stationery",
  "Clothing",
  "Food & Beverage",
  "Machinery",
  "Raw Materials",
  "Packaging",
  "Other",
];

export function AddProductModal({ open, onClose, categories }: AddProductModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    category: "",
    unit: "pcs",
    unitPrice: "",
    costPrice: "",
    stockQuantity: "0",
    minimumStock: "0",
  });

  const allCategories = Array.from(new Set([...categories, ...PRESET_CATEGORIES])).sort();

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          unitPrice: parseFloat(form.unitPrice),
          costPrice: parseFloat(form.costPrice),
          stockQuantity: parseInt(form.stockQuantity, 10),
          minimumStock: parseInt(form.minimumStock, 10),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create product");
        return;
      }
      router.refresh();
      onClose();
      setForm({ name: "", sku: "", description: "", category: "", unit: "pcs", unitPrice: "", costPrice: "", stockQuantity: "0", minimumStock: "0" });
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Product" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Product Name"
            required
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g. Laptop"
          />
          <Input
            label="SKU"
            required
            value={form.sku}
            onChange={(e) => handleChange("sku", e.target.value)}
            placeholder="e.g. LAP-001"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Category"
            required
            value={form.category}
            onChange={(e) => handleChange("category", e.target.value)}
            options={allCategories.map((c) => ({ label: c, value: c }))}
            placeholder="Select category"
          />
          <Select
            label="Unit"
            value={form.unit}
            onChange={(e) => handleChange("unit", e.target.value)}
            options={[
              { label: "pcs", value: "pcs" },
              { label: "box", value: "box" },
              { label: "kg", value: "kg" },
              { label: "litre", value: "litre" },
              { label: "pack", value: "pack" },
              { label: "set", value: "set" },
            ]}
          />
        </div>
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Product description..."
          rows={2}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Unit Price (₹)"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => handleChange("unitPrice", e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Cost Price (₹)"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.costPrice}
            onChange={(e) => handleChange("costPrice", e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Initial Stock Quantity"
            type="number"
            min="0"
            value={form.stockQuantity}
            onChange={(e) => handleChange("stockQuantity", e.target.value)}
          />
          <Input
            label="Minimum Stock Level"
            type="number"
            min="0"
            value={form.minimumStock}
            onChange={(e) => handleChange("minimumStock", e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add Product
          </Button>
        </div>
      </form>
    </Modal>
  );
}
