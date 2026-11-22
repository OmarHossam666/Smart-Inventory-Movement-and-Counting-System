# Deliverable 5 — Class Diagram Specification

> **Document**: `ai-system-diagrams/05-class-diagram.md`  
> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)  
> **Standard**: UML 2.5 Superstructure (ISO/IEC 19505-2) — Structural Modeling  
> **Traceability**: Derived from `01-requirements.md` (FR-01 to FR-52, NFR-01 to NFR-25), `02-use-case-diagram.md`, and `03-use-case-scenarios.md`  
> **Date**: 2026-11-22  
> **Version**: 1.0  

---

## 1. Architectural Structural Framework & Design Patterns

Deliverable 5 provides an accurate, complete structural representation of the TypeScript/React codebase for the **Smart Inventory Movement and Counting System**. The architecture is structured into six cohesive packages operating under industry-standard enterprise patterns:

```
+-------------------------------------------------------------------------------------------------------+
|                                    STRUCTURAL ARCHITECTURE LAYERS                                     |
|                                                                                                       |
|  [Presentation Layer]             AppController (App.tsx monolith coordinator)                        |
|                                   ├── ShiftSetupScreen          ├── OwnerAnalyticsScreen              |
|                                   ├── AuditHistoryScreen        └── DeviceConnectModal                |
|                                         │                                                             |
|                                         ▼ (invokes)                                                   |
|  [Hardware & Features]            BleScaleClient               SpeechRecognitionEngine                |
|                                   CompositeInventoryCalculator  InventoryStatusEvaluator              |
|                                   ProductImportService          PdfReportGenerator                    |
|                                         │                                                             |
|                                         ▼ (delegates to)                                              |
|  [Service Facade Layer]           InventoryDataService (Singleton unified business facade)            |
|                                         │                                                             |
|                     ┌───────────────────┴───────────────────┐                                         |
|                     ▼ (persists locally)                    ▼ (syncs cloud)                           |
|  [Storage Architecture]                           [Cloud Sync & Auth]                                 |
|  InventoryStorage (LRU cache + queue)             FirebaseInventorySync (250ms batch + merge)         |
|  ├── IndexedDbRepository (Web IDB)                └── StoreAuthService (Tenant Branch Auth)           |
|  └── AndroidSqliteRepository (Capacitor SQLite)                                                       |
|                     │                                       │                                         |
|                     └───────────────────┬───────────────────┘                                         |
|                                         ▼ (manipulates)                                               |
|  [Domain Model Layer]             Category, Item, RecipeComponent, StockMovement,                     |
|                                   Transfer, TransferLine, AuditRecord, AuditLine                      |
+-------------------------------------------------------------------------------------------------------+
```

### Key Architectural Patterns
1. **Repository Pattern (`StorageRepository`)**: Decouples application logic from platform-specific persistence drivers (IndexedDB in Web browsers vs. encrypted SQLite on native Android via Capacitor).
2. **Facade Pattern (`InventoryDataService`)**: Provides a unified, atomic entry point for data queries, mutative operations, audit calculations, and import/export backups.
3. **Observer & Debounce Pattern (`FirebaseInventorySync`)**: Batches fine-grained UI events into 250ms throttled network frames and listens for real-time document deltas via Firestore `onSnapshot`.
4. **Strategy Pattern (Domain Conflict Merge)**: Dispatches conflict resolution strategies per document domain (Last-Write-Wins for counts, state machine progression for transfers, set union for audits).

---

## 2. Package Decomposition & Class Dictionary

### 2.1 Package 1: Domain Entities & Values (`src/models.ts`)

#### Enumerations
- `DeviceRole`: `owner` (المالك), `butcher` (الملحمة), `restaurant` (المطعم).
- `InventoryLocation`: `butcher`, `restaurant`.
- `TransferStatus`: `Sent`, `Received`, `Discrepancy`, `Cancelled`.
- `StockMovementType`: `count`, `auto_deduct`, `waste`, `transfer`.
- `ShiftType`: `morning`, `evening`, `night`.
- `InventoryUnit`: `g`, `kg`, `ml`, `pack`, `jar`, `piece`.
- `BaseUnit`: `g`, `ml`, `piece`.
- `CategorySlug`: `meat`, `poultry`, `vegetables`, `spices`, `beverages`.

