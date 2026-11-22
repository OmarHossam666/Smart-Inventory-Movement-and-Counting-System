# Deliverable 1 — Requirement Determination (Functional & Non-Functional)

> **Document**: `ai-system-diagrams/01-requirements.md`
> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)
> **Standard**: ISO/IEC/IEEE 29148:2018 — Requirements Engineering
> **Date**: 2026-11-22
> **Version**: 1.0

---

## 1. Codebase Discovery Summary

### 1.1 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | React 19 + TypeScript 5.7 | SPA |
| **Build Tooling** | Vite 8, pnpm | Module bundler |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | Utility-first |
| **Mobile Runtime** | Capacitor 8 (Android) | Hybrid native |
| **Cloud Backend** | Firebase Firestore (real-time sync) | BaaS |
| **Authentication** | Firebase Auth (anonymous + email/password) | Auth |
| **Local Storage (Web)** | IndexedDB (`smart-inventory` database) | Key-value |
| **Local Storage (Android)** | SQLite via `@capacitor-community/sqlite` (encrypted) | Key-value |
| **BLE Hardware** | `@capacitor-community/bluetooth-le` | Bluetooth scale |
| **Speech** | `@capacitor-community/speech-recognition` + Web Speech API | Voice input |
| **PDF Generation** | `jspdf` + Canvas API | Client-side |
| **Excel I/O** | `read-excel-file` / `write-excel-file` | Product import |
| **QR Code** | `qrcode` | Branch sharing |
| **Testing** | Vitest 5.1 | Unit tests |
| **Formatting** | oxfmt | Code style |

### 1.2 Module Architecture

| Module Path | Responsibility |
|---|---|
| `src/main.tsx` | Bootstrap: initializes storage, renders React |
| `src/App.tsx` | Primary SPA component (~7600 LOC monolith); all screens, state, business logic |
| `src/models.ts` | Domain entity types (Category, Item, InventoryFlow, StockMovement, Transfer, TransferLine, AuditRecord, ShiftInfo, RecipeComponent, etc.) |
| `src/inventoryCatalog.ts` | Seed data, category IDs, unit helpers, expected-balance calculation |
| `src/data/inventoryDataService.ts` | Service facade — CRUD, counting, transfers, waste, backup/restore, migration |
| `src/data/firebaseInventorySync.ts` | Firebase Firestore real-time sync, presence heartbeats, ping |
| `src/data/firebase/config.ts` | Firebase app/firestore/auth initialization |
| `src/data/firebase/authService.ts` | Branch authentication (anonymous, email/password), store code |
| `src/storage/repository.ts` | Platform-neutral storage facade (IndexedDB + Android SQLite adapters) |
| `src/features/bleScale.ts` | BLE scale client — connect, read weight, disconnect |
| `src/features/speechRecognition.ts` | Arabic voice recognition — parse spoken weight/quantity |
| `src/features/inventoryStatus.ts` | Calculate matched/tolerance/shortage status per item |
| `src/features/compositeInventory.ts` | Composite (recipe) item logic — auto-deduction, validation |
| `src/features/pdfDelivery.ts` | PDF report utilities, WhatsApp delivery, native bridge |
| `src/features/productImport.ts` | Excel import parser, product matching (Damerau-Levenshtein) |
| `src/AuditHistory.tsx` | Audit history list/detail screen |
| `src/OwnerAnalytics.tsx` | Owner analytics dashboard (shortage trends, completion rates) |
| `src/PdfReport.tsx` | PDF audit report generator with Canvas rendering |
| `src/ScaleConnection.tsx` | BLE scale connection management screen |
| `src/ShiftSetup.tsx` | Shift setup screen (morning/evening/night, branch selection) |
| `src/DataBackup.tsx` | JSON backup export/import screen |
| `src/DeviceConnectModal.tsx` | Multi-device connection, branch switching, role PIN, QR code |
| `src/MascotCompanion.tsx` | Animated mascot companion (draggable, state-aware) |
| `src/AppErrorBoundary.tsx` | React error boundary for graceful crash recovery |
| `src/useDialogDismiss.ts` | Shared Escape-key dialog dismiss hook |

### 1.3 Actors

