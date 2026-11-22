# Deliverable 7 — Architecture Views (Logical, Physical, Deployment)

> **Document**: `ai-system-diagrams/07-architecture-views.md`  
> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)  
> **Standard**: ISO/IEC/IEEE 42010:2011 — Systems and Software Architecture Description  
> **Traceability**: Derived from `01-requirements.md` (FR-01 to FR-52, NFR-01 to NFR-25), `capacitor.config.ts`, `firebase.json`, `package.json`, `firestore.rules`, and `docs/storage-architecture.md`  
> **Date**: 2026-11-22  
> **Version**: 1.0  

---

## 1. Architectural Description Framework & Methodology

Deliverable 7 establishes a multi-view architectural model conforming to **ISO/IEC/IEEE 42010:2011** and the classical Kruchten **"4+1" View Model**, addressing concerns of software engineers, system administrators, and security auditors:

1. **Logical View**: Modular decomposition, layered subsystems, component boundaries, and internal contracts (`plantuml/architecture-logical-view.puml`).
2. **Physical View**: Operating system processes, threads, in-memory caches, persistent databases, queues, and communication protocols (`plantuml/architecture-physical-view.puml`).
3. **Deployment View**: Hardware nodes, mobile/desktop execution environments, deployed binary artifacts, and cloud topology (`plantuml/deployment-diagram.puml` and `mermaid/deployment-diagram.mmd`).

---

## 2. Architecture View 1: Logical Subsystem Architecture

### 2.1 Subsystem Decomposition & Boundaries

The logical architecture separates user interface, feature logic, service orchestration, persistence, and external drivers into five decoupled horizontal layers:

```
+-------------------------------------------------------------------------------------------------------+
|  [Layer 1: Presentation Subsystem] (React 19 + Tailwind CSS v4)                                       |
|  App State Coordinator (App.tsx) ── coordinates 10 view components:                                   |
|  ShiftSetupView | CountView | TransView | AuditView | HistoryView | AnalyticsView | DeviceView | etc.     |
+-------------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ (consumes contracts)
+-------------------------------------------------------------------------------------------------------+
|  [Layer 2: Domain Feature Subsystem] (src/features/*, src/inventoryCatalog.ts)                       |
|  ├── BleScaleClient          (IBleScale)              ── GATT Service 0x181D streaming               |
|  ├── SpeechRecognitionEngine (ISpeechRecognition)     ── ar-SA voice capture & normalization          |
|  ├── CompositeCalculator     (ICompositeCalculator)   ── recipe component deduction math             |
|  ├── StatusEvaluator         (IStatusEvaluator)       ── expected balance & variance status          |
|  ├── ProductImportService    (IProductImport)         ── Excel workbook parser & Levenshtein match   |
|  └── PdfReportGenerator      (IPdfDelivery)           ── 2x high-DPI Canvas & WhatsApp deep-links    |
+-------------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ (commands operations)
+-------------------------------------------------------------------------------------------------------+
|  [Layer 3: Service Orchestration Subsystem] (src/data/*)                                              |
|  ├── InventoryDataService    (IInventoryDataService)  ── singleton unified business facade           |
|  ├── FirebaseInventorySync   (IFirebaseSync)          ── 250ms debounced writes & presence           |
|  └── StoreAuthService        (IStoreAuth)             ── anonymous & email/password branch tokens     |
+-------------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ (persists state)
+-------------------------------------------------------------------------------------------------------+
|  [Layer 4: Storage Subsystem] (src/storage/repository.ts)                                             |
|  InventoryStorage (Facade + In-Memory LRU Cache) ── delegates to:                                     |
|  ├── IndexedDbRepository      (IStorageRepository)    ── Web browser IndexedDB engine                 |
|  └── AndroidSqliteRepository  (IStorageRepository)    ── Capacitor 8 SQLite (encrypted)               |
+-------------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ (instantiates & validates)
+-------------------------------------------------------------------------------------------------------+
|  [Layer 5: Domain Models] (src/models.ts)                                                             |
|  Core entities: Category, Item, RecipeComponent, StockMovement, Transfer, TransferLine, AuditRecord   |
+-------------------------------------------------------------------------------------------------------+
```

### 2.2 Subsystem Contract Interfaces

