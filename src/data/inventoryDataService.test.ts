import { describe, expect, it } from "vitest"
import type { Item } from "../models"
import {
  chooseInitialCloudEntries,
  migrateItemImage,
  normalizeLocationWeights,
  prepareBackupReplacements,
  pruneItemLedger,
  pruneItemRelations,
  selectItemMigrationSource,
  inventoryDataService,
  validateTransferRequest,
} from "./inventoryDataService"

describe("inventory data initialization", () => {
  it("keeps a new customer catalog empty instead of loading demo products", () => {
    expect(selectItemMigrationSource([])).toEqual([])
  })

  it("preserves an explicitly emptied catalog across refresh", () => {
    const persisted = JSON.parse("[]") as Array<Record<string, unknown>>
    expect(selectItemMigrationSource(persisted)).toBe(persisted)
  })

  it("still migrates products that the customer already saved", () => {
    const persisted = [{ id: 7, title: "صنف العميل" }]
    expect(selectItemMigrationSource(persisted)).toEqual(persisted)
  })

  it("fills missing per-location weights before rendering synced products", () => {
    const item = {
      id: "item-1",
      initial_quantity: 8,
    } as Item

    expect(
      normalizeLocationWeights([item], { "item-1": 8 }, {
        butcher: {},
        restaurant: {},
      }),
    ).toEqual({
      butcher: { "item-1": null },
      restaurant: { "item-1": 8 },
    })
  })

  it("drops stale and non-numeric location weights during normalization", () => {
    const item = {
      id: "item-1",
      initial_quantity: 8,
    } as Item

    expect(
      normalizeLocationWeights([item], { "item-1": 8 }, {
        butcher: { "item-1": Number.NaN, orphan: 12 },
        restaurant: { orphan: 4 },
      }),
    ).toEqual({
      butcher: { "item-1": null },
      restaurant: { "item-1": 8 },
    })
  })

  it("does not let an empty cloud catalog erase products on a device", () => {
    const local = {
      "smart-inventory-products": JSON.stringify([{ id: "local-item" }]),
      "smart-inventory-weights": '{"local-item":5}',
    }
    const remote = {
      "smart-inventory-products": "[]",
      "smart-inventory-weights": "{}",
    }

    expect(chooseInitialCloudEntries(local, remote)).toBe(local)
  })

  it("replaces only the legacy spices placeholder with the category photo", () => {
    expect(
      migrateItemImage(
        "44444444-4444-4444-8444-444444444444",
        "data:image/svg+xml,legacy-spices",
      ),
    ).toContain("images.unsplash.com")
    expect(
      migrateItemImage(
        "44444444-4444-4444-8444-444444444444",
        "data:image/jpeg;base64,custom-photo",
      ),
    ).toBe("data:image/jpeg;base64,custom-photo")
  })

  it("removes a deleted item without disturbing neighboring relation maps", () => {
    const relations = {
      "item-1": { opening_quantity: 2 },
      "item-2": { opening_quantity: 7 },
    }

    expect(pruneItemRelations("item-1", relations)).toEqual({
      "item-2": { opening_quantity: 7 },
    })
    expect(relations).toHaveProperty("item-1")
  })

  it("removes child deductions when their deleted composite parent is removed", () => {
    const base = {
      location: "restaurant" as const,
      unit: "piece" as const,
      reference_id: null,
      note: "",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    }
    const ledger = [
      {
        ...base,
        id: "parent",
        item_id: "composite",
        type: "count" as const,
        quantity: 2,
        parent_movement_id: null,
      },
      {
        ...base,
        id: "child",
        item_id: "ingredient",
        type: "auto_deduct" as const,
        quantity: -200,
        parent_movement_id: "parent",
      },
      {
        ...base,
        id: "unrelated",
        item_id: "ingredient",
        type: "waste" as const,
        quantity: -10,
        parent_movement_id: null,
      },
    ]

    expect(
      pruneItemLedger("composite", ledger).map((entry) => entry.id),
    ).toEqual(["unrelated"])
  })

  it("rejects invalid and duplicated transfer lines before changing stock", () => {
    expect(
      validateTransferRequest([
        { item_id: "item-1", quantity_sent: 2 },
        { item_id: "item-1", quantity_sent: 3 },
      ]),
    ).toContain("تكرار")
    expect(
      validateTransferRequest([
        { item_id: "item-1", quantity_sent: Number.NaN },
      ]),
    ).toContain("صحيحة")
  })

  it("clears stale keys that are absent from a restored backup", () => {
    const replacements = prepareBackupReplacements({
      app: "smart-inventory",
      version: 2,
      exportedAt: "2025-01-01T00:00:00.000Z",
      data: { "smart-inventory-products": "[]" },
    })

    expect(replacements["smart-inventory-products"]).toBe("[]")
    expect(replacements["smart-inventory-weights"]).toBeNull()
    expect(replacements["smart-inventory-owner-pin"]).toBeNull()
  })

  it("rejects backups with an invalid export date", () => {
    expect(() =>
      inventoryDataService.validateBackup({
        app: "smart-inventory",
        version: 2,
        exportedAt: "not-a-date",
        data: { "smart-inventory-products": "[]" },
      }),
    ).toThrow("متوافقة")
  })
})
