import { Capacitor } from "@capacitor/core"

export const INVENTORY_STORAGE_KEYS = [
  "smart-inventory-weights",
  "smart-inventory-movements",
  "smart-inventory-stock-ledger",
  "smart-inventory-recipe-components",
  "smart-inventory-schema-version",
  "smart-inventory-config",
  "smart-inventory-products",
  "smart-inventory-categories",
  "smart-inventory-owner-phone",
  "smart-inventory-owner-pin",
  "smart-inventory-pending-report",
  "smart-inventory-audit-history",
  "smart-inventory-theme",
  "smart-inventory-scale-name",
  "smart-inventory-current-shift",
  "smart-inventory-mascot-preferences",
  "smart-inventory-device-role",
  "smart-inventory-location-weights",
  "smart-inventory-transfers",
  "smart-inventory-transfer-lines",
  "smart-inventory-role-pins",
] as const

export type InventoryStorageKey = typeof INVENTORY_STORAGE_KEYS[number]
export type StorageEntries = Record<string, string | null>

export const INVENTORY_CLOUD_KEYS = [
  "smart-inventory-weights",
  "smart-inventory-movements",
  "smart-inventory-stock-ledger",
  "smart-inventory-recipe-components",
  "smart-inventory-schema-version",
  "smart-inventory-config",
  "smart-inventory-products",
  "smart-inventory-categories",
  "smart-inventory-audit-history",
  "smart-inventory-current-shift",
  "smart-inventory-location-weights",
  "smart-inventory-transfers",
  "smart-inventory-transfer-lines",
  "smart-inventory-role-pins",
] as const satisfies readonly InventoryStorageKey[]

export interface StorageRepository {
  readonly kind: "indexeddb" | "sqlite"
  initialize(): Promise<void>
  get(key: string): Promise<string | null>
  getAll(): Promise<StorageEntries>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  replace(entries: StorageEntries): Promise<void>
  close(): Promise<void>
}

class IndexedDbRepository implements StorageRepository {
  readonly kind = "indexeddb" as const
  private database: IDBDatabase | null = null

