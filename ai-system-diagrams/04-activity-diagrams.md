# Deliverable 4 — Activity Diagrams Specification

> **Document**: `ai-system-diagrams/04-activity-diagrams.md`  
> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)  
> **Standard**: UML 2.5 Superstructure (ISO/IEC 19505-2) — Activity Modeling  
> **Traceability**: Derived from `01-requirements.md` (FR-01 to FR-52, NFR-01 to NFR-25), `02-use-case-diagram.md` (UC-01 to UC-59), and `03-use-case-scenarios.md`  
> **Date**: 2026-11-22  
> **Version**: 1.0  

---

## 1. Architectural Modeling Framework & Quality Rules

Deliverable 4 models the dynamic, operational workflows of the Smart Inventory System using **UML 2.5 Activity Diagrams**. To ensure strict engineering rigor and prevent visual overcrowding, the system is modeled as five focused, cohesive activity workflows:

1. **Workflow 1: Inventory Counting & Multi-Modal Input** (`plantuml/activity-counting.puml`)
2. **Workflow 2: Inter-Location Transfer Lifecycle & Discrepancy Resolution** (`plantuml/activity-transfer.puml`)
3. **Workflow 3: Composite Item Counting & Recipe Auto-Deduction** (`plantuml/activity-composite-deduction.puml`)
4. **Workflow 4: Comprehensive Audit Finalization, Canvas PDF & WhatsApp Dispatch** (`plantuml/activity-audit-reporting.puml`)
5. **Workflow 5: Offline Cloud Synchronization & Domain Conflict Resolution** (`plantuml/activity-sync-conflict.puml`)
6. **High-Level Operational Overview**: Mermaid companion diagram (`mermaid/activity-overview.mmd`)

### 1.1 UML 2.5 Modeling Conventions
- **Swimlanes (`|Partition|`)**: Every action is assigned to an explicit swimlane representing either a human actor (`Butcher`, `Restaurant`, `Owner`), a hardware driver (`BleScaleClient`, `SpeechEngine`), a reactive UI coordinator (`App.tsx`), or a persistence engine (`InventoryStorage`, `FirebaseInventorySync`).
- **Control Flow**: Initial nodes (`start`), final activity nodes (`stop`), flow final nodes, and directional control arrows.
- **Decision & Merge Diamonds**: Distinct branching with mutually exclusive, brackets-enclosed `[guard]` conditions.
- **Concurrency (Fork & Join Bars)**: Explicit horizontal/vertical synchronization bars indicating simultaneous asynchronous execution (e.g. concurrent local persistence and debounced cloud queueing).
- **Color Theme**: Clean, high-contrast light theme conforming to academic/publication standards (Canvas: white/transparent; Activities: `#EFF6FF`, `#F0FDF4`, `#FFF7ED`; Decision Diamonds: `#FEF3C7`).

---

## 2. Swimlane Partitioning & Actor/Service Matrix

| Swimlane Identifier | Stereotype / Type | Codebase Source | Architectural Responsibility |
|---|---|---|---|
| **Operator (Butcher / Restaurant)** | Human Role (`DeviceRole`) | `src/models.ts#L4`, `src/App.tsx#L400` | Physical stock inspection, keypad input, food handling, transfer dispatch, and delivery acceptance. |
| **UI & Counting Engine** | Reactive Frontend Coordinator | `src/App.tsx#L1250-L1600` | UI state rendering, virtual numeric keypad, input validation, variance derivation, undo stack management. |
| **Hardware Peripherals** | Native / Web Drivers | `src/features/bleScale.ts`, `src/features/speechRecognition.ts` | BLE GATT Weight Service `0x181D` packet streaming and `ar-SA` speech capture and phonetic normalization. |
| **Composite Inventory Engine** | Domain Logic Processor | `src/features/compositeInventory.ts` | Recipe parsing, proportional consumption math, raw stock deduction, and negative balance flagging. |
| **Local Storage & Write Queue** | Platform-Neutral Persistence | `src/storage/repository.ts` | IndexedDB (Web) / SQLite (Android) persistence, serialized atomic writes, and offline pending mutation queue. |
| **Firestore Sync Broker** | Cloud BaaS / PubSub Engine | `src/data/firebaseInventorySync.ts` | 250ms debounced document batching, real-time snapshot fan-out (`onSnapshot`), presence heartbeats, and domain conflict merges. |
| **Canvas & PDF Engine** | Client-Side Document Generator | `src/PdfReport.tsx#L55` | High-DPI (2x scale) Canvas layout, RTL Arabic text rendering, and vector jsPDF document export. |
| **External Communications** | External Web Rail / OS Intent | `src/features/pdfDelivery.ts` | HTTPS `wa.me` deep-link encoding and native Capacitor Share plugin bridge. |