| Interface | Exposing Component | Consuming Component | Key Methods & Signatures |
|---|---|---|---|
| `IInventoryDataService` | `InventoryDataService` | `AppController` | `getCategories()`, `getItems()`, `saveCount(id, qty)`, `createTransfer()`, `receiveTransfer()`, `saveAuditRecord()` |
| `IFirebaseSync` | `FirebaseInventorySync` | `InventoryDataService` | `syncKey(key, data)`, `subscribeToKey(key, cb)`, `updatePresence()`, `resolveConflict()` |
| `IStorageRepository` | `IndexedDbRepo`, `SqliteRepo` | `InventoryStorage` | `get<T>(key)`, `set<T>(key, val)`, `remove(key)`, `clear()`, `keys()` |
| `IBleScale` | `BleScaleClient` | `AppController` | `scanAndConnect()`, `startWeightStream(cb)`, `disconnect()` |
| `ISpeechRecognition`| `SpeechRecognitionEngine` | `AppController` | `startListening(onRes, onErr)`, `parseArabicSpeech(text, catalog)` |
| `ICompositeCalculator`| `CompositeCalculator` | `AppController` | `autoDeductComponents(dishId, qty, items, stock)` |
| `IPdfDelivery` | `PdfReportGenerator` | `AppController` | `renderCanvasReport(audit, items)`, `exportToPdf()`, `sharePdfViaWhatsApp()` |

---

## 3. Architecture View 2: Physical Runtime Architecture

### 3.1 Operating System Processes & Threads

The runtime system executes across native OS processes, browser WebViews, hardware microcontrollers, and Google Cloud distributed servers:

1. **Android Application Process (`com.smartinventory.butcher`)**:
   - **Capacitor 8.0 Bridge Layer**: Java/Kotlin JNI thread hosting `@capacitor-community/*` plugins.
   - **Native Bluetooth LE Service**: `android.bluetooth.BluetoothGatt` managing peripheral GATT connections and streaming characteristics.
   - **Native SQLite Database Engine**: Embedded `sqlite3` daemon utilizing SQLCipher AES-256 encrypted file storage (`smart_inventory.db`).
   - **Native Speech Recognizer Service**: `android.speech.SpeechRecognizer` streaming `ar-SA` audio buffers.
2. **WebView JavaScript Runtime (Chromium / WebKit)**:
   - **Main V8 / JavaScriptCore Event Loop**: Executes React 19 rendering, virtual DOM diffing, and state management.
   - **In-Memory Cache Buffer**: `Map<string, any>` in `InventoryStorage` providing `<1ms` read latency.
   - **Background Timers**:
     - *Presence Heartbeat Daemon*: 12-second recurring timer (`HEARTBEAT_INTERVAL_MS = 12000`).
     - *Debounced Sync Queue*: 250ms batching queue (`DEBOUNCE_MS = 250`).
   - **HTML5 2D Canvas Engine**: Offscreen 2x Retina canvas buffer for Arabic vector PDF compilation.
   - **IndexedDB Engine**: Browser key-value database (`smart-inventory` / `keyvalue`).
3. **Scale Hardware Microcontroller Process**:
   - SoC (Nordic Semiconductor nRF52832 / TI CC2640 ARM Cortex-M4) sampling 24-bit ADC load cell sensors and broadcasting GATT notifications (`0x181D`).
4. **Google Cloud Distributed Services**:
   - **Firebase Cloud Firestore**: Multi-tenant distributed NoSQL document database (`branches/{branchId}/...`).
   - **Firebase Authentication**: Stateless JWT token authority.
   - **Firebase Hosting CDN**: Global edge distribution of static web bundles.

### 3.2 Inter-Process Communication & Network Protocols

| Communication Path | Origin Node | Destination Node | Protocol / Transport | Data Payload / Format |
|---|---|---|---|---|
| **Weight Stream** | BLE Scale | Android Device | Bluetooth LE 5.0 (ATT/GATT RF) | GATT Characteristic `0x2A9D` DataView (Byte 0 flags + 16-bit weight) |
| **Native Bridge** | WebView JS | Android OS | Capacitor IPC (JNI / PostMessage) | JSON bridge serialization |
| **Local Cache** | React State | `InventoryStorage` | In-Memory Pointer Access | Direct V8 object reference (<1ms) |
| **Local Persistence** | `InventoryStorage`| IndexedDB / SQLite | W3C IndexedDB API / SQLite3 JNI | Serialized JSON strings |
| **Cloud Sync Queue** | Client Sync | Cloud Firestore | HTTPS / TLS 1.3 REST Batches | 250ms throttled JSON document deltas |
| **Real-time Push** | Cloud Firestore | Client Sync | WebSockets (WSS) / gRPC stream | `onSnapshot` real-time event payloads |
| **Presence Heartbeat**| Client Daemon | Cloud Firestore | WSS / HTTPS | `{ deviceId, role, lastSeen: timestamp }` every 12s |
| **Auth Handshake** | Client Auth | Firebase Auth | HTTPS / TLS 1.3 | Anonymous / Email JWT tokens |
| **WhatsApp Dispatch**| Client Browser | WhatsApp Gateway | HTTPS URI Scheme | `https://wa.me/?text={encodedPayload}` |

---

## 4. Architecture View 3: Deployment Architecture & Network Topology

### 4.1 Deployment Nodes & Hardware Configurations

Grounded in `capacitor.config.ts`, `firebase.json`, `package.json`, and `firestore.rules`:

