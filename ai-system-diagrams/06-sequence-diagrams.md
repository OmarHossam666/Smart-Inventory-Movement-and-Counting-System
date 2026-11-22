# Deliverable 6 — Sequence Diagrams Specification

> **Document**: `ai-system-diagrams/06-sequence-diagrams.md`  
> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)  
> **Standard**: UML 2.5 Superstructure (ISO/IEC 19505-2) — Interaction Modeling  
> **Traceability**: Derived from `01-requirements.md` (FR-01 to FR-52, NFR-01 to NFR-25), `02-use-case-diagram.md`, `03-use-case-scenarios.md`, and `05-class-diagram.md`  
> **Date**: 2026-11-22  
> **Version**: 1.0  

---

## 1. Architectural Modeling Framework & Interaction Rules

Deliverable 6 models the runtime dynamic interaction flows of the Smart Inventory platform using **UML 2.5 Sequence Diagrams**. The specifications map asynchronous operations, hardware streaming protocols, distributed event-driven pub/sub, atomic dual-path persistence, and security challenges across six core runtime interaction flows:

1. **Flow 1: BLE Scale Pairing & Live Weight Streaming** (`plantuml/sequence-ble-scale.puml`)
2. **Flow 2: Arabic Voice Recognition & Phonetic Normalization** (`plantuml/sequence-voice-input.puml`)
3. **Flow 3: Inter-Location Transfer Lifecycle & Discrepancy Reconciliation** (`plantuml/sequence-transfer-lifecycle.puml`)
4. **Flow 4: Composite Dish Counting & Recipe Auto-Deductions** (`plantuml/sequence-composite-deduction.puml`)
5. **Flow 5: Comprehensive Audit Finalization, Canvas PDF & WhatsApp Dispatch** (`plantuml/sequence-audit-pdf-whatsapp.puml`)
6. **Flow 6: Offline Cloud Synchronization & Domain Conflict Resolution** (`plantuml/sequence-sync-conflict.puml`)
7. **High-Level System Interaction Loop**: Mermaid companion diagram (`mermaid/sequence-overview.mmd`)

### 1.1 UML 2.5 Modeling Conventions
- **Lifelines**: Every lifeline represents a concrete class, driver, or external system defined in Deliverable 5 (`AppController`, `BleScaleClient`, `SpeechRecognitionEngine`, `InventoryDataService`, `InventoryStorage`, `FirebaseInventorySync`).
- **Synchronous vs. Asynchronous Messages**: Solid arrows (`->`) denote blocking synchronous calls; open asynchronous arrows (`->>`) denote decoupled events and background timers; dashed arrows (`-->`) denote reply/return messages.
- **Activation Bars**: Highlight active execution time windows and recursive internal calls.
- **UML Combined Fragments (Interaction Frames)**:
  - `alt`: Mutually exclusive conditional branches (e.g. happy path vs. discrepancy flow).
  - `opt`: Optional steps executed only under specific system configurations.
  - `loop`: Repeated iterations (e.g. weight stabilization window, PIN retry attempts).
  - `par`: Concurrent execution threads (e.g. simultaneous local storage commit and debounced cloud queueing).
- **Styling**: Strict light theme conforming to academic/publication standards (Canvas: `#FFFFFF`; Lifelines: `#F8FAFC`; Activations: `#EFF6FF`, `#F0FDF4`, `#FFF7ED`).

---

## 2. Lifeline to Codebase Source Mapping Matrix