---

## 3. Workflow 1: Inventory Counting & Multi-Modal Input

### 3.1 Architectural Scope & Codebase Anchor
- **Diagram Source**: `ai-system-diagrams/plantuml/activity-counting.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/activity-counting.svg`
- **Traceability**: Covers `UC-01`, `UC-03`, `UC-04`, `UC-05`, `UC-06`, `UC-07`, `UC-08`, `UC-09`, `UC-10`, `UC-14`, `UC-15`, `UC-16`, `UC-17`, `UC-18` (Mapped to `FR-01` through `FR-11`, `FR-15` through `FR-19`, `NFR-01`, `NFR-02`, `NFR-22`).

### 3.2 Workflow Narrative & Decision Logic
1. **Initialization**: Operator establishes active shift parameters (`src/ShiftSetup.tsx`) and selects target category/product card.
2. **Multi-Modal Decision**: System branches into three supported input modalities:
   - **Branch A (Manual Keypad)**: Operator types numbers on custom touch keypad (`src/App.tsx#L1410`). Optionally taps quick-count presets (`+0.5`, `+1.0`, `+5.0` kg). Validator rejects negative inputs and multiple decimal points.
   - **Branch B (BLE Scale)**: If disconnected, system connects to GATT Service `0x181D` (`src/features/bleScale.ts#L42`). Client reads Weight Measurement characteristic `0x2A9D`, extracts unit flags and 16-bit weight integer, and loops until reading stabilizes within +/-5g for >1.2 seconds before emitting value to UI.
   - **Branch C (Arabic Voice)**: Microphone captures `ar-SA` audio buffer (`src/features/speechRecognition.ts#L28`). Engine normalizes Arabic phonetic numbers ("اثنان وعشرون ونصف" -> 22.5), resolves units, matches item name via Levenshtein distance, and prompts operator confirmation.
3. **Canonical Processing**: Entered quantity is converted to base units. Prior value is pushed to `undoStack`. System calculates `variance = enteredCount - expectedBalance` and updates the color-coded status badge (`matched`, `tolerance`, `shortage`).
4. **Concurrency Fork**:
   - *Fork Branch 1*: Persists count to local IndexedDB/SQLite database.
   - *Fork Branch 2*: Enqueues mutation into 250ms debounced Firestore sync batch.
5. **Undo Handling**: If the operator taps "Undo", the engine pops `undoStack`, restores prior count, recalculates variance, and syncs the reverted state to cloud.

---

## 4. Workflow 2: Inter-Location Transfer Lifecycle & Discrepancy Resolution

### 4.1 Architectural Scope & Codebase Anchor
- **Diagram Source**: `ai-system-diagrams/plantuml/activity-transfer.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/activity-transfer.svg`
- **Traceability**: Covers `UC-19`, `UC-20`, `UC-20b`, `UC-21`, `UC-22`, `UC-23`, `UC-33` (Mapped to `FR-20` through `FR-25`, `FR-35`, `NFR-03`, `NFR-11`).

### 4.2 Workflow Narrative & Decision Logic
1. **Dispatch (Butcher)**: Butcher opens Transfers module, creates manifest, inputs verified weights via scale or keypad, and clicks "Dispatch".
2. **State Transition 1 (`"Sent"`)**: Unique UUID generated; stock deducted/reserved in butcher local ledger; transfer document written to Firestore (`branches/{branchId}/transfers/{transferId}`).
3. **Revocation Branch**: Butcher can cancel transfer *while status is still "Sent"*. System reverts reserved stock and marks status `"Cancelled"`. If already received, cancellation is rejected.
4. **Receipt & Inspection (Restaurant)**: Restaurant terminal receives real-time `onSnapshot` notification. Kitchen staff physically weighs delivered items and enters received weights.
5. **Discrepancy Evaluation**:
   - **Happy Path (`[received == sent +/- 1% tolerance]`)**: Transfer marked `"Received"`. Verified weight credited to kitchen stock. Butcher receives acceptance confirmation.
   - **Discrepancy Path (`[mismatch > tolerance]`, UC-20b)**: System highlights line in red. Staff must select mandatory dispute code (`scale_difference`, `transit_spill`, `short_delivered`, `rejected`) and enter explanatory remarks. Transfer marked `"Discrepancy"`. Only actual received weight is credited to kitchen; difference is logged as shrinkage against butcher outbound ledger; high-priority alert is dispatched to Owner Analytics.