| Actor | Type | Description | Codebase Evidence |
|---|---|---|---|
| **Butcher** (الملحمة) | Primary | Counts inventory, sends transfers, records waste at the butcher location | `DeviceRole = "butcher"` in `models.ts:51` |
| **Restaurant** (المطعم) | Primary | Receives transfers, counts inventory at the restaurant location | `DeviceRole = "restaurant"` in `models.ts:51` |
| **Owner** (المالك) | Primary | Configures items, sets PINs, views analytics, manages products/recipes, receives reports via WhatsApp | `DeviceRole = "owner"` in `models.ts:51` |
| **BLE Scale** | Secondary (Hardware) | Provides real-time weight readings via Bluetooth LE | `src/features/bleScale.ts` |
| **Firebase Firestore** | Secondary (External System) | Cloud data synchronization, real-time listeners, presence | `src/data/firebaseInventorySync.ts` |
| **Firebase Auth** | Secondary (External System) | Anonymous and email/password authentication | `src/data/firebase/authService.ts` |
| **WhatsApp** | Secondary (External System) | Delivery channel for audit reports to the owner | `src/features/pdfDelivery.ts:29–31` |
| **Web Speech API / Capacitor Speech** | Secondary (Platform Service) | Arabic voice-to-text for hands-free quantity input | `src/features/speechRecognition.ts` |

### 1.4 External Integrations

| Integration | Protocol | Purpose |
|---|---|---|
| Cloud Firestore | HTTPS / WebSocket (real-time `onSnapshot`) | Data sync across branch devices |
| Firebase Authentication | HTTPS | Device authentication (anonymous / email-password) |
| Bluetooth LE (GATT Weight Service `0x181D`) | BLE | Read weight from connected scale |
| WhatsApp deep-link (`wa.me`) | HTTPS redirect | Send audit report to owner phone |
| Native Android PdfBridge (Capacitor plugin) | Native bridge | Open / save / share PDF on Android |

---

## 2. Functional Requirements

### 2.1 Inventory Counting & Weight Management

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-01** | The system shall allow a user to record the actual counted weight/quantity for each inventory item at a given location (butcher or restaurant). | Must | Weight is persisted to location-weights and stock ledger; UI shows updated value. | `inventoryDataService.ts:1202–1306` (`setCount`) |
| **FR-02** | The system shall compute the **expected balance** for each item as `opening + incoming − outgoing` (non-negative). | Must | `expectedBalance()` returns correct value for every movement. | `inventoryCatalog.ts:239–246` |
| **FR-03** | The system shall classify each item's inventory status as **Pending**, **Matched**, **Tolerance** (surplus), or **Shortage** based on actual vs. expected weight and shrinkage allowance. | Must | `getInventoryStatus()` returns the correct `InventoryStatusTone` per the shrinkage-percent threshold. | `features/inventoryStatus.ts:11–33` |
| **FR-04** | The system shall allow an item count to be **undone** (reverted to previous state) via a last-action undo mechanism. | Should | `lastAction` state reverts the previous weight; stock ledger entry is removed. | `App.tsx` (state: `lastAction`, undo handler) |
| **FR-05** | The system shall support **quick-count presets** (e.g., +10 kg, +500 g, +1 piece) adapted to the item's measurement unit. | Should | Buttons add the preset delta to the current count; appropriate unit labels shown. | `App.tsx:623–658` (quickCountPresets) |
| **FR-06** | The system shall allow recording **waste** for any item with quantity and optional note. | Must | `recordWaste()` deducts from location weights and appends a `waste` movement to the ledger. | `inventoryDataService.ts:1552–1598` |

### 2.2 BLE Scale Integration

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-07** | The system shall discover and connect to a Bluetooth LE weight scale using the standard Weight Measurement Service (`0x181D`). | Must | `BleScaleClient.connect()` pairs via `requestDevice`, subscribes to weight notifications. | `features/bleScale.ts:42–115` |
| **FR-08** | The system shall parse weight readings from the BLE scale (supporting both kg and lb units) and display them in real time. | Must | `parseWeightMeasurement()` correctly decodes the BLE DataView; value shown in UI. | `features/bleScale.ts:11–30` |
| **FR-09** | The system shall allow the user to apply the scale's current reading directly to the selected item's count. | Should | Tapping the weight display records the reading as the item's actual weight. | `App.tsx` (scale weight → `setCount`) |
| **FR-10** | The system shall gracefully handle BLE disconnection and display the connection status (connected / disconnected / searching / error). | Must | `ScaleStatus` type drives UI; `onDisconnect` callback resets state. | `ScaleConnection.tsx:15`, `features/bleScale.ts:69–74` |

