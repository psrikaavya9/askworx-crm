"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { useRouter } from "next/navigation";

type ActionType = "in" | "out" | "adjust";

interface StockActionModalProps {
  open: boolean;
  onClose: () => void;
  action: ActionType;
  productId: string;
  productName: string;
  currentStock: number;
}

const TITLES: Record<ActionType, string> = {
  in: "Add Stock",
  out: "Remove Stock",
  adjust: "Adjust Stock",
};

const ENDPOINTS: Record<ActionType, string> = {
  in: "/api/stock/in",
  out: "/api/stock/out",
  adjust: "/api/stock/adjust",
};

export function StockActionModal({
  open,
  onClose,
  action,
  productId,
  productName,
  currentStock,
}: StockActionModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState("");
  const [newQuantity, setNewQuantity] = useState(String(currentStock));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body =
        action === "adjust"
          ? { productId, newQuantity: parseInt(newQuantity, 10), reference, notes }
          : { productId, quantity: parseInt(quantity, 10), reference, notes };

      const res = await fetch(ENDPOINTS[action], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update stock");
        return;
      }
      router.refresh();
      onClose();
      setQuantity("");
      setReference("");
      setNotes("");
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={TITLES[action]} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">Product</p>
          <p className="text-sm font-medium text-gray-900">{productName}</p>
          <p className="text-xs text-gray-500">Current stock: <span className="font-semibold text-gray-700">{currentStock}</span></p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {action === "adjust" ? (
          <Input
            label="New Stock Quantity"
            required
            type="number"
            min="0"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
          />
        ) : (
          <Input
            label={action === "in" ? "Quantity to Add" : "Quantity to Remove"}
            required
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        )}

        <Input
          label="Reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. PO-2026-001"
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          rows={2}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            variant={action === "out" ? "danger" : "primary"}
          >
            {TITLES[action]}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