| Lifeline Identifier | Nature / Stereotype | Source File Reference | Role & Operational Responsibility |
|---|---|---|---|
| **Operator (Butcher / Kitchen)** | Primary Actor | `src/models.ts#L4`, `src/App.tsx#L400` | Initiates actions, inputs keypad values, triggers scale reads, accepts shipments. |
| **Owner / Supervisor** | Primary Actor | `src/models.ts#L4`, `src/OwnerAnalytics.tsx` | Enters 4-digit PIN, reviews shrinkage, triggers PDF generation, monitors discrepancies. |
| **AppController** | Frontend Coordinator | `src/App.tsx` | Central monolithic React state manager; coordinates UI events, modals, and undo stack. |
| **BleScaleClient** | Hardware Driver | `src/features/bleScale.ts` | Manages GATT Weight Service `0x181D` connection and weight packet parsing. |
| **BleClient Plugin** | Capacitor Bridge | `@capacitor-community/bluetooth-le` | Low-level OS Bluetooth adapter bridging native Android/Web BLE APIs. |
| **SpeechRecognitionEngine** | Audio / AI Processor | `src/features/speechRecognition.ts` | Manages `ar-SA` microphone stream, normalizes Arabic text, and executes fuzzy parsing. |
| **CompositeCalculator** | Domain Business Logic | `src/features/compositeInventory.ts` | Recipe parsing, proportional consumption math, and synthetic `auto_deduct` generation. |
| **InventoryDataService** | Service Facade | `src/data/inventoryDataService.ts` | Unified business operations, transfer state machines, and audit archival. |
| **InventoryStorage** | Local Storage Facade | `src/storage/repository.ts` | Platform-neutral persistence (IndexedDB on Web, SQLite on native Android). |
| **FirebaseInventorySync** | Cloud Broker & Sync | `src/data/firebaseInventorySync.ts` | 250ms debounced Firestore writes, real-time `onSnapshot` listeners, presence heartbeats. |
| **Firestore Remote DB** | Cloud BaaS | Google Cloud Firestore | Distributed multi-device database for cross-terminal synchronization. |
| **PdfReport / Canvas** | Document Generator | `src/PdfReport.tsx`, `jspdf` | High-DPI (2x) Canvas rendering and vector PDF export. |
| **WhatsApp / OS Share** | External Communication | `src/features/pdfDelivery.ts` | `https://wa.me/?text=...` URI generator and native Capacitor share sheet. |

---

## 3. Sequence Flow 1: BLE Scale Pairing & Weight Reading

### 3.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/sequence-ble-scale.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/sequence-ble-scale.svg`
- **Traceability**: `UC-05`, `UC-14`, `UC-15` (Mapped to `FR-06`, `FR-15`, `FR-16`, `NFR-02`, `NFR-16`).

### 3.2 Interaction Narrative
1. **Handshake**: Operator taps on a weight-based product card. If the Bluetooth scale is disconnected, `AppController` invokes `scanAndConnect()` on `BleScaleClient`. The client calls `@capacitor-community/bluetooth-le` `requestDevice()` filtering for GATT Weight Service `0x181D`, establishes a connection, and caches the `deviceId`.
2. **Notification Streaming**: `AppController` initiates `startWeightStream()`. The client enables notifications on characteristic `0x2A9D`.
3. **DataView Parsing**: As meat cuts are placed on the scale pan, raw byte packets are received. The parser evaluates Byte 0 flags: bit 0 verifies SI units (`kg`), bit 1 checks timestamp presence, and the 16-bit weight integer is multiplied by resolution factor `0.005 kg`.
4. **Stabilization Loop (`loop`)**: While weight fluctuations exceed +/-5g, the UI displays streaming values with an "unstable" indicator. When readings remain within +/-5g for >1.2 seconds, the client emits the stabilized weight and the UI enables "Accept Weight".
5. **Concurrent Persistence (`par`)**: Upon operator confirmation, the system converts the reading to base units, pushes prior state to `undoStack`, and executes parallel writes:
   - *Thread 1*: Persists count to local `InventoryStorage`.
   - *Thread 2*: Dispatches debounced (250ms) update to `FirebaseInventorySync`.

---

## 4. Sequence Flow 2: Arabic Voice Input Capture & Fuzzy Parsing

### 4.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/sequence-voice-input.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/sequence-voice-input.svg`
- **Traceability**: `UC-06`, `UC-16`, `UC-17`, `UC-59` (Mapped to `FR-07`, `FR-17`, `FR-18`, `NFR-22`).