### 2.3 Voice Recognition (Speech-to-Weight)

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-11** | The system shall allow the user to input weight/quantity via **Arabic voice command** (supporting both native Android and Web Speech API). | Must | `recognizeArabicNative()` and Web Speech API path both return transcripts. | `features/speechRecognition.ts:19–73`, `App.tsx:181–198` |
| **FR-12** | The system shall parse spoken Arabic weight values including Arabic digits (٠–٩), word-form numbers (واحد–تسعمية), fractions (نصف, ربع), and unit keywords (كيلو, جرام). | Must | `parseSpokenWeight()` returns correct numeric kg value for all documented word forms. | `features/speechRecognition.ts:90–206` |
| **FR-13** | The voice input shall support both **replace** and **add** modes for the target item's weight. | Should | `voiceMode` state ("replace" / "add") controls whether parsed value replaces or adds to current weight. | `App.tsx:387` |

### 2.4 Product & Category Management

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-14** | The system shall maintain a catalog of **categories** (meat, poultry, vegetables, spices, beverages) with Arabic/English names, icons, colors, and sort order. | Must | `seedCategories` provides defaults; categories stored and synced. | `inventoryCatalog.ts:24–85` |
| **FR-15** | The system shall allow the **Owner** to create, update, and delete inventory items with attributes: name (AR/EN), category, unit, package size, opening quantity, minimum stock alert, cost per unit, shrinkage %, image. | Must | `createItem()`, `updateItem()`, `deleteItem()` in `InventoryDataService`. | `inventoryDataService.ts:1600–1631` |
| **FR-16** | The system shall support **composite (recipe) items** composed of simple component items, with per-component quantity and base unit. | Must | `RecipeComponent` type; `replaceRecipeComponents()` persists recipes; `validateRecipe()` enforces rules. | `models.ts:55–60`, `features/compositeInventory.ts:55–79`, `inventoryDataService.ts:1126–1146` |
| **FR-17** | When a composite item is counted, the system shall **automatically deduct** component item quantities proportionally and record `auto_deduct` stock movements. | Must | `applyCompositeCountState()` creates parent + child movements, updates component weights. | `features/compositeInventory.ts:81–190` |
| **FR-18** | The system shall support importing products from an **Excel file**, parsing Arabic column headers, matching existing items (using Damerau-Levenshtein distance ≤ 1), and creating an import plan (add/update). | Should | `parseProductImportRows()` + `createProductImportPlan()` produce a validated plan with issues. | `features/productImport.ts:194–397` |
| **FR-19** | The system shall allow the Owner to upload **custom product images**, compressing them to ≤ 560px and JPEG quality 72%. | Could | `compressProductImage()` resizes and encodes to base64 data URL. | `App.tsx:280–315` |

### 2.5 Transfer Management (Butcher ↔ Restaurant)

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-20** | The **Butcher** shall be able to create a transfer containing one or more items with sent quantities, deducting from butcher location stock. | Must | `createTransfer()` validates lines, creates Transfer + TransferLines, deducts butcher weights, records `transfer` movements. | `inventoryDataService.ts:1308–1385` |
| **FR-21** | The **Restaurant** shall be able to receive a pending transfer, recording the actual received quantities and detecting discrepancies. | Must | `receiveTransfer()` updates restaurant weights, records `transfer` movements, sets status to Received or Discrepancy. | `inventoryDataService.ts:1387–1485` |
| **FR-22** | A pending (Sent) transfer shall be **cancellable** with a mandatory reason, restoring the butcher's stock. | Must | `cancelTransfer()` reverses deductions, sets status to Cancelled with reason. | `inventoryDataService.ts:1487–1550` |
| **FR-23** | Transfers shall follow a strict state machine: `Sent → Received`, `Sent → Discrepancy`, or `Sent → Cancelled`. | Must | Transfer `status` field is a discriminated union: `"Sent" | "Received" | "Discrepancy" | "Cancelled"`. | `models.ts:75` |