---

## 5. Workflow 3: Composite Item Counting & Recipe Auto-Deduction

### 5.1 Architectural Scope & Codebase Anchor
- **Diagram Source**: `ai-system-diagrams/plantuml/activity-composite-deduction.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/activity-composite-deduction.svg`
- **Traceability**: Covers `UC-12`, `UC-13` (Mapped to `FR-13`, `FR-14`, `NFR-11`, `src/features/compositeInventory.ts`).

### 5.2 Workflow Narrative & Decision Logic
1. **Trigger**: Kitchen operator enters physical count for prepared dish (e.g. 50 burger patties).
2. **Recipe Validation**: Engine checks `item.isComposite == true` and verifies populated `components: RecipeComponent[]`.
3. **Ingredient Loop**: For each recipe component:
   - Computes consumption: `totalConsumed = component.quantity * enteredDishCount`.
   - Queries current raw item stock.
   - If stock is insufficient, deducts resulting in negative inventory balance and tags raw item with `high_shrinkage_flag = true`.
   - Generates synthetic `StockMovement` entity with `movementType: "auto_deduct"`, linking composite item ID.
4. **Concurrency Fork (Atomic Commit)**:
   - *Fork Branch 1*: Commits composite dish count to counts table.
   - *Fork Branch 2*: Commits all synthetic `auto_deduct` records to `stock_movements` table.
   - *Fork Branch 3*: Updates expected stock balances for raw items.
5. **Sync & Notification**: Packages changes into atomic Firestore batch; displays toast detailing dish count and consumed raw ingredients.

---

## 6. Workflow 4: Comprehensive Audit Finalization, Canvas PDF & WhatsApp Dispatch

### 6.1 Architectural Scope & Codebase Anchor
- **Diagram Source**: `ai-system-diagrams/plantuml/activity-audit-reporting.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/activity-audit-reporting.svg`
- **Traceability**: Covers `UC-24`, `UC-25`, `UC-26`, `UC-27`, `UC-29`, `UC-30`, `UC-31`, `UC-34` (Mapped to `FR-26` through `FR-33`, `FR-36`, `NFR-04`, `NFR-11`, `NFR-13`, `NFR-21`, `NFR-23`).

### 6.2 Workflow Narrative & Decision Logic
1. **Initiation & Validation**: Operator initiates finalization. If uncounted items exist, system prompts operator to either set uncounted items to zero or skip them.
2. **Reconciliation**: Engine computes aggregate metrics (`totalItems`, `matchedCount`, `toleranceCount`, `shortageCount`, `totalVarianceKg`, estimated shrinkage cost) and renders color-coded review table.
3. **Security Gate**: Operator enters 4-digit PIN. Invalid PIN triggers error shake and increment counter (3 failures = 30s lockout).
4. **Archival Fork**:
   - *Fork Branch 1*: Saves immutable `AuditRecord` to local storage repository.
   - *Fork Branch 2*: Pushes `AuditRecord` to Firestore `audits` collection.
   - *Fork Branch 3*: Resets active shift counters and establishes starting balances for next shift.
5. **Canvas & PDF Pipeline**: Initializes high-DPI (2x) HTML5 `<canvas>`, draws store branding, KPI cards, and Arabic RTL table, and converts to vector jsPDF document.
6. **Multi-Channel Dispatch**:
   - *WhatsApp*: Generates pre-formatted Arabic summary text, URL-encodes payload, and launches `https://wa.me/?text=...` (plus Capacitor Share for PDF attachment on Android).
   - *Native Print*: Launches browser/Capacitor print dialogue.
   - *Download*: Triggers client-side `.pdf` download.

---

## 7. Workflow 5: Offline Cloud Synchronization & Domain Conflict Resolution

### 7.1 Architectural Scope & Codebase Anchor
- **Diagram Source**: `ai-system-diagrams/plantuml/activity-sync-conflict.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/activity-sync-conflict.svg`
- **Traceability**: Covers `UC-18`, `UC-32`, `UC-43`, `UC-56`, `UC-57` (Mapped to `FR-19`, `FR-20`, `FR-34`, `FR-45`, `NFR-03`, `NFR-12`, `NFR-14`).

