import { describe, expect, it } from "vitest"
import type { Item } from "../models"
import {
  chooseInitialCloudEntries,
  mergeLocationWeights,
  mergeRolePins,
  mergeStockLedger,
  mergeTransfers,
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

  describe("multi-device synchronization merging", () => {
    it("preserves butcher weights on butcher device and avoids remote clobbering", () => {
      const local = {
        butcher: { "item-1": 15 },
        restaurant: { "item-1": 5 },
      }
      const remote = {
        butcher: { "item-1": 10 },
        restaurant: { "item-1": 8 },
      }

      // On butcher device, local butcher weights must win, restaurant weights take remote
      const merged = mergeLocationWeights(local, remote, "butcher")
      expect(merged.butcher["item-1"]).toBe(15)
      expect(merged.restaurant["item-1"]).toBe(8)
    })

    it("preserves restaurant weights on restaurant device and takes butcher updates", () => {
      const local = {
        butcher: { "item-1": 10 },
        restaurant: { "item-1": 20 },
      }
      const remote = {
        butcher: { "item-1": 15 },
        restaurant: { "item-1": 12 },
      }

      // On restaurant device, local restaurant weights must win, butcher weights take remote
      const merged = mergeLocationWeights(local, remote, "restaurant")
      expect(merged.butcher["item-1"]).toBe(15)
      expect(merged.restaurant["item-1"]).toBe(20)
    })

    it("never allows a received transfer to revert back to sent status", () => {
      const local = [
        {
          id: "T1",
          status: "Received" as const,
          from_location: "butcher" as const,
          to_location: "restaurant" as const,
          sent_at: "2026-01-01T10:00:00.000Z",
          received_at: "2026-01-01T10:05:00.000Z",
          cancelled_reason: null,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:05:00.000Z",
        },
      ]
      const staleRemote = [
        {
          id: "T1",
          status: "Sent" as const,
          from_location: "butcher" as const,
          to_location: "restaurant" as const,
          sent_at: "2026-01-01T10:00:00.000Z",
          received_at: null,
          cancelled_reason: null,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
        },
      ]

      const merged = mergeTransfers(local, staleRemote)
      expect(merged).toHaveLength(1)
      expect(merged[0].status).toBe("Received")
      expect(merged[0].received_at).toBe("2026-01-01T10:05:00.000Z")
    })

    it("accepts a newly received transfer from remote onto sender device", () => {
      const localSent = [
        {
          id: "T1",
          status: "Sent" as const,
          from_location: "butcher" as const,
          to_location: "restaurant" as const,
          sent_at: "2026-01-01T10:00:00.000Z",
          received_at: null,
          cancelled_reason: null,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
        },
      ]
      const remoteReceived = [
        {
          id: "T1",
          status: "Received" as const,
          from_location: "butcher" as const,
          to_location: "restaurant" as const,
          sent_at: "2026-01-01T10:00:00.000Z",
          received_at: "2026-01-01T10:05:00.000Z",
          cancelled_reason: null,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:05:00.000Z",
        },
      ]

      const merged = mergeTransfers(localSent, remoteReceived)
      expect(merged[0].status).toBe("Received")
    })

    it("ensures non-owner devices always accept owner-configured PINs", () => {
      const localDefault = { butcher: "0000", restaurant: "0000" }
      const remoteCustom = { butcher: "1234", restaurant: "5678" }

      const onButcher = mergeRolePins(localDefault, remoteCustom, "butcher")
      expect(onButcher.butcher).toBe("1234")
      expect(onButcher.restaurant).toBe("5678")

      const onRestaurant = mergeRolePins(localDefault, remoteCustom, "restaurant")
      expect(onRestaurant.butcher).toBe("1234")
      expect(onRestaurant.restaurant).toBe("5678")
    })

    it("merges stock ledger movements without duplicating IDs and orders chronologically", () => {
      const local = [
        {
          id: "M1",
          item_id: "I1",
          location: "butcher" as const,
          type: "count" as const,
          quantity: 10,
          unit: "g" as const,
          parent_movement_id: null,
          reference_id: null,
          note: "",
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
        },
      ]
      const remote = [
        {
          id: "M1", // Duplicate
          item_id: "I1",
          location: "butcher" as const,
          type: "count" as const,
          quantity: 10,
          unit: "g" as const,
          parent_movement_id: null,
          reference_id: null,
          note: "",
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
        },
        {
          id: "M2", // New from restaurant
          item_id: "I1",
          location: "restaurant" as const,
          type: "count" as const,
          quantity: 5,
          unit: "g" as const,
          parent_movement_id: null,
          reference_id: null,
          note: "",
          created_at: "2026-01-01T10:02:00.000Z",
          updated_at: "2026-01-01T10:02:00.000Z",
        },
      ]

      const merged = mergeStockLedger(local, remote)
      expect(merged).toHaveLength(2)
      expect(merged.map((m) => m.id)).toEqual(["M1", "M2"])
    })
  })
})