#### Classes / Interfaces
- **`Category`**:
  - `+ id: string` — UUID primary key.
  - `+ nameAr: string` — Arabic display name (e.g. "لحوم طازجة").
  - `+ slug: CategorySlug` — URL/system identifier.
  - `+ icon: string` — Lucide icon identifier.
  - `+ sortOrder: number` — Display sequence.
- **`RecipeComponent`**:
  - `+ rawItemId: string` — Foreign key referencing constituent raw `Item`.
  - `+ quantity: number` — Required quantity per single unit of parent dish.
  - `+ unit: InventoryUnit` — Measurement unit (e.g., `g` for burger spices).
- **`Item`**:
  - `+ id: string` — UUID primary key.
  - `+ categoryId: string` — Foreign key referencing parent `Category`.
  - `+ nameAr: string` — Arabic item title.
  - `+ baseUnit: BaseUnit` — Canonical storage unit (`kg`, `g`, `piece`).
  - `+ entryUnit: InventoryUnit` — Default user input unit.
  - `+ unitMultiplier: number` — Conversion factor between entry unit and base unit.
  - `+ toleranceThresholdPercent: number` — Acceptable variance percentage (e.g. 2.5%).
  - `+ minStockAlert?: number` — Low stock warning threshold.
  - `+ costPerBaseUnit?: number` — Valuation unit cost.
  - `+ isComposite?: boolean` — Discriminator flag for recipe/dish items.
  - `+ components?: RecipeComponent[]` — Composition array of raw ingredients.
- **`StockMovement`**:
  - `+ id: string` — UUID primary key.
  - `+ itemId: string` — Foreign key referencing `Item`.
  - `+ movementType: StockMovementType` — `count` | `auto_deduct` | `waste` | `transfer`.
  - `+ quantity: number` — Delta weight/quantity (negative for consumption/waste).
  - `+ sourceLocation?: InventoryLocation` — Origin station.
  - `+ destinationLocation?: InventoryLocation` — Destination station.
  - `+ referenceId?: string` — Pointer to parent `Transfer` or composite `Item`.
  - `+ reason?: string` — Mandatory categorization for waste movements.
  - `+ createdAt: string` — ISO 8601 creation timestamp.
  - `+ createdByRole: DeviceRole` — Actor attribution.
- **`TransferLine`**:
  - `+ itemId: string` — Transferred product ID.
  - `+ sentQuantity: number` — Weighed quantity dispatched by butcher.
  - `+ receivedQuantity?: number` — Weighed quantity verified by restaurant.
  - `+ notes?: string` — Discrepancy or quality remarks.
  - `+ calculateVariance(): number` — `receivedQuantity - sentQuantity`.
- **`Transfer`**:
  - `+ id: string` — Transfer UUID.
  - `+ fromLocation: InventoryLocation` — Sender station (`butcher`).
  - `+ toLocation: InventoryLocation` — Receiver station (`restaurant`).
  - `+ status: TransferStatus` — `Sent` | `Received` | `Discrepancy` | `Cancelled`.
  - `+ lines: TransferLine[]` — Manifest items.
  - `+ discrepancyReason?: string` — Dispute code (`scale_difference`, etc.).
  - `+ createdAt: string` — Dispatch timestamp.
  - `+ receivedAt?: string` — Acceptance timestamp.
  - `+ createdBy: DeviceRole` — Sender role.
  - `+ receivedBy?: DeviceRole` — Recipient role.
  - `+ isTerminal(): boolean` — Returns `true` if `status in ["Received", "Discrepancy", "Cancelled"]`.
