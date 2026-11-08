import { unitName } from "../inventoryCatalog"
import type { Item } from "../models"

export type InventoryStatusTone = "pending" | "matched" | "tolerance" | "shortage"

export type InventoryStatus = {
  label: string
  tone: InventoryStatusTone
}

export function getInventoryStatus(
  product: Item,
  weight: number | null | undefined,
): InventoryStatus {
  if (weight == null) {
    return { label: "بانتظار الجرد", tone: "pending" }
  }
  const difference = Number((weight - product.opening_quantity).toFixed(3))
  const allowance = product.opening_quantity * (product.shrinkage_percent / 100)
  if (difference >= -allowance && difference <= 0) {
    return { label: "مطابق للرصيد المتوقع", tone: "matched" }
  }
  if (difference > 0) {
    return {
      label: `زيادة: +${difference.toFixed(2)} ${unitName(product)}`,
      tone: "tolerance",
    }
  }
  return {
    label: `عجز: ${difference.toFixed(2)} ${unitName(product)}`,
    tone: "shortage",
  }
}