### 2.6 Audit & Reporting

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-24** | The system shall generate a comprehensive **audit report** summarizing all counted items with opening, incoming, outgoing, expected, actual, difference, and notes per item, grouped by category. | Must | `AuditRecord` type captures all fields; `summaryData` and `quantitySummary` compute aggregates. | `models.ts:101–144`, `App.tsx:720–794` |
| **FR-25** | The system shall generate the audit report as a **multi-page PDF** using Canvas rendering with Arabic text support and logo branding. | Must | `PdfReport.tsx` renders audit data to canvas pages, converts to PDF blob via `jspdf`. | `src/PdfReport.tsx` |
| **FR-26** | The system shall allow **sending the audit report via WhatsApp** to the owner's configured phone number. | Must | `createOwnerWhatsAppUrl()` generates `wa.me` deep-link; native bridge `sharePdfToWhatsApp` for Android. | `features/pdfDelivery.ts:29–31`, `features/pdfDelivery.ts:10–16` |
| **FR-27** | The system shall maintain a **persistent audit history** allowing the owner to review past audit records, filter by shortage or delivery status, and re-open reports. | Must | `AuditHistoryScreen` renders filterable list; `auditHistory` state persisted in storage. | `src/AuditHistory.tsx` |
| **FR-28** | The system shall provide an **Owner Analytics** dashboard showing shortage trends, completion rates, and top shortage items over configurable time ranges (7 days, 30 days, all). | Should | `OwnerAnalyticsScreen` computes `analytics` from filtered audit records. | `src/OwnerAnalytics.tsx:33–50` |

### 2.7 Shift Management

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-29** | The system shall allow setting up a **shift** (morning, evening, night) with branch selection before starting an inventory count. | Must | `ShiftSetupScreen` lets user pick shift type and branch; `ShiftInfo` persisted. | `src/ShiftSetup.tsx:17–38`, `models.ts:146–153` |
| **FR-30** | A shift session shall track the number of **completed** vs. **total** items to show counting progress. | Must | `summaryData.completed` / `configuredProducts.length` shown in UI progress. | `App.tsx:733–751` |

### 2.8 Multi-Device & Cloud Synchronization

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-31** | The system shall synchronize inventory data in **real time** across multiple branch devices using Firebase Firestore (`onSnapshot`). | Must | `FirebaseInventorySync.startRealtimeListener()` subscribes to changes; `queue()` debounces local writes (250ms) to Firestore batch writes. | `firebaseInventorySync.ts:282–368`, `firebaseInventorySync.ts:412–423` |
| **FR-32** | Each device shall be assigned a **role** (Owner, Butcher, Restaurant) which determines its inventory location, visible features, and sync permissions. | Must | `DeviceRole` type enforced across App state; `pickCloudEntries` restricts sync per role. | `models.ts:51`, `firebaseInventorySync.ts:53–70` |
| **FR-33** | The system shall display **device presence** (online/offline status per role) using heartbeat pings every 12 seconds with a 35-second online threshold. | Must | `sendHeartbeat()` writes to Firestore presence subcollection; `startPresenceListener()` monitors. | `firebaseInventorySync.ts:119–143`, `firebaseInventorySync.ts:145–217` |
| **FR-34** | The system shall support **branch switching** to connect to a different store's data namespace. | Should | `switchBranch()` closes current listeners, reconnects to new branch ID. | `firebaseInventorySync.ts:374–386` |
| **FR-35** | The system shall support **sync ping** notifications to alert other connected devices (with vibration). | Should | `sendPing()` writes a timestamped ping document; listener dispatches `smart-inventory-ping-received` event. | `firebaseInventorySync.ts:388–410`, `App.tsx:451–468` |
| **FR-36** | Multi-device data shall be merged using **conflict resolution strategies** per data type (location weights by role authority, transfers by terminal status, ledger by ID union, role PINs by owner precedence). | Must | `mergeLocationWeights()`, `mergeTransfers()`, `mergeTransferLines()`, `mergeStockLedger()`, `mergeRolePins()` implement per-type merge. | `inventoryDataService.ts:384–517` |

### 2.9 Device Connection & Authentication

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-37** | The system shall display a **Device Connect Modal** allowing role selection, branch configuration, and QR-code-based branch sharing. | Must | `DeviceConnectModal` renders role selector, branch input, QR code generator. | `src/DeviceConnectModal.tsx` |
| **FR-38** | Each device role shall be **PIN-protected** with a 4-digit PIN, manageable by the Owner. | Must | `RolePins` type enforces 4-digit PINs per location; `setRolePins()` persists. | `models.ts:53`, `inventoryDataService.ts:1717–1728` |
| **FR-39** | The Owner settings panel shall be protected by a **master PIN** (default "0000"). | Must | `ownerPin` state checked before granting access to settings screens. | `App.tsx:427–429` |
| **FR-40** | The system shall authenticate devices via **Firebase anonymous authentication** for seamless access. | Must | `ensureDeviceAuthenticated()` calls `signInAnonymously()` if no current user. | `authService.ts:141–152` |
| **FR-41** | The system shall support **store owner sign-in** via email and password for account-level access. | Could | `signInStore()` and `registerStore()` use Firebase email/password auth. | `authService.ts:110–135` |

