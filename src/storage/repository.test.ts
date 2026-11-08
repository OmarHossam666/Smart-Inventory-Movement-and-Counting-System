import { describe, expect, it } from "vitest"
import {
  INVENTORY_STORAGE_KEYS,
  InventoryStorage,
  type StorageEntries,
  type StorageRepository,
} from "./repository"

class MemoryRepository implements StorageRepository {
  readonly kind = "indexeddb" as const
  entries: StorageEntries = {}

  async initialize() {}
  async get(key: string) {
    return this.entries[key] ?? null
  }
  async getAll() {
    return { ...this.entries }
  }
  async set(key: string, value: string) {
    this.entries[key] = value
  }
  async remove(key: string) {
    delete this.entries[key]
  }
  async replace(entries: StorageEntries) {
    Object.entries(entries).forEach(([key, value]) => {
      if (value === null) delete this.entries[key]
      else this.entries[key] = value
    })
  }
  async close() {}
}

class ConcurrentRepository extends MemoryRepository {
  activeReplacements = 0
  maximumConcurrentReplacements = 0

  async replace(entries: StorageEntries) {
    this.activeReplacements += 1
    this.maximumConcurrentReplacements = Math.max(
      this.maximumConcurrentReplacements,
      this.activeReplacements,
    )
    await new Promise((resolve) => setTimeout(resolve, 5))
    await super.replace(entries)
    this.activeReplacements -= 1
  }
}

describe("InventoryStorage", () => {
  it("persists queued writes and removals after flush", async () => {
    const repository = new MemoryRepository()
    const storage = new InventoryStorage(() => repository)
    await storage.initialize()

    storage.set("products", "[1]")
    storage.set("theme", "dark")
    storage.remove("products")
    await storage.flush()

    expect(repository.entries).toEqual({ theme: "dark" })
    expect(storage.snapshot(["products", "theme"])).toEqual({
      products: null,
      theme: "dark",
    })
  })

  it("replaces related values as one durable operation", async () => {
    const repository = new MemoryRepository()
    repository.entries = { products: "old", weights: "old" }
    const storage = new InventoryStorage(() => repository)
    await storage.initialize()

    await storage.replace({
      products: "new",
      weights: null,
      movements: "new",
    })

    expect(repository.entries).toEqual({
      products: "new",
      movements: "new",
    })
    expect(storage.getCached("products")).toBe("new")
    expect(storage.hasCached("weights")).toBe(false)
  })

  it("serializes concurrent replacements in call order", async () => {
    const repository = new ConcurrentRepository()
    const storage = new InventoryStorage(() => repository)
    await storage.initialize()

    await Promise.all([
      storage.replace({ products: "first" }),
      storage.replace({ products: "second" }),
    ])

    expect(repository.maximumConcurrentReplacements).toBe(1)
    expect(repository.entries.products).toBe("second")
    expect(storage.getCached("products")).toBe("second")
  })

  it("does not notify cloud listeners when a local write fails", async () => {
    const repository = new MemoryRepository()
    repository.entries.products = "old"
    repository.set = async () => {
      throw new Error("disk full")
    }
    const storage = new InventoryStorage(() => repository)
    const mutations: StorageEntries[] = []
    await storage.initialize()
    storage.setMutationListener((entries) => mutations.push(entries))

    storage.set("products", "new")
    await expect(storage.flush()).rejects.toThrow("disk full")

    expect(mutations).toEqual([])
    expect(storage.getCached("products")).toBe("old")
  })

  it("restores every flushed value after the application repository reopens", async () => {
    const repository = new MemoryRepository()
    const firstSession = new InventoryStorage(() => repository)
    await firstSession.initialize()
    firstSession.set("smart-inventory-products", '[{"id":7}]')
    firstSession.set("smart-inventory-weights", '{"7":12.5}')
    firstSession.set("smart-inventory-theme", "dark")
    await firstSession.close()

    const reopenedSession = new InventoryStorage(() => repository)
    await reopenedSession.initialize()

    expect(reopenedSession.getCached("smart-inventory-products")).toBe(
      '[{"id":7}]',
    )
    expect(reopenedSession.getCached("smart-inventory-weights")).toBe(
      '{"7":12.5}',
    )
    expect(reopenedSession.getCached("smart-inventory-theme")).toBe("dark")
  })

  it("includes every durable application data group in backup coverage", () => {
    expect(new Set(INVENTORY_STORAGE_KEYS).size).toBe(
      INVENTORY_STORAGE_KEYS.length,
    )
    expect(INVENTORY_STORAGE_KEYS).toEqual(
      expect.arrayContaining([
        "smart-inventory-products",
        "smart-inventory-config",
        "smart-inventory-weights",
        "smart-inventory-movements",
        "smart-inventory-audit-history",
        "smart-inventory-current-shift",
        "smart-inventory-owner-phone",
        "smart-inventory-owner-pin",
        "smart-inventory-theme",
        "smart-inventory-scale-name",
        "smart-inventory-pending-report",
        "smart-inventory-mascot-preferences",
        "smart-inventory-device-role",
        "smart-inventory-location-weights",
        "smart-inventory-transfers",
        "smart-inventory-transfer-lines",
        "smart-inventory-role-pins",
      ]),
    )
  })
})