- **`AuditRecord`**:
  - `+ id: string` — Snapshot UUID.
  - `+ date: string` — Work date (YYYY-MM-DD).
  - `+ shiftType: ShiftType` — Operational shift.
  - `+ location: InventoryLocation` — Station audited.
  - `+ branchId: string` — Multi-tenant branch ID.
  - `+ totalItems: number` — Total products in scope.
  - `+ matchedCount: number` — Items with zero variance.
  - `+ toleranceCount: number` — Items within acceptable percentage.
  - `+ shortageCount: number` — Items exceeding deficit threshold.
  - `+ totalVarianceKg: number` — Aggregate net weight variance in kg.
  - `+ lines: AuditLine[]` — Itemized count snapshot.
  - `+ committedBy: DeviceRole` — Approving role.
  - `+ committedAt: string` — Immutable timestamp.

---

### 2.2 Package 2: Storage Architecture (`src/storage/repository.ts`)

- **`StorageRepository` (Interface)**:
  - `+ get<T>(key: string): Promise<T | null>`
  - `+ set<T>(key: string, value: T): Promise<void>`
  - `+ remove(key: string): Promise<void>`
  - `+ clear(): Promise<void>`
  - `+ keys(): Promise<string[]>`
- **`IndexedDbRepository` (Implements `StorageRepository`)**:
  - `- dbName: string = "smart-inventory"`
  - `- storeName: string = "keyvalue"`
  - `- dbPromise: Promise<IDBDatabase>`
  - *Methods*: Full implementation of `StorageRepository` using browser IndexedDB v2.
- **`AndroidSqliteRepository` (Implements `StorageRepository`)**:
  - `- sqlite: SQLiteConnection`
  - `- db: SQLiteDBConnection`
  - *Methods*: Full implementation of `StorageRepository` using `@capacitor-community/sqlite` with AES-256 encryption.
- **`InventoryStorage` (Facade & In-Memory Cache)**:
  - `- repo: StorageRepository`
  - `- cache: Map<string, any>`
  - `- writeQueue: Promise<void>`
  - `+ initialize(): Promise<void>` — Detects runtime platform and injects appropriate repository.
  - `+ getItem<T>(key: string): Promise<T | null>` — Cache-aside retrieval.
  - `+ setItem<T>(key: string, value: T): Promise<void>` — Serialized write-through cache update.
  - `+ removeItem(key: string): Promise<void>`

---

### 2.3 Package 3: Service Facade (`src/data/inventoryDataService.ts`)

- **`InventoryDataService` (Singleton)**:
  - `- storage: InventoryStorage`
  - `- syncService: FirebaseInventorySync`
  - `+ getCategories(): Promise<Category[]>`
  - `+ getItems(): Promise<Item[]>`
  - `+ saveItem(item: Item): Promise<void>`
  - `+ deleteItem(itemId: string): Promise<void>`
  - `+ getCounts(shiftId: string): Promise<Record<string, number>>`
  - `+ saveCount(itemId: string, count: number): Promise<void>`
  - `+ recordWaste(itemId: string, qty: number, reason: string): Promise<void>`
  - `+ createTransfer(fromLoc: InventoryLocation, toLoc: InventoryLocation, lines: TransferLine[]): Promise<Transfer>`
  - `+ receiveTransfer(id: string, lines: TransferLine[], notes?: string): Promise<Transfer>`
  - `+ cancelTransfer(id: string): Promise<Transfer>`
  - `+ saveAuditRecord(audit: AuditRecord): Promise<void>`
  - `+ getAuditHistory(): Promise<AuditRecord[]>`
  - `+ exportBackupJson(): Promise<string>`
  - `+ importBackupJson(jsonStr: string): Promise<boolean>`
  - `+ getDiagnostics(): Promise<DiagnosticEvent[]>`

---

### 2.4 Package 4: Cloud Synchronization & Authentication (`src/data/firebase*`)

- **`StoreAuthService` (`src/data/firebase/authService.ts`)**:
  - `- auth: FirebaseAuth`
  - `+ signInAnonymously(): Promise<UserCredential>`
  - `+ signInWithBranch(branchId: string, pin: string): Promise<UserCredential>`
  - `+ getCurrentBranchId(): string`
  - `+ setBranchId(branchId: string): void`
