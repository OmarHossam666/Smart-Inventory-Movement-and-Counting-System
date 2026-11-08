import { describe, expect, it } from "vitest"
import { CATEGORY_IDS } from "../inventoryCatalog"
import type { Item } from "../models"
import { getInventoryStatus } from "./inventoryStatus"

const product: Item = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  category_id: CATEGORY_IDS.meat,
  name_ar: "لحم بقري",
  name_en: "Beef",
  unit: "kg",
  unit_label: "كجم",
  package_size: 1,
  opening_quantity: 100,
  minimum_stock_alert: 10,
  cost_per_unit: 20,
  shrinkage_percent: 2,
  initial_quantity: null,
  image_url: "",
  active: true,
  is_composite: false,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
}

describe("getInventoryStatus", () => {
  it("keeps an uncounted item pending", () => {
    expect(getInventoryStatus(product, null).tone).toBe("pending")
    expect(getInventoryStatus(product, undefined).tone).toBe("pending")
  })

  it("matches exact and allowed shrinkage readings", () => {
    expect(getInventoryStatus(product, 100).tone).toBe("matched")
    expect(getInventoryStatus(product, 98).tone).toBe("matched")
  })

  it("marks a reading below the allowed shrinkage as shortage", () => {
    expect(getInventoryStatus(product, 97.999).tone).toBe("shortage")
  })

  it("keeps surplus stock distinct from a verified match", () => {
    expect(getInventoryStatus(product, 100.1).tone).toBe("tolerance")
  })

  it("uses gram quantities without converting the persisted amount", () => {
    const spice = {
      ...product,
      category_id: CATEGORY_IDS.spices,
      unit: "g" as const,
      opening_quantity: 500,
      shrinkage_percent: 0,
    }
    expect(getInventoryStatus(spice, 500).tone).toBe("matched")
    expect(getInventoryStatus(spice, 499).tone).toBe("shortage")
  })
})
