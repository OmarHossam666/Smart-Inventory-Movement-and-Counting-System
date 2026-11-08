import { Hono } from "npm:hono"
import { cors } from "npm:hono/cors"
import { logger } from "npm:hono/logger"
import * as kv from "./kv_store.tsx"
const app = new Hono()

const INVENTORY_STATE_KEY = "smart-inventory:shared-state:v1"
const MAX_REQUEST_BYTES = 5 * 1024 * 1024
const MAX_ENTRY_BYTES = 2 * 1024 * 1024
const INVENTORY_KEYS = new Set([
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
])

type InventoryState = {
  entries: Record<string, string | null>
  revision: number
  updated_at: string
}

function sanitizeEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, entry]) =>
        INVENTORY_KEYS.has(key) &&
        (entry === null ||
          (typeof entry === "string" &&
            new TextEncoder().encode(entry).byteLength <= MAX_ENTRY_BYTES)),
    ),
  )
}

function createState(
  entries: Record<string, string | null>,
  revision: number,
): InventoryState {
  return {
    entries,
    revision,
    updated_at: new Date().toISOString(),
  }
}

function storedRevision(value: unknown) {
  const revision = Number(value)
  return Number.isFinite(revision) && revision >= 0 ? revision : 0
}

// Enable logger
app.use("*", logger(console.log))

app.use("/*", async (c, next) => {
  const contentLength = Number(c.req.header("content-length") ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return c.json({ error: "Request body is too large." }, 413)
  }
  await next()
})

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
)

// Health check endpoint
app.get("/make-server-c657b9c4/health", (c) => {
  return c.json({ status: "ok" })
})

app.post("/make-server-c657b9c4/inventory/bootstrap", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (
    new TextEncoder().encode(JSON.stringify(body)).byteLength >
    MAX_REQUEST_BYTES
  ) {
    return c.json({ error: "Request body is too large." }, 413)
  }
  const localEntries = sanitizeEntries(body.entries)
  const stored = (await kv.get(
    INVENTORY_STATE_KEY,
  )) as InventoryState | undefined
  if (!stored) {
    const initial = createState(localEntries, 1)
    await kv.set(INVENTORY_STATE_KEY, initial)
    return c.json(initial)
  }
  const entries = { ...localEntries, ...sanitizeEntries(stored.entries) }
  if (
    Object.keys(entries).length !== Object.keys(stored.entries ?? {}).length
  ) {
    const merged = createState(entries, storedRevision(stored.revision) + 1)
    await kv.set(INVENTORY_STATE_KEY, merged)
    return c.json(merged)
  }
  return c.json({ ...stored, entries })
})

app.get("/make-server-c657b9c4/inventory/state", async (c) => {
  const stored = (await kv.get(
    INVENTORY_STATE_KEY,
  )) as InventoryState | undefined
  return c.json(stored ?? createState({}, 0))
})

app.put("/make-server-c657b9c4/inventory/state", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (
    new TextEncoder().encode(JSON.stringify(body)).byteLength >
    MAX_REQUEST_BYTES
  ) {
    return c.json({ error: "Request body is too large." }, 413)
  }
  const changes = sanitizeEntries(body.entries)
  if (!Object.keys(changes).length) {
    return c.json({ error: "No valid inventory entries supplied." }, 400)
  }
  const stored = (await kv.get(
    INVENTORY_STATE_KEY,
  )) as InventoryState | undefined
  const next = createState(
    { ...sanitizeEntries(stored?.entries), ...changes },
    storedRevision(stored?.revision) + 1,
  )
  await kv.set(INVENTORY_STATE_KEY, next)
  return c.json(next)
})

Deno.serve(app.fetch)