- **`FirebaseInventorySync` (`src/data/firebaseInventorySync.ts`)**:
  - `- db: Firestore`
  - `- branchId: string`
  - `- debounceTimer: NodeJS.Timeout | null`
  - `- pendingBatch: Map<string, any>`
  - `- heartbeatTimer: NodeJS.Timeout | null`
  - `+ initialize(branchId: string): Promise<void>`
  - `+ subscribeToKey<T>(key: string, callback: (data: T) => void): () => void`
  - `+ syncKey<T>(key: string, data: T): void` — Debounces local mutations over 250ms.
  - `+ updatePresence(role: DeviceRole, deviceId: string): Promise<void>` — 12-second heartbeat loop.
  - `+ pingDevice(targetDeviceId: string): Promise<number>`
  - `+ resolveConflict(key: string, localData: any, remoteData: any): any`
  - `- mergeCounts(local: Map, remote: Map): Map` — Last-Write-Wins (LWW) per item.
  - `- mergeTransfers(local: Transfer[], remote: Transfer[]): Transfer[]` — State precedence merge.

---

### 2.5 Package 5: Features & Hardware Drivers (`src/features/*`)

- **`BleScaleClient` (`src/features/bleScale.ts`)**:
  - `- deviceId: string | null`
  - `- isConnected: boolean`
  - `+ scanAndConnect(): Promise<boolean>` — Searches for GATT Weight Service `0x181D`.
  - `+ disconnect(): Promise<void>`
  - `+ startWeightStream(callback: (kg: number) => void): Promise<void>` — Subscribes to Char `0x2A9D`.
  - `+ stopWeightStream(): Promise<void>`
  - `- parseGattWeight(dataView: DataView): number` — Parses SI/Imperial flags and applies resolution.
- **`SpeechRecognitionEngine` (`src/features/speechRecognition.ts`)**:
  - `- recognition: any`
  - `- isListening: boolean`
  - `+ startListening(onResult: Function, onError: Function): void` — Listens in `ar-SA` locale.
  - `+ stopListening(): void`
  - `+ parseArabicSpeech(transcript: string, catalog: Item[]): VoiceResult`
  - `- normalizeArabicText(text: string): string` — Strips Tashkeel, normalizes Alef/Yaa.
  - `- parseArabicNumerals(words: string): number` — Converts Arabic words and fractions to float.
- **`CompositeInventoryCalculator` (`src/features/compositeInventory.ts`)**:
  - `+ autoDeductComponents(dishId: string, countQty: number, items: Item[], stock: Record<string, number>): StockMovement[]`
  - `+ validateRecipe(components: RecipeComponent[], items: Item[]): boolean`
- **`InventoryStatusEvaluator` (`src/features/inventoryStatus.ts`)**:
  - `+ calculateVariance(actual: number, expected: number): number`
  - `+ evaluateStatus(variance: number, threshold: number, expected: number): 'matched' | 'tolerance' | 'shortage'`
  - `+ computeExpectedStock(flow: InventoryFlow): number`
- **`ProductImportService` (`src/features/productImport.ts`)**:
  - `+ parseExcelWorkbook(file: File): Promise<RawProductRow[]>`
  - `+ fuzzyMatchProductName(name: String, catalog: Item[]): { match: Item | null, score: number }`
  - `+ damerauLevenshteinDistance(a: string, b: string): number`
  - `+ generateExcelTemplate(): Promise<Blob>`
- **`PdfReportGenerator` (`src/features/pdfDelivery.ts`, `src/PdfReport.tsx`)**:
  - `+ renderCanvasReport(audit: AuditRecord, items: Item[]): Promise<HTMLCanvasElement[]>`
  - `+ exportToPdf(canvases: HTMLCanvasElement[]): Promise<Blob>`
  - `+ sharePdfViaWhatsApp(pdfBlob: Blob, summaryText: string): Promise<void>`
  - `+ printAuditReport(pdfBlob: Blob): void`

---

### 2.6 Package 6: Presentation Controllers & UI Screens (`src/App.tsx`, Screen Views)

