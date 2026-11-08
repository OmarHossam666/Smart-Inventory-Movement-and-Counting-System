import { projectId, publicAnonKey } from "../../utils/supabase/info"
import {
  INVENTORY_CLOUD_KEYS,
  type StorageEntries,
} from "../storage/repository"

type CloudSnapshot = {
  entries: StorageEntries
  revision: number
  updated_at: string
}

const cloudKeySet = new Set<string>(INVENTORY_CLOUD_KEYS)
const endpoint = `https://${projectId}.supabase.co/functions/v1/make-server-c657b9c4/inventory`

export function pickCloudEntries(entries: StorageEntries): StorageEntries {
  return Object.fromEntries(
    Object.entries(entries).filter(([key]) => cloudKeySet.has(key)),
  )
}

export function parseCloudSnapshot(value: unknown): CloudSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cloud inventory snapshot is invalid.")
  }
  const candidate = value as Partial<CloudSnapshot>
  if (
    !candidate.entries ||
    typeof candidate.entries !== "object" ||
    Array.isArray(candidate.entries) ||
    !Number.isFinite(candidate.revision) ||
    typeof candidate.updated_at !== "string"
  ) {
    throw new Error("Cloud inventory snapshot is invalid.")
  }
  const entries = Object.fromEntries(
    Object.entries(candidate.entries).filter(
      ([key, entry]) =>
        cloudKeySet.has(key) && (typeof entry === "string" || entry === null),
    ),
  )
  return {
    entries,
    revision: Math.max(0, Number(candidate.revision)),
    updated_at: candidate.updated_at,
  }
}

export class SupabaseInventorySync {
  private revision = 0
  private pending: StorageEntries = {}
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private inFlight = Promise.resolve()

  async initialize(localEntries: StorageEntries) {
    try {
      const snapshot = parseCloudSnapshot(
        await this.request<unknown>("/bootstrap", {
          method: "POST",
          body: JSON.stringify({ entries: pickCloudEntries(localEntries) }),
        }),
      )
      this.revision = snapshot.revision
      this.publishStatus("synced")
      return pickCloudEntries(snapshot.entries)
    } catch {
      this.publishStatus("offline")
      return null
    }
  }

  queue(entries: StorageEntries) {
    const cloudEntries = pickCloudEntries(entries)
    if (!Object.keys(cloudEntries).length) return
    this.pending = { ...this.pending, ...cloudEntries }
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      void this.pushPending()
    }, 250)
  }

  async flush() {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
    await this.pushPending()
    await this.inFlight
  }

  async pull() {
    if (Object.keys(this.pending).length) await this.pushPending()
    try {
      const snapshot = parseCloudSnapshot(await this.request<unknown>("/state"))
      if (snapshot.revision <= this.revision) {
        this.publishStatus("synced")
        return null
      }
      this.revision = snapshot.revision
      this.publishStatus("synced")
      return pickCloudEntries(snapshot.entries)
    } catch {
      this.publishStatus("offline")
      return null
    }
  }

  private async pushPending() {
    const entries = this.pending
    if (!Object.keys(entries).length) return
    this.pending = {}
    this.inFlight = this.inFlight.then(async () => {
      try {
        const snapshot = parseCloudSnapshot(
          await this.request<unknown>("/state", {
            method: "PUT",
            body: JSON.stringify({ entries }),
          }),
        )
        this.revision = Math.max(this.revision, snapshot.revision)
        this.publishStatus("synced")
      } catch {
        this.pending = { ...entries, ...this.pending }
        this.publishStatus("offline")
      }
    })
    await this.inFlight
  }

  private async request<T,>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    try {
      const response = await fetch(`${endpoint}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          "Content-Type": "application/json",
          apikey: publicAnonKey,
          ...init.headers,
        },
      })
      if (!response.ok) {
        throw new Error(`Supabase inventory sync failed: ${response.status}`)
      }
      return (await response.json()) as T
    } finally {
      clearTimeout(timeout)
    }
  }

  private publishStatus(status: "synced" | "offline") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("smart-inventory-cloud-status", { detail: status }),
      )
    }
  }
}

export const supabaseInventorySync = new SupabaseInventorySync()