### 4.2 Interaction Narrative
1. **Audio Capture**: Operator taps the microphone button. `SpeechRecognitionEngine` initializes continuous audio streaming using `webkitSpeechRecognition` or `@capacitor-community/speech-recognition` in `ar-SA` locale.
2. **Phonetic Normalization**: Spoken audio (e.g. "لحم بتلو اثنان وعشرون كيلو ونصف") is transcribed to raw Arabic text. The engine strips Tashkeel diacritics, normalizes Alef variants (`[أ إ آ] -> ا`), normalizes Yaa/Alef Maqsoura (`[ى] -> ي`), and standardizes Taa Marbouta (`[ة] -> ه`).
3. **Compound Fractional Grammar**: Words are converted to digits: "اثنان وعشرون" evaluates to `22`; "ونصف" evaluates to `+ 0.5`, yielding net quantity `22.5`.
4. **Entity Resolution**: The engine executes Damerau-Levenshtein distance matching against catalog item names, returning "لحم بتلو" with a 0.94 confidence score.
5. **Confirmation Frame (`alt`)**: UI displays "هل تقصد: لحم بتلو 22.5 كجم؟". If confirmed, count is committed; if rejected, value is pre-filled into the manual keypad for quick correction.

---

## 5. Sequence Flow 3: Inter-Location Transfer Lifecycle & Discrepancy Flow

### 5.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/sequence-transfer-lifecycle.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/sequence-transfer-lifecycle.svg`
- **Traceability**: `UC-19`, `UC-20`, `UC-20b`, `UC-21`, `UC-23`, `UC-33` (Mapped to `FR-20` through `FR-25`, `FR-35`, `NFR-03`, `NFR-11`).

### 5.2 Interaction Narrative
1. **Outbound Dispatch**: Butcher creates manifest (10.0 kg of shawarma cuts). `InventoryDataService.createTransfer()` assigns a UUID, sets `status: "Sent"`, logs outbound stock deduction in the butcher local ledger, and writes the document to Firestore.
2. **Cross-Terminal Notification**: Firestore pushes real-time `onSnapshot` event to the Restaurant terminal, triggering an audible chime and pending shipment badge.
3. **Physical Verification**: Kitchen staff weighs incoming cuts on the kitchen scale and inputs received weight.
4. **Branching Reconciliation (`alt`)**:
   - **Happy Path (`[received == sent +/- 1% tolerance]`)**: Transfer marked `"Received"`. Restaurant stock is credited with 10.0 kg. Firestore document is updated, and Butcher terminal receives acceptance confirmation.
   - **Discrepancy Flow (`[mismatch > tolerance]`, UC-20b)**: Delta is highlighted in red (e.g. -1.2 kg). Staff must select a dispute code (`transit_spill`) and enter remarks ("كيس ممزق"). Transfer marked `"Discrepancy"`. Only actual received weight (8.8 kg) is credited to restaurant stock; 1.2 kg difference is logged as waste shrinkage against the butcher ledger; high-priority notification is dispatched to the Owner Analytics Dashboard.

---

## 6. Sequence Flow 4: Composite Dish Counting & Recipe Auto-Deductions

### 6.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/sequence-composite-deduction.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/sequence-composite-deduction.svg`
- **Traceability**: `UC-12`, `UC-13` (Mapped to `FR-13`, `FR-14`, `NFR-11`).

### 6.2 Interaction Narrative
1. **Dish Entry**: Kitchen staff inputs physical count for 40 units of "برجر بقري جاهز".
2. **Recipe Calculation Loop (`loop`)**: `CompositeCalculator.autoDeductComponents()` retrieves recipe definition (150g minced beef, 5g burger spices, 1 burger bun per unit) and iterates:
   - Component 1: `150g * 40 = 6,000g (6.0 kg)`.
   - Component 2: `5g * 40 = 200g`.
   - Component 3: `1 pc * 40 = 40 pcs`.
3. **Inventory Balance Evaluation (`alt`)**: Checks raw item stock. If stock is sufficient, deducts required quantity; if insufficient, deducts resulting in negative stock and sets `high_shrinkage_flag = true`. Generates synthetic `StockMovement` records with `movementType: "auto_deduct"`.
4. **Atomic Concurrent Commit (`par`)**:
   - Commits composite count (40 units) to `counts` table.
   - Appends synthetic `auto_deduct` records to `stock_movements` ledger.
   - Updates expected stock balances for raw materials.
   - Queues 250ms debounced Firestore sync batch.

---

## 7. Sequence Flow 5: Comprehensive Audit Finalization, Canvas PDF & WhatsApp Dispatch

### 7.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/sequence-audit-pdf-whatsapp.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/sequence-audit-pdf-whatsapp.svg`
- **Traceability**: `UC-24`, `UC-26`, `UC-29`, `UC-30`, `UC-40` (Mapped to `FR-26` through `FR-33`, `NFR-04`, `NFR-06`, `NFR-11`, `NFR-23`).