  async initialize() {
    this.database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("smart-inventory", 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains("key_value")) {
          database.createObjectStore("key_value")
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(request.error ?? new Error("تعذر فتح قاعدة بيانات المتصفح."))
      request.onblocked = () =>
        reject(new Error("قاعدة البيانات مفتوحة في إصدار قديم من التطبيق."))
    })
  }

  private store(mode: IDBTransactionMode) {
    if (!this.database) throw new Error("قاعدة البيانات غير مهيأة.")
    return this.database.transaction("key_value", mode).objectStore("key_value")
  }

  async get(key: string) {
    return await new Promise<string | null>((resolve, reject) => {
      const request = this.store("readonly").get(key)
      request.onsuccess = () =>
        resolve(typeof request.result === "string" ? request.result : null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAll() {
    return await new Promise<StorageEntries>((resolve, reject) => {
      const store = this.store("readonly")
      const keysRequest = store.getAllKeys()
      const valuesRequest = store.getAll()
      const finish = () => {
        if (
          keysRequest.readyState !== "done" ||
          valuesRequest.readyState !== "done"
        )
          return
        resolve(
          Object.fromEntries(
            keysRequest.result.map((key, index) => [
              String(key),
              typeof valuesRequest.result[index] === "string"
                ? valuesRequest.result[index]
                : null,
            ]),
          ),
        )
      }
      keysRequest.onsuccess = finish
      valuesRequest.onsuccess = finish
      keysRequest.onerror = () => reject(keysRequest.error)
      valuesRequest.onerror = () => reject(valuesRequest.error)
    })
  }

  async set(key: string, value: string) {
    await this.request(this.store("readwrite").put(value, key))
  }

  async remove(key: string) {
    await this.request(this.store("readwrite").delete(key))
  }

  async replace(entries: StorageEntries) {
    if (!this.database) throw new Error("قاعدة البيانات غير مهيأة.")
    await new Promise<void>((resolve, reject) => {
      const transaction = this.database!.transaction("key_value", "readwrite")
      const store = transaction.objectStore("key_value")
      Object.entries(entries).forEach(([key, value]) => {
        if (value === null) store.delete(key)
        else store.put(value, key)
      })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }

  private async request(request: IDBRequest) {
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async close() {
    this.database?.close()
    this.database = null
  }
}

class AndroidSqliteRepository implements StorageRepository {
  readonly kind = "sqlite" as const
  private database: import("@capacitor-community/sqlite").SQLiteDBConnection | null =
    null
  private sqlite: import("@capacitor-community/sqlite").SQLiteConnection | null =
    null

  async initialize() {
    const { CapacitorSQLite, SQLiteConnection } = await import(
      "@capacitor-community/sqlite"
    )
    this.sqlite = new SQLiteConnection(CapacitorSQLite)
    const secretStored = await this.sqlite.isSecretStored()
    if (!secretStored.result) {
      const secretBytes = crypto.getRandomValues(new Uint8Array(32))
      const passphrase = btoa(String.fromCharCode(...secretBytes))
      await this.sqlite.setEncryptionSecret(passphrase)
    }
    const consistency = await this.sqlite.checkConnectionsConsistency()
    const connectionExists = (
      await this.sqlite.isConnection("smart_inventory", false)
    ).result
    if (consistency.result && connectionExists) {
      this.database = await this.sqlite.retrieveConnection(
        "smart_inventory",
        false,
      )
    } else {
      this.database = await this.sqlite.createConnection(
        "smart_inventory",
        true,
        "secret",
        1,
        false,
      )
    }
    await this.database.open()
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS app_storage (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)
  }

  private connection() {
    if (!this.database) throw new Error("قاعدة بيانات Android غير مهيأة.")
    return this.database
  }

  async get(key: string) {
    const result = await this.connection().query(
      "SELECT value FROM app_storage WHERE key = ? LIMIT 1",
      [key],
    )
    const value = result.values?.[0]?.value
    return typeof value === "string" ? value : null
  }

  async getAll() {
    const result = await this.connection().query(
      "SELECT key, value FROM app_storage",
    )
    return Object.fromEntries(
      (result.values ?? []).map((row) => [String(row.key), String(row.value)]),
    )
  }

  async set(key: string, value: string) {
    await this.connection().run(
      `INSERT INTO app_storage (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, value, Date.now()],
    )
  }

  async remove(key: string) {
    await this.connection().run("DELETE FROM app_storage WHERE key = ?", [key])
  }

  async replace(entries: StorageEntries) {
    const statements = Object.entries(entries).map(([key, value]) =>
      value === null
        ? { statement: "DELETE FROM app_storage WHERE key = ?", values: [key] }
        : {
            statement: `INSERT INTO app_storage (key, value, updated_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(key) DO UPDATE SET
                          value = excluded.value,
                          updated_at = excluded.updated_at`,
            values: [key, value, Date.now()],
          },
    )
    if (statements.length) await this.connection().executeSet(statements)
  }

  async close() {
    if (this.database && (await this.database.isDBOpen()).result) {
      await this.database.close()
    }
    if (this.sqlite) await this.sqlite.closeConnection("smart_inventory", false)
    this.database = null
    this.sqlite = null
  }
}

function createRepository(): StorageRepository {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    return new AndroidSqliteRepository()
  }
  return new IndexedDbRepository()
}

export class InventoryStorage {
  private repository: StorageRepository | null = null
  private cache = new Map<string, string>()
  private cacheVersions = new Map<string, number>()
  private operationQueue = Promise.resolve()
  private writeError: unknown = null
  private mutationListener: ((entries: StorageEntries) => void) | null = null

  constructor(
    private readonly repositoryFactory: () => StorageRepository = createRepository,
  ) {}

  get kind() {
    return this.repository?.kind ?? "indexeddb"
  }

  setMutationListener(listener: ((entries: StorageEntries) => void) | null) {
    this.mutationListener = listener
  }

  async initialize() {
    if (this.repository) return
    const repository = this.repositoryFactory()
    await repository.initialize()
    const databaseEntries = await repository.getAll()
    const legacyEntries = this.readLegacyEntries()
    const migrationEntries = Object.fromEntries(
      Object.entries(legacyEntries).filter(
        ([key, value]) => databaseEntries[key] === undefined && value !== null,
      ),
    )
    if (Object.keys(migrationEntries).length) {
      await repository.replace(migrationEntries)
    }
    const entries = { ...databaseEntries, ...migrationEntries }
    this.cache = new Map(
      Object.entries(entries).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    )
    this.cacheVersions.clear()
    this.repository = repository

    if (repository.kind === "indexeddb") {
      try {
        await navigator.storage?.persist?.()
      } catch {
        // Persistence is best-effort; backups remain available.
      }
    }
  }

  private readLegacyEntries(): StorageEntries {
    const entries: StorageEntries = {}
    try {
      INVENTORY_STORAGE_KEYS.forEach((key) => {
        entries[key] = window.localStorage.getItem(key)
      })
    } catch {
      // localStorage may be unavailable; a fresh database is still usable.
    }
    return entries
  }

  legacySnapshot(keys: readonly string[] = INVENTORY_STORAGE_KEYS) {
    const entries = this.readLegacyEntries()
    return Object.fromEntries(keys.map((key) => [key, entries[key] ?? null]))
  }

  getCached(key: string, fallback = "") {
    return this.cache.get(key) ?? fallback
  }

  hasCached(key: string) {
    return this.cache.has(key)
  }

  snapshot(keys: readonly string[] = INVENTORY_STORAGE_KEYS) {
    return Object.fromEntries(
      keys.map((key) => [key, this.cache.get(key) ?? null]),
    )
  }

  set(key: string, value: string) {
    const previous = this.cache.get(key)
    const version = (this.cacheVersions.get(key) ?? 0) + 1
    this.cacheVersions.set(key, version)
    this.cache.set(key, value)
    void this.runSerialized(
      async (repository) => repository.set(key, value),
      true,
    )
      .then(() => this.mutationListener?.({ [key]: value }))
      .catch(() => {
        if (this.cacheVersions.get(key) !== version) return
        if (previous === undefined) this.cache.delete(key)
        else this.cache.set(key, previous)
      })
  }

  remove(key: string) {
    const previous = this.cache.get(key)
    const version = (this.cacheVersions.get(key) ?? 0) + 1
    this.cacheVersions.set(key, version)
    this.cache.delete(key)
    void this.runSerialized(async (repository) => repository.remove(key), true)
      .then(() => this.mutationListener?.({ [key]: null }))
      .catch(() => {
        if (this.cacheVersions.get(key) === version && previous !== undefined) {
          this.cache.set(key, previous)
        }
      })
  }

  async replace(entries: StorageEntries) {
    await this.runSerialized(async (repository) => {
      this.throwPendingWriteError()
      await repository.replace(entries)
    })
    this.updateCache(entries)
    this.mutationListener?.(entries)
  }

  async applyRemote(entries: StorageEntries) {
    await this.runSerialized(async (repository) => {
      this.throwPendingWriteError()
      await repository.replace(entries)
    })
    this.updateCache(entries)
  }

  private updateCache(entries: StorageEntries) {
    Object.entries(entries).forEach(([key, value]) => {
      this.cacheVersions.set(key, (this.cacheVersions.get(key) ?? 0) + 1)
      if (value === null) this.cache.delete(key)
      else this.cache.set(key, value)
    })
  }

  async flush() {
    await this.operationQueue
    this.throwPendingWriteError()
  }

  async close() {
    await this.flush()
    await this.repository?.close()
    this.repository = null
  }

  private runSerialized(
    operation: (repository: StorageRepository) => Promise<void>,
    captureError = false,
  ) {
    const run = this.operationQueue.then(() =>
      operation(this.requireRepository()),
    )
    this.operationQueue = run.then(
      () => undefined,
      (error) => {
        if (!captureError) return
        this.writeError = error
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("smart-inventory-storage-error", { detail: error }),
          )
        }
      },
    )
    return run
  }

  private throwPendingWriteError() {
    if (!this.writeError) return
    const error = this.writeError
    this.writeError = null
    throw error
  }

  private requireRepository() {
    if (!this.repository) throw new Error("مستودع البيانات غير مهيأ.")
    return this.repository
  }
}

export const inventoryStorage = new InventoryStorage()