### 2.10 Data Persistence & Backup

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-42** | The system shall persist all inventory data **offline-first** in IndexedDB (web) or encrypted SQLite (Android), with an in-memory cache for synchronous reads. | Must | `InventoryStorage` class provides cache + serialized writes; dual adapter. | `storage/repository.ts:274–457` |
| **FR-43** | The system shall migrate legacy data from **localStorage** to the structured database on first launch. | Must | `initialize()` reads legacy entries and copies missing keys to the repository. | `storage/repository.ts:294–324` |
| **FR-44** | The system shall allow exporting a full **JSON backup** of all inventory data with app identifier and schema version. | Must | `createBackup()` returns `InventoryBackup` object with version 2. | `inventoryDataService.ts:1778–1785` |
| **FR-45** | The system shall allow **restoring** from a validated backup file, with rollback on failure. | Must | `restoreBackup()` applies replacement atomically; reverts `previous` on error. | `inventoryDataService.ts:1817–1825` |
| **FR-46** | The system shall validate backup files, accepting versions 1 and 2, checking for the `smart-inventory` app identifier and recognized storage keys. | Must | `validateBackup()` checks app ID, version, date, and key presence. | `inventoryDataService.ts:1787–1815` |

### 2.11 UI / UX Features

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-47** | The system shall support **dark mode** with three theme options: light, dark, system-follows. | Should | `themePreference` state ("light"/"dark"/"system"); `isDark` computed. | `App.tsx:376–382` |
| **FR-48** | The system shall display an animated **mascot companion** that reflects the app state (idle, listening, matched, shortage, whatsapp) and is draggable. | Could | `MascotCompanion` renders SVG mascot, tracks position in `MascotPreferences`. | `src/MascotCompanion.tsx` |
| **FR-49** | The system shall display an **error boundary** with graceful crash recovery and a reload button, preserving persisted data. | Must | `AppErrorBoundary` catches render errors, shows Arabic error message + reload. | `src/AppErrorBoundary.tsx` |
| **FR-50** | The system shall show an **online/offline status indicator** and handle connectivity changes (refresh data on reconnect). | Must | `isOnline` state tracks `navigator.onLine`; `refreshCloudData()` on `online` event. | `App.tsx:411`, `App.tsx:496–550` |

### 2.12 Schema Migration & Data Integrity

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **FR-51** | The system shall perform **automatic schema migration** (version 4) on startup, normalizing item IDs, category IDs, units, and movements from legacy formats. | Must | `migrateAndSeed()` processes legacy items with `idMap`, normalizes all fields. | `inventoryDataService.ts:664–1052` |
| **FR-52** | The system shall validate and normalize all numeric values during migration, using `finiteNumber()` guards. | Must | All parsed fields use `finiteNumber()` with fallbacks and minimum bounds. | `inventoryDataService.ts:119–128` |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **NFR-01** | The app shall render the initial UI within **2 seconds** of storage initialization on a mid-range Android device. | Must | `main.tsx` lazy-imports `App` only after `initialize()` completes; `lazy()` splits secondary screens. | `src/main.tsx:35–56`, `App.tsx:101–141` |
| **NFR-02** | Cloud sync writes shall be **debounced** (250ms) and batched to minimize Firestore write operations. | Must | `queue()` uses `setTimeout(250)` before `pushPending()`; writes use `writeBatch()`. | `firebaseInventorySync.ts:412–423`, `firebaseInventorySync.ts:460–496` |
| **NFR-03** | Product image uploads shall be **compressed** to ≤ 560px and JPEG quality 72% to minimize storage size. | Should | `compressProductImage()` resizes via Canvas before encoding. | `App.tsx:280–315` |
| **NFR-04** | Excel imports shall reject files exceeding **5000 rows** to prevent UI freezes. | Must | `parseProductImportRows()` returns error if `rows.length > 5001`. | `features/productImport.ts:202–211` |

