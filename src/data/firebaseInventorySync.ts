import {
  collection,
  doc,
  writeBatch,
  getDocs,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { getFirebaseFirestore } from "./firebase/config"
import { storeAuthService } from "./firebase/authService"
import {
  INVENTORY_CLOUD_KEYS,
  type StorageEntries,
} from "../storage/repository"
import type { DeviceRole } from "../models"

export type FirebaseSnapshotRecord = {
  value: string | null
  updated_at?: unknown
}

export type DevicePresence = {
  online: boolean
  lastSeen: number
  deviceId?: string
}

export type PresenceMap = {
  butcher?: DevicePresence
  restaurant?: DevicePresence
  owner?: DevicePresence
}

const cloudKeySet = new Set<string>(INVENTORY_CLOUD_KEYS)
const DEFAULT_BRANCH_ID = "main_branch"

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "node_device"
  let id = localStorage.getItem("smart-inventory-device-uuid")
  if (!id) {
    id =
      "dev_" +
      Math.random().toString(36).slice(2, 9) +
      "_" +
      Date.now().toString(36)
    localStorage.setItem("smart-inventory-device-uuid", id)
  }
  return id
}

export function pickCloudEntries(
  entries: StorageEntries,
  role?: DeviceRole | null,
): StorageEntries {
  return Object.fromEntries(
    Object.entries(entries).filter(([key]) => {
      if (!cloudKeySet.has(key)) return false
      // Non-owner devices (butcher, restaurant) must never push/overwrite role-pins
      if (
        key === "smart-inventory-role-pins" &&
        (role === "butcher" || role === "restaurant")
      ) {
        return false
      }
      return true
    }),
  )
}

export function parseCloudDocumentValue(value: unknown): string | null {
  if (value === null || typeof value === "string") {
    return value
  }
  return null
}

export class FirebaseInventorySync {
  private branchId: string
  private unsubscribeListener: Unsubscribe | null = null
  private presenceUnsubscribe: Unsubscribe | null = null
  private pending: StorageEntries = {}
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private inFlight = Promise.resolve()
  private onRemoteUpdateCallback:
    | ((entries: StorageEntries) => void | Promise<void>)
    | null = null
  private isApplyingRemote = false
  private currentRole: DeviceRole | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private presenceMap: PresenceMap = {}
  private presenceListeners = new Set<(presence: PresenceMap) => void>()

  constructor(branchId = DEFAULT_BRANCH_ID) {
    this.branchId = branchId
  }

  setRemoteUpdateListener(
    listener: ((entries: StorageEntries) => void | Promise<void>) | null,
  ) {
    this.onRemoteUpdateCallback = listener
  }

  setCurrentRole(role: DeviceRole | null) {
    this.currentRole = role
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (role) {
      void this.sendHeartbeat()
      this.heartbeatTimer = setInterval(() => {
        void this.sendHeartbeat()
      }, 12_000)
    }
  }

  private async sendHeartbeat() {
    if (!this.currentRole) return
    try {
      const db = getFirebaseFirestore()
      const presenceDoc = doc(
        db,
        "branches",
        this.branchId,
        "presence",
        this.currentRole,
      )
      await setDoc(
        presenceDoc,
        {
          role: this.currentRole,
          deviceId: getOrCreateDeviceId(),
          lastSeen: Date.now(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (err) {
      console.warn("Heartbeat write warning:", err)
    }
  }

  startPresenceListener() {
    if (this.presenceUnsubscribe) return

    try {
      const db = getFirebaseFirestore()
      const presenceColl = collection(db, "branches", this.branchId, "presence")

      this.presenceUnsubscribe = onSnapshot(
        presenceColl,
        (snapshot) => {
          const now = Date.now()
          const nextMap: PresenceMap = {
            butcher: { online: false, lastSeen: 0 },
            restaurant: { online: false, lastSeen: 0 },
            owner: { online: false, lastSeen: 0 },
          }

          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as {
              role?: DeviceRole
              lastSeen?: number
              deviceId?: string
            }
            const role = (data?.role || docSnap.id) as DeviceRole
            if (role === "butcher" || role === "restaurant" || role === "owner") {
              const lastSeen =
                typeof data.lastSeen === "number" ? data.lastSeen : 0
              const isLocalRole =
                this.currentRole === role &&
                data.deviceId === getOrCreateDeviceId()
              const online = isLocalRole || now - lastSeen < 35_000
              nextMap[role] = {
                online,
                lastSeen: isLocalRole ? now : lastSeen,
                deviceId: data.deviceId,
              }
            }
          })

          // Ensure local role is always marked online
          if (this.currentRole) {
            nextMap[this.currentRole] = {
              online: true,
              lastSeen: now,
              deviceId: getOrCreateDeviceId(),
            }
          }

          this.presenceMap = nextMap
          this.presenceListeners.forEach((listener) => {
            try {
              listener(nextMap)
            } catch (err) {
              console.error("Presence listener error:", err)
            }
          })

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("smart-inventory-presence-changed", {
                detail: nextMap,
              }),
            )
          }
        },
        (error) => {
          console.warn("Presence snapshot warning:", error)
        },
      )
    } catch (error) {
      console.warn("Could not start presence listener:", error)
    }
  }