### 7.2 Workflow Narrative & Decision Logic
1. **Trigger**: Window `online` event or 12-second background timer (`HEARTBEAT_INTERVAL_MS = 12000`) fires.
2. **State Check**: If offline, updates UI badge to "Offline" and reschedules retry with exponential backoff (2s to 30s).
3. **Pending Queue Inspection**: If pending mutations exist, fetches latest remote state from Firestore for each key.
4. **Domain Merge Strategy Routing**:
   - **`counts`**: Executes Last-Write-Wins (LWW) per item map based on mutation timestamp.
   - **`transfers`**: State precedence rule applies (`Received` / `Discrepancy` / `Cancelled` permanently override `Sent`).
   - **`rolePins`**: Retains configuration with newest Owner update timestamp.
   - **`audits`**: Executes set union by immutable UUID.
5. **Atomic Commit & Drain**: Writes canonical merged state to Firestore in atomic batch, updates local storage, clears pending queue, and sets UI badge to "Synced" (أخضر).

---

## 8. Guard Condition (`[guard]`) & Concurrency Dictionary

| Guard Condition Expression | Context / Workflow | Business Rule & Code Verification |
|---|---|---|
| `[Manual Touch Keypad]` | Workflow 1 (Counting) | Operator selects direct numeric keypad input on touch terminal (`src/App.tsx#L1410`). |
| `[BLE Weight Scale]` | Workflow 1 (Counting) | Operator requests peripheral weight reading via GATT Service `0x181D` (`src/features/bleScale.ts#L42`). |
| `[Arabic Voice Recognition]` | Workflow 1 (Counting) | Operator engages hands-free spoken counting (`src/features/speechRecognition.ts#L65`). |
| `[Weight stabilized within +/-5g for >1.2s]` | Workflow 1 (Counting) | Moving-window filter confirms stable meat cut weight before accepting (`src/features/bleScale.ts#L88`). |
| `[Tap Undo within session]` | Workflow 1 (Counting) | `undoStack.length > 0`; single-tap rollback of last count mutation (`src/App.tsx#L1530`). |
| `[Transfer status is still "Sent"]` | Workflow 2 (Transfers) | Concurrency check ensures transfer was not already accepted by restaurant before allowing cancellation. |
| `[within +/- 1% tolerance]` | Workflow 2 (Transfers) | Received weight delta is within allowed operational scale variance (`src/data/inventoryDataService.ts#L600`). |
| `[Discrepancy Detected]` | Workflow 2 (Transfers) | Received weight delta exceeds tolerance; forces mandatory dispute categorization (`src/data/inventoryDataService.ts#L615`). |
| `[sufficient stock]` | Workflow 3 (Composite) | Raw component balance >= required quantity (`src/features/compositeInventory.ts#L48`). |
| `[insufficient stock]` | Workflow 3 (Composite) | Negative variance allowed; logs deficit flag for inventory audit review (`src/features/compositeInventory.ts#L62`). |
| `[uncounted items exist]` | Workflow 4 (Audit) | Prompts operator to either set remaining items to zero or skip them (`src/App.tsx#L2700`). |
| `[PIN valid]` / `[PIN invalid]` | Workflow 4 (Audit) | Cryptographic hash match against stored role PIN; 3 failures enforce 30s lockout (`src/DeviceConnectModal.tsx#L110`). |
| `[conflict detected]` | Workflow 5 (Sync) | Remote document version > local base version; routes to domain merge handler (`src/data/firebaseInventorySync.ts#L440`). |

---

## 9. Deliverable Artifact Index & Verification Summary

| Artifact | Type | Format | Output Path | Verification Status |
|---|---|---|---|---|
| **Workflow 1: Counting & Input** | PlantUML | `.puml` | `plantuml/output/activity-counting.svg` | Verified (54.8 KB SVG) |
| **Workflow 2: Transfer Lifecycle** | PlantUML | `.puml` | `plantuml/output/activity-transfer.svg` | Verified (43.4 KB SVG) |
| **Workflow 3: Composite Deduction** | PlantUML | `.puml` | `plantuml/output/activity-composite-deduction.svg` | Verified (31.3 KB SVG) |
| **Workflow 4: Audit & Reporting** | PlantUML | `.puml` | `plantuml/output/activity-audit-reporting.svg` | Verified (45.8 KB SVG) |
| **Workflow 5: Offline Sync & Merge** | PlantUML | `.puml` | `plantuml/output/activity-sync-conflict.svg` | Verified (39.2 KB SVG) |
| **Overview Flowchart Companion** | Mermaid | `.mmd` | `mermaid/output/activity-overview.svg` | Verified SVG |
| **Documentation Specification** | Markdown | `.md` | `ai-system-diagrams/04-activity-diagrams.md` | Authoritative |