#### Node 1: Butcher Workstation (Terminal 1)
- **Role**: Primary meat cutting and dispatch terminal.
- **Hardware Profile**: Android 11+ Touch POS / 10.1" Rugged Tablet (ARM64, 4GB RAM).
- **Execution Environment**: Android OS 11+ with Android System WebView 120+.
- **Deployed Artifact**: `app-release.apk` (`appId: 'com.smartinventory.butcher'`).
- **Local Database**: Local Encrypted SQLite (`smart_inventory.db`) via `@capacitor-community/sqlite`.
- **Attached Peripheral**: Bluetooth Low Energy digital scale via GATT Weight Service `0x181D`.

#### Node 2: Restaurant Kitchen Workstation (Terminal 2)
- **Role**: Food preparation, recipe counting, and goods receipt terminal.
- **Hardware Profile**: Android Tablet / All-in-One Touch POS / Web Browser Terminal.
- **Execution Environment**: Android OS or Chrome/Edge Browser.
- **Deployed Artifact**: `app-release.apk` or Web SPA bundle.
- **Local Database**: SQLite or IndexedDB (`smart-inventory`).

#### Node 3: Owner Terminal (Supervisor)
- **Role**: Master data management, shrinkage analytics, audit review, and backup exports.
- **Hardware Profile**: Android/iOS Smartphone or Laptop / Desktop Workstation.
- **Execution Environment**: Desktop Browser (Chrome, Edge, Safari) or Mobile App.
- **Deployed Artifact**: Web SPA bundle from Firebase Hosting.
- **Local Database**: Browser IndexedDB (`smart-inventory`).

#### Node 4: BLE Scale Hardware Peripheral
- **Hardware**: Industrial electronic bench scale (30kg capacity, 5g graduation).
- **Firmware**: Bluetooth LE 5.0 GATT server exposing standard Weight Service `0x181D` and Characteristic `0x2A9D`.

#### Node 5: Google Cloud / Firebase Cloud Infrastructure
- **Region**: Multi-region (`us-central1` / `europe-west`).
- **Services**:
  - **Firebase Cloud Firestore**: Multi-tenant document database with tenant isolation under `branches/{branchId}`.
  - **Firebase Authentication**: Manages anonymous tokens and branch store credentials.
  - **Firebase Hosting CDN**: Static asset hosting delivering Vite 8 compiled bundle (`dist/`).

#### Node 6: Meta WhatsApp Gateway
- **Service**: External messaging rail executing `https://wa.me/?text=...` deep-linking and native Android share intents.

---

## 5. Security & Threat Modeling Analysis

### 5.1 Security Evaluation & Gaps Identified

| Security Dimension | Codebase Implementation | Operational Status | Gap / Recommendation |
|---|---|---|---|
| **Data-at-Rest Encryption** | `AndroidSqliteRepository` uses SQLCipher on Android (`docs/storage-architecture.md#L45`). | **Secure** on Android; Web relies on browser origin sandbox. | Web IndexedDB is unencrypted; adequate for low-risk local counting. |
| **Data-in-Transit Encryption** | All external cloud communications use TLS 1.3 / HTTPS and WSS (`src/data/firebase/*`). | **Secure**. | Man-in-the-middle attacks mitigated by certificate pinning in Android WebView. |
| **Role-Based Access Control** | 4-digit PIN verification protects Owner transitions, audit finalization, and data wipes (`src/DeviceConnectModal.tsx`). | **Functional**. | Role PINs stored in Firestore `keys/rolePins`; currently vulnerable to open security rules. |
| **Cloud Security Rules (G-01)**| `firestore.rules` specifies: `allow read, write: if true;` | **CRITICAL GAP (G-01)** | Documented in Deliverable 1. Must restrict read/write to authenticated branch tokens (`request.auth != null`). |
| **Authentication Enforcement**| `StoreAuthService` supports anonymous & email auth, but UI defaults to open branch ID (`src/data/firebase/authService.ts`). | **PARTIAL GAP (G-02)** | Store registration modal should be made mandatory on initial launch. |

---

## 6. Deliverable Artifact Index & Verification Summary

| Artifact | View | Format | Output Path | Verification Status |
|---|---|---|---|---|
| **Logical Architecture View** | Logical (Subsystems) | PlantUML | `plantuml/output/architecture-logical-view.svg` | Verified SVG |
| **Physical Architecture View** | Physical (Processes) | PlantUML | `plantuml/output/architecture-physical-view.svg` | Verified SVG |
| **Deployment Architecture View** | Deployment (Nodes) | PlantUML | `plantuml/output/deployment-diagram.svg` | Replaced & Verified (48.4 KB SVG) |
| **Deployment Overview Companion** | Deployment (Nodes) | Mermaid | `mermaid/output/deployment-diagram.svg` | Replaced & Verified SVG |
| **Documentation Specification** | Architecture Views | Markdown | `ai-system-diagrams/07-architecture-views.md` | Authoritative |