### 3.2 Security

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **NFR-05** | The Android SQLite database shall be **encrypted** with SQLCipher using a device-generated 256-bit passphrase. | Must | `AndroidSqliteRepository.initialize()` generates secret and passes `true` for encryption. | `storage/repository.ts:164–201` |
| **NFR-06** | Owner settings shall be gated by a **4-digit PIN** before granting access. | Must | PIN check in App state before rendering owner screens. | `App.tsx:427–429` |
| **NFR-07** | Each device role (butcher/restaurant) shall have a **separate PIN** for role-switching access control. | Must | `RolePins` record enforced in `DeviceConnectModal`. | `models.ts:53`, `DeviceConnectModal.tsx` |
| **NFR-08** | Firebase write echo suppression: a device shall **not re-apply its own acknowledged writes** received back via `onSnapshot` to avoid race conditions. | Must | `updated_by` device ID check in snapshot listener filters own writes. | `firebaseInventorySync.ts:337–339` |

> [!WARNING]
> **NFR-09 (Security Gap)**: The Firestore security rules (`firestore.rules`) currently allow **unrestricted read/write** (`allow read, write: if true`) on all documents under `/branches/{branchId}/**`. This should be tightened for production to enforce authentication checks.
> - **File**: `firestore.rules:4–8`

### 3.3 Reliability

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **NFR-10** | The system shall operate **fully offline** using local IndexedDB/SQLite, synchronizing when connectivity is restored. | Must | All reads from cache; writes serialized to local DB first; sync is best-effort. | `storage/repository.ts`, `docs/storage-architecture.md:58–68` |
| **NFR-11** | Storage write errors shall dispatch a **custom event** (`smart-inventory-storage-error`) for UI-level error notification rather than silently failing. | Must | `InventoryStorage.runSerialized()` dispatches event on error. | `storage/repository.ts:436–442` |
| **NFR-12** | Backup restoration shall be **atomic** — on failure, the previous data snapshot is restored. | Must | `restoreBackup()` catches errors and calls `replaceRawValues(previous)`. | `inventoryDataService.ts:1817–1825` |
| **NFR-13** | The React error boundary shall **catch and display** unhandled rendering errors without crashing the entire app. | Must | `AppErrorBoundary.getDerivedStateFromError()` captures errors; renders recovery UI. | `src/AppErrorBoundary.tsx:10–11` |
| **NFR-14** | Storage shall request **persistent storage** (`navigator.storage.persist()`) on web to reduce data eviction risk. | Should | Called during `InventoryStorage.initialize()` for IndexedDB. | `storage/repository.ts:317–323` |

### 3.4 Scalability

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **NFR-15** | The system shall support **up to 5000 inventory items** per branch without performance degradation on import. | Must | Import limit enforced; rendering uses `useMemo` for filtered lists. | `features/productImport.ts:202`, `App.tsx:574–600` |
| **NFR-16** | Firestore sync shall use a **document-per-key** model under `branches/{branchId}/keys/{key}` to stay within the 1MB document limit and enable delta sync. | Must | Architecture documented; implemented with per-key `setDoc`. | `docs/storage-architecture.md:64–68`, `firebaseInventorySync.ts:468–485` |
| **NFR-17** | The system shall support **multiple branches** via branch-scoped Firestore collections and device-local branch ID switching. | Should | `switchBranch()` changes `branchId` and re-establishes listeners. | `firebaseInventorySync.ts:374–386` |

### 3.5 Maintainability

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **NFR-18** | All domain entities shall use **typed TypeScript interfaces** with discriminated unions for state enums (`TransferStatus`, `StockMovementType`, `ShiftType`). | Must | Types defined in `models.ts` with literal union types. | `src/models.ts` |
| **NFR-19** | The storage layer shall use a **repository pattern** with platform-specific adapters behind a common interface (`StorageRepository`). | Must | `StorageRepository` interface; `IndexedDbRepository`, `AndroidSqliteRepository` implementations. | `storage/repository.ts:46–55`, `:57–155`, `:157–265` |
| **NFR-20** | The codebase shall maintain **unit tests** (Vitest) for core features: inventory catalog, data service, inventory sync, BLE scale, composite inventory, inventory status, PDF delivery, product import, speech recognition, and storage repository. | Must | Test files exist for each feature module. | `src/*.test.ts`, `src/features/*.test.ts`, `src/data/*.test.ts`, `src/storage/*.test.ts` |
| **NFR-21** | Schema version (`INVENTORY_SCHEMA_VERSION = 4`) shall be tracked and stored to control **forward-only migrations**. | Must | Version stored in `smart-inventory-schema-version` key. | `inventoryCatalog.ts:12`, `inventoryDataService.ts:1050` |

