import { describe, expect, it } from "vitest"
import { parseCloudSnapshot, pickCloudEntries } from "./supabaseInventorySync"

describe("Supabase inventory sync", () => {
  it("uploads shared inventory while keeping device settings private", () => {
    expect(
      pickCloudEntries({
        "smart-inventory-products": "[]",
        "smart-inventory-location-weights": "{}",
        "smart-inventory-transfers": "[]",
        "smart-inventory-device-role": "butcher",
        "smart-inventory-owner-pin": "1234",
        "smart-inventory-owner-phone": "966500000000",
        "smart-inventory-theme": "dark",
      }),
    ).toEqual({
      "smart-inventory-products": "[]",
      "smart-inventory-location-weights": "{}",
      "smart-inventory-transfers": "[]",
    })
  })

  it("rejects malformed snapshots and removes unknown remote keys", () => {
    expect(() => parseCloudSnapshot({ entries: [], revision: 1 })).toThrow()
    expect(
      parseCloudSnapshot({
        entries: {
          "smart-inventory-products": "[]",
          "smart-inventory-theme": "dark",
          "smart-inventory-weights": 7,
        },
        revision: 3,
        updated_at: "2025-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      entries: { "smart-inventory-products": "[]" },
      revision: 3,
      updated_at: "2025-01-01T00:00:00.000Z",
    })
  })
})