### 7.2 Interaction Narrative
1. **Reconciliation & Security Challenge**: Owner reviews aggregate variance and clicks "Commit Final Audit". System prompts 4-digit PIN in a retry loop (`loop [until valid]`). Valid PIN unlocks execution; 3 failed attempts enforce a 30s lockout.
2. **Immutable Snapshot Archival (`par`)**:
   - Saves immutable `AuditRecord` to local `audits` store.
   - Pushes audit snapshot to Firestore `branches/{branchId}/audits/{auditId}`.
   - Resets shift counters and establishes starting stock for next shift.
3. **Canvas & Vector PDF Pipeline**: `PdfReport` initializes high-DPI (2x) HTML5 `<canvas>`, draws store branding, KPI summary cards, and RTL Arabic inventory tables, and passes the canvas buffer to `jsPDF` to compile a vector PDF document.
4. **Multi-Channel Dispatch**: Owner selects WhatsApp. System formats Arabic text summary, URL-encodes payload, and opens `https://wa.me/?text=...`. On native Android via Capacitor, `Share.share` is invoked to attach the physical PDF binary directly.

---

## 8. Sequence Flow 6: Offline Cloud Synchronization & Conflict Resolution

### 8.1 Architectural Scope & Codebase Anchor
- **Diagram File**: `ai-system-diagrams/plantuml/sequence-sync-conflict.puml`
- **Rendered Output**: `ai-system-diagrams/plantuml/output/sequence-sync-conflict.svg`
- **Traceability**: `UC-18`, `UC-32`, `UC-43`, `UC-56`, `UC-57` (Mapped to `FR-19`, `FR-20`, `FR-34`, `FR-45`, `NFR-03`, `NFR-12`, `NFR-14`).

### 8.2 Interaction Narrative
1. **Reconnection Detection**: System catches window `online` event or 12s heartbeat tick and pings Firestore.
2. **Queue Inspection Loop (`loop`)**: Iterates through queued pending mutations (`counts`, `transfers`, `rolePins`, `audits`) and fetches latest remote documents.
3. **Domain Strategy Branching (`alt`)**:
   - **`counts`**: Executes Last-Write-Wins (LWW) per item based on mutation timestamp.
   - **`transfers`**: State precedence rule (`Received`, `Discrepancy`, `Cancelled` override `Sent`).
   - **`rolePins`**: Most recent Owner timestamp dominates.
   - **`audits`**: Set union by immutable UUID.
4. **Atomic Commit & Dequeue**: Writes resolved canonical document to Firestore in atomic batch, updates local storage copy, clears mutation from write queue, and updates UI status badge to "Synced" (أخضر).

---

## 9. Deliverable Artifact Index & Verification Summary

| Artifact | Type | Format | Output Path | Verification Status |
|---|---|---|---|---|
| **Flow 1: BLE Scale Reading** | PlantUML | `.puml` | `plantuml/output/sequence-ble-scale.svg` | Verified (45.5 KB SVG) |
| **Flow 2: Arabic Voice Input** | PlantUML | `.puml` | `plantuml/output/sequence-voice-input.svg` | Verified (33.5 KB SVG) |
| **Flow 3: Transfer & Discrepancy** | PlantUML | `.puml` | `plantuml/output/sequence-transfer-lifecycle.svg` | Verified (46.0 KB SVG) |
| **Flow 4: Composite Auto-Deduct** | PlantUML | `.puml` | `plantuml/output/sequence-composite-deduction.svg` | Verified (37.7 KB SVG) |
| **Flow 5: Audit, Canvas PDF & WhatsApp** | PlantUML | `.puml` | `plantuml/output/sequence-audit-pdf-whatsapp.svg` | Verified (50.8 KB SVG) |
| **Flow 6: Offline Sync & Merge** | PlantUML | `.puml` | `plantuml/output/sequence-sync-conflict.svg` | Verified (37.8 KB SVG) |
| **System Interaction Companion** | Mermaid | `.mmd` | `mermaid/output/sequence-overview.svg` | Verified (50.7 KB SVG) |
| **Documentation Specification** | Markdown | `.md` | `ai-system-diagrams/06-sequence-diagrams.md` | Authoritative |