### 3.6 Usability

| ID | Requirement | Priority | Acceptance Criteria | Codebase Path |
|---|---|---|---|---|
| **NFR-22** | The UI shall be **fully RTL (right-to-left)** with Arabic as the primary language for all labels, messages, and error strings. | Must | `dir="rtl"` on root elements; all user-facing strings are Arabic. | `AppErrorBoundary.tsx:25`, all UI components |
| **NFR-23** | The system shall support both **web browser** and **native Android** (Capacitor) as deployment targets from a single codebase. | Must | `Capacitor.isNativePlatform()` guards platform-specific code paths. | `storage/repository.ts:267–272`, `features/bleScale.ts`, `features/pdfDelivery.ts:20–22` |
| **NFR-24** | Dialogs shall be dismissible via the **Escape key** (and hardware back button on Android via Capacitor). | Should | `useDialogDismiss` hook registers keydown listener for Escape. | `src/useDialogDismiss.ts` |
| **NFR-25** | The system shall provide **haptic feedback** (vibration) for sync ping alerts on supported devices. | Could | `navigator.vibrate([100, 50, 100])` on ping received. | `App.tsx:459` |

---

## 4. Gaps & Assumptions

| # | Observation | Type | Impact |
|---|---|---|---|
| **G-01** | Firestore rules are **fully open** (`allow read, write: if true`). No production-grade authentication or authorization enforcement exists at the database level. | Security Gap | High — any client with the project config can read/write all branch data. |
| **G-02** | No formal **user registration or login flow** in the UI. The `signInStore` and `registerStore` methods exist in `authService.ts` but are not surfaced in any visible screen. | Missing Feature | Medium — owner account management is not user-accessible. |
| **G-03** | The monolithic `App.tsx` (~7600 lines) contains all screen logic, state management, and business workflows. No state management library (Redux, Zustand) or component decomposition. | Architectural Debt | Medium — maintainability and testability concern for future iterations. |
| **G-04** | No **CI/CD pipeline** configuration files (GitHub Actions, etc.) were found in the repository. | Missing Infra | Low — deployment automation is not version-controlled. |
| **G-05** | No **end-to-end (E2E) tests** or integration tests were found; only unit tests exist. | Test Gap | Medium — UI workflows and device interactions are untested end-to-end. |
| **G-06** | The `Spices` category has no seed items in `sourceCatalog`, though the category is defined. | Data Gap | Low — spices exist as a category but have no default products. |
| **G-07** | Firebase configuration uses **dummy/placeholder values** as fallbacks (`AIzaSyDummyKeyForDevelopmentAndTesting`). Real credentials are expected via environment variables. | Assumption | Low — expected developer workflow. |

---

## 5. Canonical Glossary

| Term | Definition | ID System |
|---|---|---|
| **Category** | A product grouping (meat, poultry, vegetables, spices, beverages) | UUID |
| **Item** | An inventory product with unit, quantity, and cost attributes | UUID |
| **InventoryFlow** | Opening/incoming/outgoing movement record for an item | UUID |
| **StockMovement** | Ledger entry of type count, auto_deduct, waste, or transfer | UUID |
| **Transfer** | A batch shipment from butcher to restaurant | UUID |
| **TransferLine** | A line-item within a transfer with sent/received quantities | UUID |
| **AuditRecord** | A complete inventory audit snapshot with per-item details | UUID |
| **ShiftInfo** | The current counting shift (type, branch, start time) | UUID |
| **RecipeComponent** | A link between a composite item and a component item with quantity | UUID |
| **DeviceRole** | The role assigned to this device: owner, butcher, or restaurant | Enum |
| **InventoryLocation** | The physical location: butcher or restaurant | Enum |
| **BaseUnit** | Canonical measurement unit: g, ml, or piece | Enum |
| **InventoryUnit** | Display-level unit: g, kg, ml, pack, jar, piece | Enum |

---

*End of Deliverable 1*