  getPresence(): PresenceMap {
    return this.presenceMap
  }

  subscribePresence(listener: (presence: PresenceMap) => void): () => void {
    this.presenceListeners.add(listener)
    listener(this.presenceMap)
    return () => {
      this.presenceListeners.delete(listener)
    }
  }

  async initialize(
    localEntries: StorageEntries,
  ): Promise<StorageEntries | null> {
    try {
      try {
        await storeAuthService.ensureDeviceAuthenticated()
      } catch (authError) {
        console.warn("Device authentication fallback:", authError)
      }
      this.branchId = storeAuthService.getBranchId()

      const db = getFirebaseFirestore()
      const keysCollection = collection(db, "branches", this.branchId, "keys")
      const snapshot = await getDocs(keysCollection)

      const remoteEntries: StorageEntries = {}
      snapshot.forEach((document) => {
        if (cloudKeySet.has(document.id)) {
          const data = document.data() as Partial<FirebaseSnapshotRecord>
          remoteEntries[document.id] = parseCloudDocumentValue(data?.value)
        }
      })

      const filteredLocal = pickCloudEntries(localEntries)
      // If remote has no keys yet and local has data, bootstrap remote
      if (snapshot.empty && Object.keys(filteredLocal).length > 0) {
        const batch = writeBatch(db)
        Object.entries(filteredLocal).forEach(([key, value]) => {
          batch.set(doc(keysCollection, key), {
            value,
            updated_at: serverTimestamp(),
          })
        })
        await batch.commit()
        this.publishStatus("synced")
        this.startRealtimeListener()
        this.startPresenceListener()
        return filteredLocal
      }

      this.publishStatus("synced")
      this.startRealtimeListener()
      this.startPresenceListener()
      return remoteEntries
    } catch (error) {
      console.warn("Firebase inventory sync failed to initialize:", error)
      this.publishStatus("offline")
      return null
    }
  }