- **`AppController` (`src/App.tsx` monolith state coordinator)**:
  - `+ activeRole: DeviceRole`
  - `+ currentLocation: InventoryLocation`
  - `+ currentShift: ShiftInfo | null`
  - `+ categories: Category[]`
  - `+ items: Item[]`
  - `+ counts: Record<string, number>`
  - `+ undoStack: MutationSnapshot[]`
  - `+ transfers: Transfer[]`
  - `+ audits: AuditRecord[]`
  - `+ syncStatus: 'synced' | 'pending' | 'offline'`
  - `+ handleCountSubmit(itemId: string, val: number): void`
  - `+ handleUndo(): void`
  - `+ handleTransferCreate(lines: TransferLine[]): void`
  - `+ handleTransferReceive(id: string, lines: TransferLine[]): void`
  - `+ handleAuditCommit(): void`
  - `+ handleRoleSwitch(targetRole: DeviceRole, pin: string): void`
- **UI Screens**:
  - `ShiftSetupScreen` (`src/ShiftSetup.tsx`): Shift initialization form.
  - `AuditHistoryScreen` (`src/AuditHistory.tsx`): Historical audit log viewer & deleter.
  - `OwnerAnalyticsScreen` (`src/OwnerAnalytics.tsx`): Shrinkage trends & completion rate charts.
  - `DeviceConnectModal` (`src/DeviceConnectModal.tsx`): Multi-device role selector, QR display/scan.
  - `DataBackupModal` (`src/DataBackup.tsx`): JSON export and restore modal.
  - `ScaleConnectionModal` (`src/ScaleConnection.tsx`): Bluetooth LE pairing UI.

---

## 3. UML 2.5 Relationships & Multiplicities

| Source Class | Target Class | Relationship Type | UML Notation | Multiplicity | Architectural Semantics |
|---|---|---|---|---|---|
| `Category` | `Item` | Composition | `*--` | `1` to `0..*` | A category strictly owns product definitions. |
| `Item` | `RecipeComponent` | Composition | `*--` | `1` to `0..*` | A composite item contains 0 or more ingredient components. |
| `Transfer` | `TransferLine` | Composition | `*--` | `1` to `1..*` | A transfer manifest must contain at least one line item. |
| `AuditRecord` | `AuditLine` | Composition | `*--` | `1` to `1..*` | An immutable audit record contains snapshot lines. |
| `Item` | `StockMovement` | Association | `<--` | `1` to `0..*` | Movements track historical deltas against items. |
| `IndexedDbRepository` | `StorageRepository` | Interface Realization | `..\|>` | — | Web storage implementation. |
| `AndroidSqliteRepository`| `StorageRepository` | Interface Realization | `..\|>` | — | Android SQLite implementation. |
| `InventoryStorage` | `StorageRepository` | Aggregation | `o--` | `1` to `1` | Storage facade delegates to injected platform repository. |
| `InventoryDataService` | `InventoryStorage` | Aggregation | `o--` | `1` to `1` | Service facade manages local storage lifecycle. |
| `InventoryDataService` | `FirebaseInventorySync`| Aggregation | `o--` | `1` to `1` | Service facade manages cloud synchronization. |
| `AppController` | `InventoryDataService` | Association | `-->` | `1` to `1` | React controller invokes business operations. |
| `AppController` | Screen Components | Aggregation | `o--` | `1` to `*` | Central app manages sub-screen modal lifecycles. |
| `AppController` | `BleScaleClient` | Dependency | `..>` | — | Controller consumes weight notifications. |
| `AppController` | `SpeechRecognitionEngine`| Dependency | `..>` | — | Controller invokes voice parser. |
| `AppController` | `CompositeInventoryCalculator`| Dependency | `..>` | — | Controller triggers recipe auto-deductions. |
| `AppController` | `PdfReportGenerator` | Dependency | `..>` | — | Controller triggers PDF/WhatsApp exports. |

---

## 4. Deliverable Artifact Index & Verification Summary

| Artifact | Type | Format | Output Path | Verification Status |
|---|---|---|---|---|
| **Class Diagram (UML 2.5)** | PlantUML | `.puml` | `plantuml/output/class-diagram.svg` | Verified (111.1 KB SVG) |
| **Class Diagram (Overview)** | Mermaid | `.mmd` | `mermaid/output/class-diagram.svg` | Verified SVG |
| **Documentation Specification**| Markdown | `.md` | `ai-system-diagrams/05-class-diagram.md` | Authoritative |
