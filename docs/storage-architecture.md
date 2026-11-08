# Storage architecture

The application uses one platform-neutral storage facade:

`src/storage/repository.ts`

UI components must never import IndexedDB, Capacitor SQLite, or `localStorage`
directly. They read the initialized in-memory cache and write through
`inventoryStorage`. This keeps inventory calculations and React state identical
on every platform.

## Platform adapters

### Web

`IndexedDbRepository` stores key/value records in the `smart-inventory`
database and `key_value` object store. Initialization requests persistent
browser storage when the browser supports it.

### Android

`AndroidSqliteRepository` stores the same records in the `app_storage` SQLite
table. The database is encrypted with SQLCipher. A random 256-bit passphrase is
generated on first launch and retained by the plugin's Android secure storage.

Android backup is disabled in the manifest because an encrypted database
restored without its device-bound secret would be unusable. Users should use
the application's versioned JSON backup screen to move data between devices.

## Startup and legacy migration

`src/main.tsx` initializes the repository before rendering React. On first
startup after this architecture was introduced, known `smart-inventory-*`
values are copied from legacy `localStorage` only when the corresponding
database key does not already exist. All later reads and writes use the
selected database adapter.

The cache is populated only after the database is ready, allowing existing
synchronous React state initializers to remain deterministic. Writes update
the cache immediately and are serialized to the durable adapter in order.
Storage errors dispatch `smart-inventory-storage-error` for the existing UI
warning.

## Schema evolution

- Increment the IndexedDB version in `indexedDB.open` and add migration steps
  inside `onupgradeneeded`.
- Increment the SQLite connection version and execute forward-only SQL
  migrations before opening the repository to the UI.
- Never rename a persisted application key without a migration that copies the
  old value first.
- Keep backup versions backward compatible in `src/DataBackup.tsx`.
- Add new application keys to `INVENTORY_STORAGE_KEYS` so migration and backup
  include them automatically.

## Data ownership and synchronization

The system is offline-first. IndexedDB and SQLite remain the authoritative
local stores and JSON files are portable backups. Cloud Firestore (Firebase)
mirrors selected shared keys in real time across branch devices; device role,
theme, owner phone, owner PIN, pending report, scale name, and mascot position
remain local-only.

The cloud synchronization protocol uses Cloud Firestore document-per-key
collections under `branches/{branchId}/keys/{key}` with real-time listeners
(`onSnapshot`). Only changed keys are transmitted (delta sync), preventing
1MB document limits and eliminating the latency of polling loops. Local SQLite
or IndexedDB remains 100% usable while offline.

## Android workflow

```sh
pnpm android:sync
pnpm android:open
```

Android builds require JDK 21 and Android Studio/SDK. Generate signed release
artifacts from Android Studio or the Gradle release task after configuring a
private signing keystore outside the repository.