  startRealtimeListener() {
    if (this.unsubscribeListener) return

    try {
      const db = getFirebaseFirestore()
      const keysCollection = collection(db, "branches", this.branchId, "keys")

      this.unsubscribeListener = onSnapshot(
        keysCollection,
        async (snapshot) => {
          // If the snapshot has pending local writes and we want to avoid echo loops
          if (snapshot.metadata.hasPendingWrites) {
            return
          }

          const changedEntries: StorageEntries = {}
          const currentDeviceId = getOrCreateDeviceId()

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const key = change.doc.id
              const docData = change.doc.data() as Partial<FirebaseSnapshotRecord> & {
                updated_by?: string
                sender_role?: string
              }
              if (key === "smart-inventory-sync-ping") {
                try {
                  const raw = parseCloudDocumentValue(docData?.value)
                  if (raw && typeof window !== "undefined") {
                    const parsed = JSON.parse(raw) as {
                      role: string
                      time: number
                      senderId?: string
                    }
                    // Only dispatch if ping was within the last 45s and not from this exact device
                    if (
                      Date.now() - parsed.time < 45_000 &&
                      parsed.senderId !== currentDeviceId
                    ) {
                      window.dispatchEvent(
                        new CustomEvent("smart-inventory-ping-received", {
                          detail: parsed,
                        }),
                      )
                    }
                  }
                } catch {
                  // ignore ping parse errors
                }
                return
              }

              // CRITICAL: Suppress echo of writes committed by this very device!
              // This device already holds this data in memory and local storage.
              // Re-applying our own acknowledged write resets input and triggers race conditions.
              if (docData?.updated_by === currentDeviceId) {
                return
              }

              if (cloudKeySet.has(key)) {
                changedEntries[key] = parseCloudDocumentValue(docData?.value)
              }
            }
          })

          if (Object.keys(changedEntries).length > 0) {
            this.publishStatus("synced")
            if (!this.isApplyingRemote) {
              this.isApplyingRemote = true
              try {
                await this.onRemoteUpdateCallback?.(changedEntries)
              } finally {
                this.isApplyingRemote = false
              }
            }
          }
        },
        (error) => {
          console.warn("Firebase snapshot error:", error)
          this.publishStatus("offline")
        },
      )
    } catch (error) {
      console.warn("Could not start Firebase realtime listener:", error)
      this.publishStatus("offline")
    }
  }

  getBranchId(): string {
    return this.branchId
  }

  async switchBranch(newBranchId: string): Promise<StorageEntries | null> {
    const sanitized = newBranchId.trim() || DEFAULT_BRANCH_ID
    this.close()
    this.branchId = sanitized
    storeAuthService.setBranchId(sanitized)
    const remoteEntries = await this.pull()
    this.startRealtimeListener()
    this.startPresenceListener()
    if (this.currentRole) {
      void this.sendHeartbeat()
    }
    return remoteEntries
  }

  async sendPing(role: string, senderId?: string): Promise<boolean> {
    try {
      const db = getFirebaseFirestore()
      const pingDoc = doc(
        db,
        "branches",
        this.branchId,
        "keys",
        "smart-inventory-sync-ping",
      )
      const uniqueId = senderId || getOrCreateDeviceId()
      await setDoc(pingDoc, {
        value: JSON.stringify({ role, time: Date.now(), senderId: uniqueId }),
        updated_at: serverTimestamp(),
      })
      this.publishStatus("synced")
      void this.sendHeartbeat()
      return true
    } catch (error) {
      console.warn("Failed to send sync ping:", error)
      return false
    }
  }

  queue(entries: StorageEntries) {
    if (this.isApplyingRemote) return
    const cloudEntries = pickCloudEntries(entries, this.currentRole)
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

  async pull(): Promise<StorageEntries | null> {
    if (Object.keys(this.pending).length) {
      await this.pushPending()
    }

    try {
      const db = getFirebaseFirestore()
      const keysCollection = collection(db, "branches", this.branchId, "keys")
      const snapshot = await getDocs(keysCollection)

      const remoteEntries: StorageEntries = {}
      snapshot.forEach((document) => {
        if (cloudKeySet.has(document.id)) {
          const data = document.data() as Partial<FirebaseSnapshotRecord>
          remoteEntries[document.id] = parseCloudDocumentValue(data?.value)
        }
      })

      this.publishStatus("synced")
      return pickCloudEntries(remoteEntries, this.currentRole)
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
        const db = getFirebaseFirestore()
        const batch = writeBatch(db)
        const keysRef = collection(db, "branches", this.branchId, "keys")
        const deviceId = getOrCreateDeviceId()

        Object.entries(entries).forEach(([key, value]) => {
          if (cloudKeySet.has(key)) {
            batch.set(
              doc(keysRef, key),
              {
                value,
                updated_at: serverTimestamp(),
                updated_by: deviceId,
                sender_role: this.currentRole || "unknown",
              },
              { merge: true },
            )
          }
        })

        await batch.commit()
        this.publishStatus("synced")
      } catch (error) {
        console.warn("Firebase push pending failed:", error)
        this.pending = { ...entries, ...this.pending }
        this.publishStatus("offline")
      }
    })
    await this.inFlight
  }

  close() {
    if (this.unsubscribeListener) {
      this.unsubscribeListener()
      this.unsubscribeListener = null
    }
    if (this.presenceUnsubscribe) {
      this.presenceUnsubscribe()
      this.presenceUnsubscribe = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
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

export const firebaseInventorySync = new FirebaseInventorySync()
