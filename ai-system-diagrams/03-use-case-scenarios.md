# Deliverable 3 — Use Case Scenarios Specification

> **Document**: `ai-system-diagrams/03-use-case-scenarios.md`  
> **System**: Smart Inventory Movement and Counting System (نظام حركة وجرد المخزون)  
> **Standard**: ISO/IEC/IEEE 29148:2018 (Requirements Engineering) & Cockburn Fully Dressed Format  
> **Traceability**: Derived from `01-requirements.md` (FR-01 to FR-52, NFR-01 to NFR-25) & `02-use-case-diagram.md` (UC-01 to UC-59)  
> **Date**: 2026-11-22  
> **Version**: 1.0  

---

## 1. Specification Framework & Quality Standard

Each core use case in this document is modeled using Alistair Cockburn's **Fully Dressed Use Case Template**, providing:
- **Systematic ID & Name**: Canonical `UC-xx` referencing Deliverables 1 and 2.
- **Primary & Secondary Actors**: Exact roles from `src/models.ts` and hardware/cloud interfaces.
- **Goal in Context & Scope**: Business and operational intent within the butcher/restaurant domain.
- **Preconditions**: Required system state, active role, storage state, and hardware availability.
- **Trigger**: The specific user event or external trigger initiating execution.
- **Main Success Scenario (MSS)**: Numbered, sequential step-by-step interaction between actor and system.
- **Extensions (Alternative & Error Flows)**: Numbered branch conditions with handling, rollback, and recovery steps.
- **Postconditions**: Guaranteed state upon successful completion (local storage and cloud sync).
- **Non-Functional & Code Anchors**: Direct linkage to `NFR-xx`, `FR-xx`, and exact relative file paths.

---

## 2. Master Catalog & Traceability Index (UC-01 to UC-59)

| UC ID | Use Case Name | Primary Actor | Secondary Actor(s) | Linked FRs | Linked NFRs | Code Anchor | Scenario Type |
|---|---|---|---|---|---|---|---|
| **UC-01** | Set Up Shift & Location | Butcher, Restaurant, Owner | — | FR-01, FR-02 | NFR-06, NFR-21 | `src/ShiftSetup.tsx#L18` | Fully Dressed |
| **UC-02** | Select Operating Location | Butcher, Restaurant, Owner | — | FR-02 | NFR-06 | `src/App.tsx#L420` | Detailed Ref |
| **UC-03** | Select Category & Product | Butcher, Restaurant | — | FR-04 | NFR-21 | `src/App.tsx#L1250` | Detailed Ref |
| **UC-04** | Record Item Count (Manual Keypad) | Butcher, Restaurant | — | FR-05 | NFR-01, NFR-11 | `src/App.tsx#L1410` | Fully Dressed |
| **UC-05** | Record Item Count via BLE Scale | Butcher, Restaurant | BLE Scale | FR-06, FR-15, FR-16 | NFR-02, NFR-16 | `src/features/bleScale.ts#L42` | Fully Dressed |
| **UC-06** | Record Item Count via Voice | Butcher, Restaurant | Speech Engine | FR-07, FR-17, FR-18 | NFR-22 | `src/features/speechRecognition.ts#L65` | Fully Dressed |
| **UC-07** | Apply Quick-Count Preset | Butcher, Restaurant | — | FR-08 | NFR-21 | `src/App.tsx#L1480` | Detailed Ref |
| **UC-08** | Undo Last Count Entry | Butcher, Restaurant | — | FR-09 | NFR-21 | `src/App.tsx#L1530` | Fully Dressed |
| **UC-09** | View Live Stock & Status | Butcher, Restaurant, Owner | — | FR-10 | NFR-01, NFR-11 | `src/features/inventoryStatus.ts#L22` | Fully Dressed |
| **UC-10** | Calculate Expected Balance | Owner, Butcher | — | FR-11 | NFR-01 | `src/inventoryCatalog.ts#L340` | Detailed Ref |
| **UC-11** | Record Waste / Shrinkage | Butcher, Restaurant | — | FR-12 | NFR-11 | `src/data/inventoryDataService.ts#L410` | Fully Dressed |
| **UC-12** | Count Composite Item | Restaurant | — | FR-13 | NFR-11 | `src/features/compositeInventory.ts#L15` | Fully Dressed |
| **UC-13** | Auto-Deduct Components | Restaurant | — | FR-14 | NFR-11 | `src/features/compositeInventory.ts#L48` | Detailed Ref |
| **UC-14** | Scan & Connect BLE Scale | Butcher, Restaurant | BLE Scale | FR-15 | NFR-16 | `src/ScaleConnection.tsx#L35` | Fully Dressed |
| **UC-15** | Read Weight from Scale GATT | Butcher, Restaurant | BLE Scale | FR-16 | NFR-02 | `src/features/bleScale.ts#L88` | Detailed Ref |
| **UC-16** | Capture Arabic Speech Audio | Butcher, Restaurant | Speech Engine | FR-17 | NFR-22 | `src/features/speechRecognition.ts#L28` | Detailed Ref |
| **UC-17** | Parse Spoken Weight & Unit | Butcher, Restaurant | — | FR-18 | NFR-22 | `src/features/speechRecognition.ts#L102` | Detailed Ref |
| **UC-18** | Synchronize Count to Cloud | System | Firestore | FR-19 | NFR-03, NFR-14 | `src/data/firebaseInventorySync.ts#L110` | Detailed Ref |
| **UC-19** | Create Transfer (Outbound) | Butcher | Firestore | FR-20, FR-25 | NFR-03, NFR-11 | `src/data/inventoryDataService.ts#L520` | Fully Dressed |
| **UC-20** | Receive & Verify Transfer | Restaurant | Firestore | FR-21, FR-35 | NFR-03, NFR-11 | `src/data/inventoryDataService.ts#L590` | Fully Dressed |
| **UC-20b**| Flag Transfer Discrepancy | Restaurant | Firestore | FR-22 | NFR-11 | `src/data/inventoryDataService.ts#L615` | Fully Dressed |
| **UC-21** | Cancel Pending Transfer | Butcher | Firestore | FR-23 | NFR-11 | `src/data/inventoryDataService.ts#L650` | Fully Dressed |
| **UC-22** | View Pending Transfers | Butcher, Restaurant, Owner | — | FR-24 | NFR-21 | `src/App.tsx#L2100` | Detailed Ref |
| **UC-23** | Notify Receiving Node | System | Firestore | FR-25 | NFR-03 | `src/data/firebaseInventorySync.ts#L240` | Detailed Ref |
| **UC-24** | Initiate Audit Session | Butcher, Restaurant, Owner | — | FR-26 | NFR-11 | `src/App.tsx#L2650` | Fully Dressed |
| **UC-25** | Review Variance & Shrinkage | Owner, Butcher | — | FR-27, FR-38 | NFR-01, NFR-11 | `src/App.tsx#L2800` | Fully Dressed |
| **UC-26** | Finalise & Archive Audit | Owner, Butcher, Restaurant | Firestore | FR-28 | NFR-11, NFR-13 | `src/data/inventoryDataService.ts#L780` | Fully Dressed |
| **UC-27** | View Historical Audits | Owner | — | FR-29 | NFR-21 | `src/AuditHistory.tsx#L45` | Detailed Ref |
| **UC-28** | Delete Audit Record | Owner | Firestore | FR-30 | NFR-06 | `src/data/inventoryDataService.ts#L860` | Detailed Ref |
| **UC-29** | Generate Canvas PDF Report | Owner | — | FR-31 | NFR-04, NFR-21 | `src/PdfReport.tsx#L55` | Fully Dressed |
| **UC-30** | Share Report via WhatsApp | Owner | WhatsApp | FR-32 | NFR-23 | `src/features/pdfDelivery.ts#L35` | Fully Dressed |
| **UC-31** | Print Physical Audit Report | Owner | — | FR-33 | NFR-21 | `src/features/pdfDelivery.ts#L68` | Detailed Ref |
| **UC-32** | Broadcast Ledger Sync | System | Firestore | FR-34 | NFR-03 | `src/data/firebaseInventorySync.ts#L180` | Detailed Ref |
| **UC-33** | Reconcile Transfer Stock | System | — | FR-35 | NFR-11 | `src/data/inventoryDataService.ts#L630` | Detailed Ref |
| **UC-34** | Download PDF Locally | Owner | — | FR-36 | NFR-21 | `src/PdfReport.tsx#L210` | Detailed Ref |
| **UC-35** | View Shift Summary | Butcher, Restaurant, Owner | — | FR-37 | NFR-21 | `src/App.tsx#L3100` | Detailed Ref |
| **UC-36** | Calculate Variance Percentage| System | — | FR-38 | NFR-01 | `src/features/inventoryStatus.ts#L55` | Detailed Ref |
| **UC-37** | Filter Audit by Date/Shift | Owner | — | FR-39 | NFR-21 | `src/AuditHistory.tsx#L90` | Detailed Ref |
| **UC-38** | View Owner Analytics | Owner | — | FR-40 | NFR-01, NFR-21 | `src/OwnerAnalytics.tsx#L25` | Detailed Ref |
| **UC-39** | Select / Switch Device Role | Butcher, Restaurant, Owner | — | FR-41 | NFR-06 | `src/DeviceConnectModal.tsx#L40` | Fully Dressed |
| **UC-40** | Authenticate with Role PIN | Butcher, Restaurant, Owner | — | FR-42 | NFR-06 | `src/DeviceConnectModal.tsx#L110` | Fully Dressed |
| **UC-41** | Display Branch QR Code | Owner | — | FR-43 | NFR-21 | `src/DeviceConnectModal.tsx#L185` | Fully Dressed |
| **UC-42** | Scan QR Code to Link Branch| Butcher, Restaurant | — | FR-44 | NFR-21 | `src/DeviceConnectModal.tsx#L220` | Fully Dressed |
| **UC-43** | View Device Presence (12s) | Owner | Firestore | FR-45 | NFR-12 | `src/data/firebaseInventorySync.ts#L310` | Fully Dressed |
| **UC-44** | Ping Connected Devices | Owner | Firestore | FR-46 | NFR-12 | `src/data/firebaseInventorySync.ts#L360` | Detailed Ref |
| **UC-45** | Manage Role Security PINs | Owner | Firestore | FR-47 | NFR-06 | `src/data/inventoryDataService.ts#L940` | Detailed Ref |
| **UC-46** | Manage Products & Recipes | Owner | Firestore | FR-48 | NFR-11 | `src/App.tsx#L4100` | Fully Dressed |
| **UC-47** | Configure Units & Multipliers| Owner | — | FR-49 | NFR-11 | `src/inventoryCatalog.ts#L180` | Detailed Ref |
| **UC-48** | Set Tolerance Thresholds | Owner | — | FR-50 | NFR-11 | `src/features/inventoryStatus.ts#L80` | Detailed Ref |
| **UC-49** | Import Products from Excel | Owner | — | FR-51 | NFR-04, NFR-21 | `src/features/productImport.ts#L30` | Fully Dressed |
| **UC-50** | Export Catalog Template | Owner | — | FR-52 | NFR-04 | `src/features/productImport.ts#L185` | Detailed Ref |
| **UC-51** | Switch Active Branch ID | Owner | Firebase Auth | FR-02 | NFR-07 | `src/data/firebase/authService.ts#L55` | Detailed Ref |
| **UC-52** | Reset Branch Data | Owner | Firestore | FR-03 | NFR-13 | `src/data/inventoryDataService.ts#L1120` | Detailed Ref |
| **UC-53** | Inspect Diagnostic Event Log | Owner | — | FR-37 | NFR-18 | `src/data/inventoryDataService.ts#L1250` | Detailed Ref |
| **UC-54** | Export JSON Backup | Owner | — | FR-38 | NFR-13 | `src/DataBackup.tsx#L35` | Fully Dressed |
| **UC-55** | Import & Restore JSON Backup | Owner | Firestore | FR-39 | NFR-13 | `src/DataBackup.tsx#L85` | Fully Dressed |
| **UC-56** | Monitor Cloud Sync Status | Butcher, Restaurant, Owner | Firestore | FR-19 | NFR-14 | `src/data/firebaseInventorySync.ts#L85` | Detailed Ref |
| **UC-57** | Resolve Sync Conflicts | System | Firestore | FR-20 | NFR-14 | `src/data/firebaseInventorySync.ts#L420` | Fully Dressed |
| **UC-58** | Toggle Animated Mascot | Butcher, Restaurant, Owner | — | FR-41 | NFR-24 | `src/MascotCompanion.tsx#L20` | Detailed Ref |
| **UC-59** | Fuzzy Match Excel Names | System | — | FR-51 | NFR-04 | `src/features/productImport.ts#L120` | Detailed Ref |

---

## 3. Fully Dressed Use Case Scenarios (Domain 1: Inventory Counting & Stock)

### UC-01: Set Up Shift & Operating Location

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-01: Set Up Shift & Operating Location** |
| **Primary Actor** | Butcher (`butcher`), Restaurant (`restaurant`), Owner (`owner`) |
| **Secondary Actor(s)** | None |
| **Scope & Level** | Smart Inventory Client Application / User-Goal Level |
| **Description** | Operator establishes work period parameters by selecting shift type, date, branch code, and operational station prior to stock operations. |
| **Preconditions** | 1. Local storage initialized with valid schema version (`INVENTORY_SCHEMA_VERSION = 4`).<br>2. Device role assigned or defaulted (`activeRole`). |
| **Trigger** | Operator opens the application at the start of a work shift or navigates to Shift Setup screen. |
| **Main Success Scenario (MSS)** | 1. System displays Shift Setup screen (`src/ShiftSetup.tsx`) populated with current calendar date.<br>2. Operator selects shift duration type: `morning` (صباحية), `evening` (مسائية), or `night` (ليلية).<br>3. System highlights the selected shift type with active visual state.<br>4. Operator verifies or changes operational location: Butcher (`butcher`) or Restaurant (`restaurant`).<br>5. Operator clicks "Start Shift / ابدأ الوردية" action button.<br>6. System creates a `ShiftInfo` object `{ date, shiftType, branchId, startedAt }`.<br>7. System persists shift state into local storage key `current_shift`.<br>8. System transitions UI view to the main Counting Dashboard (`src/App.tsx`). |
| **Extensions (Alternative & Error Flows)** | **2a. Operator leaves shift unselected:**<br>&nbsp;&nbsp;1. System disables the confirmation button and shows inline validation alert: "يرجى اختيار نوع الوردية".<br>&nbsp;&nbsp;2. Flow resumes at Step 2.<br>**4a. Role mismatch for location:**<br>&nbsp;&nbsp;1. If a Butcher role selects Restaurant location without owner credentials, system prompts for Owner PIN verification (`UC-40`).<br>&nbsp;&nbsp;2. If PIN invalid, location resets to assigned role default.<br>**7a. Local storage write failure:**<br>&nbsp;&nbsp;1. System catches storage exception and preserves shift in reactive in-memory state.<br>&nbsp;&nbsp;2. System logs error to diagnostics (`src/data/inventoryDataService.ts#L1250`) and warns user. |
| **Postconditions** | **Success**: Active shift record stored in local storage and React state; location-filtered product catalog loaded.<br>**Failure**: App remains on Shift Setup screen; no counting operations enabled. |
| **Traceability** | **FR-01**, **FR-02** \| **NFR-06**, **NFR-21** \| `src/ShiftSetup.tsx#L18`, `src/App.tsx#L420` |

---

### UC-04: Record Item Count via Manual Keypad

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-04: Record Item Count (Manual Keypad)** |
| **Primary Actor** | Butcher (`butcher`), Restaurant (`restaurant`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Inventory Counting Module / Sub-function Level |
| **Description** | Operator selects an inventory item and enters its counted physical weight or quantity using the touch numeric keypad. |
| **Preconditions** | 1. Active shift established (`UC-01`).<br>2. Product catalog loaded into memory (`categories` and `items`). |
| **Trigger** | Operator taps on a product card in the catalog grid. |
| **Main Success Scenario (MSS)** | 1. System displays product count modal with virtual numeric keypad (`src/App.tsx#L1410`).<br>2. System displays current expected balance, item base unit (`kg`, `g`, `piece`), and last recorded count (if any).<br>3. Operator types numeric value (e.g., `12.50`) via touch keypad buttons `0-9` and decimal point `.`.<br>4. System displays live formatted value in entry display area.<br>5. Operator taps "Confirm Count / تأكيد الجرد".<br>6. System converts entered value to base units (`src/inventoryCatalog.ts#L220`).<br>7. System creates/updates count record in local state and pushes previous value onto undo stack.<br>8. System recalculates variance: `variance = enteredValue - expectedBalance`.<br>9. System updates item badge status: `matched` (أخضر), `tolerance` (أصفر), or `shortage` (أحمر).<br>10. System persists count entry to local storage asynchronously.<br>11. System queues 250ms debounced update to Firestore (`src/data/firebaseInventorySync.ts#L110`).<br>12. System closes modal and focuses next item in category. |
| **Extensions (Alternative & Error Flows)** | **3a. Operator inputs negative or invalid number:**<br>&nbsp;&nbsp;1. Keypad ignores negative sign; entry validator rejects multiple decimal points.<br>&nbsp;&nbsp;2. Entry display flashes error border.<br>**3b. Operator selects Quick Preset:**<br>&nbsp;&nbsp;1. Operator taps preset pill `+0.5`, `+1`, or `+5` (`UC-07`).<br>&nbsp;&nbsp;2. System adds preset amount to current keypad value.<br>**7a. Operator identifies mistake immediately:**<br>&nbsp;&nbsp;1. Operator clicks "Undo / تراجع" button (`UC-08`).<br>&nbsp;&nbsp;2. System pops undo stack and restores previous count state.<br>**11a. Network offline:**<br>&nbsp;&nbsp;1. Firestore queue remains pending in local storage write queue.<br>&nbsp;&nbsp;2. UI displays offline sync pill (`NFR-14`). Count persists locally without blocking. |
| **Postconditions** | **Success**: Item stock balance updated in memory and local storage; badge status reflects variance; debounced sync scheduled.<br>**Failure**: Prior stock count remains unchanged; error notification presented. |
| **Traceability** | **FR-05**, **FR-10**, **FR-19** \| **NFR-01**, **NFR-11**, **NFR-14** \| `src/App.tsx#L1410`, `src/inventoryCatalog.ts#L220` |

---

### UC-05: Record Item Count via BLE Scale

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-05: Record Item Count via BLE Scale** |
| **Primary Actor** | Butcher (`butcher`), Restaurant (`restaurant`) |
| **Secondary Actor(s)** | BLE Scale (`«device»`), Firebase Firestore (`«external system»`) |
| **Scope & Level** | Hardware Integration & Counting / Sub-function Level |
| **Description** | Operator places a physical meat cut or food container on a paired Bluetooth Low Energy scale; the system reads live GATT weight data and registers the count upon stabilization. |
| **Preconditions** | 1. Device Bluetooth hardware enabled with runtime permissions granted.<br>2. BLE scale paired and connected via Weight Measurement Service `0x181D` (`UC-14`).<br>3. Product modal open for a weight-based item (`unit: kg | g`). |
| **Trigger** | Scale sensor registers weight change and streams notification packet over BLE. |
| **Main Success Scenario (MSS)** | 1. Operator places item on physical scale pan.<br>2. BLE scale broadcasts Weight Measurement characteristic `0x2A9D` notifications.<br>3. `BleScaleClient` (`src/features/bleScale.ts#L88`) receives raw `DataView` bytes.<br>4. Client parses byte 0 flags: verifies SI units (kg) and extracts 16-bit weight integer.<br>5. Client applies resolution factor (e.g. `raw * 0.005` or `0.01 kg`) to yield net weight.<br>6. System displays live streaming weight on product count modal screen.<br>7. Weight stabilizes within +/-5g tolerance for >1.2 seconds.<br>8. System emits subtle visual stabilization indicator and activates "Accept Weight / اعتماد الوزن" button.<br>9. Operator clicks "Accept Weight" (or auto-commit triggers if enabled).<br>10. System registers stabilized value as item count (`UC-04` Steps 6–12). |
| **Extensions (Alternative & Error Flows)** | **2a. Scale connection drops during weighing:**<br>&nbsp;&nbsp;1. `BleScaleClient` catches disconnect event listener.<br>&nbsp;&nbsp;2. System displays warning banner: "انقطع الاتصال بالميزان" with retry link.<br>&nbsp;&nbsp;3. Operator falls back to Manual Keypad (`UC-04`).<br>**4a. Scale transmits Imperial units (lbs):**<br>&nbsp;&nbsp;1. Flag bit 0 evaluates to 1.<br>&nbsp;&nbsp;2. System automatically converts lbs to kg: `kg = lbs * 0.45359237`.<br>&nbsp;&nbsp;3. System logs conversion in diagnostics.<br>**7a. Weight fluctuates continuously (unstable air/movement):**<br>&nbsp;&nbsp;1. Stabilization timer resets upon each delta > tolerance threshold.<br>&nbsp;&nbsp;2. System displays "قراءة غير مستقرة..." indicator.<br>&nbsp;&nbsp;3. Operator may manually force capture by tapping keypad confirm. |
| **Postconditions** | **Success**: Verified weight recorded into item count; tare/net weight recorded; local and cloud sync scheduled.<br>**Failure**: No count registered; scale remains in scanning or error state. |
| **Traceability** | **FR-06**, **FR-15**, **FR-16** \| **NFR-02**, **NFR-16** \| `src/features/bleScale.ts#L42-L115`, `src/ScaleConnection.tsx#L35` |

---

### UC-06: Record Item Count via Arabic Voice Recognition

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-06: Record Item Count via Arabic Voice Recognition** |
| **Primary Actor** | Butcher (`butcher`), Restaurant (`restaurant`) |
| **Secondary Actor(s)** | Speech Engine (`«device/service»` Web Speech API / Capacitor Speech) |
| **Scope & Level** | Accessibility & Multimodal Input / Sub-function Level |
| **Description** | Operator speaks spoken Arabic phrases (e.g., "عشرة كيلو ونصف", "خمسة حبات") to count inventory hands-free while wearing food preparation gloves. |
| **Preconditions** | 1. Microphone permission granted to application.<br>2. Active counting view displayed with microphone action button visible. |
| **Trigger** | Operator taps the floating microphone icon (`src/features/speechRecognition.ts#L65`). |
| **Main Success Scenario (MSS)** | 1. System displays listening indicator overlay with pulsing audio visualizer.<br>2. Speech Recognition engine starts capturing audio buffer in `ar-SA` locale.<br>3. Operator speaks quantity and unit (e.g., "لحم بتلو اثنان وعشرون كيلو جرام").<br>4. Engine emits final spoken transcript text.<br>5. System executes Arabic phonetic and numeral normalization parser (`src/features/speechRecognition.ts#L102`):<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Converts Arabic words ("اثنان وعشرون", "نصف", "ربع") to numeric values (`22.5`).<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Identifies target item from catalog via fuzzy string matching.<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Resolves unit: `كيلو` -> `kg`, `جرام` -> `g`, `حبة/قطعة` -> `piece`.<br>6. System displays interpreted result confirmation card: "هل تقصد: لحم بتلو 22.5 كجم؟".<br>7. Operator taps confirm (or speaks "نعم / تأكيد").<br>8. System records the parsed count as current stock (`UC-04` Steps 6–12). |
| **Extensions (Alternative & Error Flows)** | **4a. Background butchery noise prevents recognition:**<br>&nbsp;&nbsp;1. Speech engine returns `no-speech` or low confidence error.<br>&nbsp;&nbsp;2. System displays prompt: "لم يتم التعرف على الصوت بوضوح، يرجى التحدث مرة أخرى".<br>&nbsp;&nbsp;3. Operator retries or switches to keypad.<br>**5a. Spoken item name does not match any catalog item:**<br>&nbsp;&nbsp;1. Parser computes Levenshtein distances; top match is below threshold (<0.6).<br>&nbsp;&nbsp;2. System shows numeric value extracted (`22.5 kg`) and prompts operator to tap target item manually from category list.<br>**5b. Complex fraction parsing ("كيلو إلا ربع"):**<br>&nbsp;&nbsp;1. Custom Arabic fractional grammar handles compound subtractions: `1.0 - 0.25 = 0.75 kg`. |
| **Postconditions** | **Success**: Spoken quantity parsed, normalized, verified, and saved to stock record.<br>**Failure**: No stock mutation; audio stream safely closed; microphone released. |
| **Traceability** | **FR-07**, **FR-17**, **FR-18** \| **NFR-22** \| `src/features/speechRecognition.ts#L28-L140` |

---

### UC-08: Undo Last Count Entry

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-08: Undo Last Count Entry** |
| **Primary Actor** | Butcher (`butcher`), Restaurant (`restaurant`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Operational Quality & Error Correction / Sub-function Level |
| **Description** | Operator reverses an erroneous count submission with a single tap, restoring the prior value and updating variance calculations. |
| **Preconditions** | At least one count entry has been submitted during the active session (`undoStack.length > 0`). |
| **Trigger** | Operator taps "Undo / تراجع" button on counting screen toolbar. |
| **Main Success Scenario (MSS)** | 1. Operator taps "Undo" icon button (`src/App.tsx#L1530`).<br>2. System pops the top mutation descriptor from `undoStack`: `{ itemId, previousCount, newCount, timestamp }`.<br>3. System restores `counts[itemId]` to `previousCount`.<br>4. System recalculates item variance and updates status badge.<br>5. System pushes restoration update to local storage.<br>6. System dispatches updated count payload to Firestore sync queue.<br>7. System presents transient toast notification: "تم التراجع عن الجرد بنجاح".<br>8. If `undoStack` is now empty, system disables the "Undo" button. |
| **Extensions (Alternative & Error Flows)** | **2a. Undo stack empty:**<br>&nbsp;&nbsp;1. "Undo" button is disabled/greyed out; click ignored.<br>**5a. Restored item was part of composite auto-deduction:**<br>&nbsp;&nbsp;1. System rolls back constituent raw component deductions in synchrony (`src/features/compositeInventory.ts`). |
| **Postconditions** | **Success**: Prior count value reinstated; audit ledger updated; sync queue notified.<br>**Failure**: Current count value preserved; stack intact. |
| **Traceability** | **FR-09** \| **NFR-21** \| `src/App.tsx#L1530-L1570` |

---

### UC-11: Record Waste / Shrinkage with Cause Categorization

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-11: Record Waste / Shrinkage with Cause Categorization** |
| **Primary Actor** | Butcher (`butcher`), Restaurant (`restaurant`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Inventory Valuation & Loss Tracking / Sub-function Level |
| **Description** | Operator logs spoiled, trimmed, or damaged meat/goods specifying weight and predefined reason to distinguish legitimate loss from shrinkage. |
| **Preconditions** | Item exists in catalog; operator has active shift context. |
| **Trigger** | Operator clicks "Record Waste / تسجيل هالك" from item options dropdown. |
| **Main Success Scenario (MSS)** | 1. System opens Waste Entry modal (`src/data/inventoryDataService.ts#L410`).<br>2. System displays item name, current stock, and unit.<br>3. Operator enters wasted quantity (e.g. `1.85 kg`).<br>4. Operator selects mandatory waste reason category: `spoiled` (تلف/فساد), `trimmed_fat` (دهون/تشذيب), `dropped` (سقوط/تلوث), or `expired` (انتهاء صلاحية).<br>5. Operator optionally enters explanatory notes (e.g., "انقطاع كهرباء الثلاجة رقم 2").<br>6. Operator taps "Confirm Waste / تسجيل الهالك".<br>7. System validates that wasted quantity is greater than zero and does not exceed configured physical limits.<br>8. System generates a `StockMovement` entity with `movementType: "waste"`, `timestamp: ISOString`, and reason metadata.<br>9. System updates local ledger and adjusts expected stock calculation.<br>10. System persists record locally and broadcasts to Firestore sync. |
| **Extensions (Alternative & Error Flows)** | **7a. Entered waste exceeds current stock:**<br>&nbsp;&nbsp;1. System displays warning dialog: "الكمية المسجلة للهالك تتجاوز الرصيد الحالي، هل أنت متأكد؟".<br>&nbsp;&nbsp;2. If operator confirms, record is flagged with `high_shrinkage_flag = true`.<br>&nbsp;&nbsp;3. If operator cancels, focus returns to Step 3.<br>**4a. Reason left unselected:**<br>&nbsp;&nbsp;1. System highlights reason selector in red and disables submit button. |
| **Postconditions** | **Success**: Immutable waste movement recorded; item expected stock reduced; audit shrinkage metrics updated.<br>**Failure**: No waste logged; inventory balance unchanged. |
| **Traceability** | **FR-12** \| **NFR-11** \| `src/data/inventoryDataService.ts#L410-L460` |

---

### UC-12: Count Composite / Recipe Item with Auto-Deduction

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-12: Count Composite / Recipe Item with Auto-Deduction** |
| **Primary Actor** | Restaurant (`restaurant`) |
| **Secondary Actor(s)** | None (Internal Service Logic) |
| **Scope & Level** | Composite Recipe Management / Sub-function Level |
| **Description** | Restaurant staff counts prepared dishes or meal units (e.g. 50 burger patties); the system automatically calculates and deducts raw component inventory (minced meat, spices, packaging) based on predefined recipes. |
| **Preconditions** | 1. Item configured as composite item with `isComposite: true` and populated `components: RecipeComponent[]` in catalog (`src/models.ts#L68`).<br>2. Operating location set to Restaurant. |
| **Trigger** | Operator records a count on a composite product card. |
| **Main Success Scenario (MSS)** | 1. Operator enters counted quantity for recipe item (e.g., `40` units of "برجر جاهز") via keypad (`UC-04`).<br>2. Operator confirms count submission.<br>3. System invokes `autoDeductComponents()` (`src/features/compositeInventory.ts#L15`).<br>4. System iterates through `item.components`: for each constituent raw item (e.g., "لحم مفروم" 150g per unit, "بهارات برجر" 5g per unit):<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Calculates total component consumption: `totalDeduction = component.quantity * countedUnits` (e.g., `40 * 150g = 6.0 kg`).<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Creates synthetic `StockMovement` record with `movementType: "auto_deduct"`, linking parent composite ID.<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Subtracts consumed quantity from raw item's expected stock.<br>5. System displays breakdown toast: "تم تسجيل 40 برجر وخصم 6 كجم مفروم و 200 جم بهارات".<br>6. System stores composite count and raw deductions atomically in local storage.<br>7. System syncs atomic batch to Firestore (`UC-18`). |
| **Extensions (Alternative & Error Flows)** | **4a. Raw component inventory falls below zero:**<br>&nbsp;&nbsp;1. System allows deduction but tags raw component with negative inventory flag.<br>&nbsp;&nbsp;2. System surfaces warning badge: "عجز في المخزون الخام: لحم مفروم".<br>**4b. Recipe definition contains non-existent raw item ID:**<br>&nbsp;&nbsp;1. System logs missing component warning to diagnostics log.<br>&nbsp;&nbsp;2. System skips invalid component, deducts valid components, and flags recipe for Owner review (`UC-46`). |
| **Postconditions** | **Success**: Composite item count updated; all recipe raw materials deducted proportionally; ledger audit trail intact.<br>**Failure**: No counts or deductions committed; error displayed. |
| **Traceability** | **FR-13**, **FR-14** \| **NFR-11** \| `src/features/compositeInventory.ts#L15-L85` |

---

## 4. Fully Dressed Use Case Scenarios (Domain 2: Transfers, Audit & Reporting)

### UC-19: Create Outbound Stock Transfer (Butcher -> Restaurant)

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-19: Create Outbound Stock Transfer (Butcher -> Restaurant)** |
| **Primary Actor** | Butcher (`butcher`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Inter-Location Stock Movement / User-Goal Level |
| **Description** | Butcher prepares meat cuts for kitchen use, specifies items and verified weights, and dispatches a formal transfer request to the restaurant station. |
| **Preconditions** | 1. Active terminal role set to Butcher.<br>2. Items to be transferred exist in catalog with positive stock. |
| **Trigger** | Butcher navigates to "Transfers / التحويلات" tab and clicks "New Transfer / تحويل جديد". |
| **Main Success Scenario (MSS)** | 1. System opens Transfer Creation view (`src/data/inventoryDataService.ts#L520`).<br>2. System sets `fromLocation: "butcher"` and `toLocation: "restaurant"`.<br>3. Butcher adds items to transfer manifest:<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Selects item from catalog dropdown.<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Enters weighed quantity (manual or BLE scale `UC-05`).<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Adds optional line notes (e.g., "شقف شاورما طازجة").<br>4. Butcher reviews manifest summary: total lines, total kilograms, and transfer timestamp.<br>5. Butcher clicks "Dispatch Transfer / إرسال الشحنة".<br>6. System creates a `Transfer` entity (`src/models.ts#L45`):<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Generates unique UUID (`transferId`).<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Sets `status: "Sent"`.<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Populates `lines: TransferLine[]` with sent weights.<br>7. System records outbound stock movement in butcher local ledger.<br>8. System writes transfer document to Firestore under branch transfers collection.<br>9. System displays success confirmation and prints/displays transfer dispatch ticket.<br>10. Receiving restaurant terminal receives real-time notification via Firestore snapshot (`UC-23`). |
| **Extensions (Alternative & Error Flows)** | **3a. Butcher enters quantity exceeding butcher stock:**<br>&nbsp;&nbsp;1. System flags item line with yellow notice: "الكمية تتجاوز الرصيد المسجل".<br>&nbsp;&nbsp;2. Allows transfer to proceed to support real-world emergency kitchen requests.<br>**5a. Network offline during dispatch:**<br>&nbsp;&nbsp;1. System saves transfer locally with `syncStatus: "pending"`.<br>&nbsp;&nbsp;2. Displays transfer in "Pending Outbox" with offline warning.<br>&nbsp;&nbsp;3. Automatic background sync transmits to Firestore once connection resumes. |
| **Postconditions** | **Success**: Transfer entity stored with `status: "Sent"`; butcher ledger updated; restaurant notified.<br>**Failure**: Transfer remains in draft state; butcher inventory uncommitted. |
| **Traceability** | **FR-20**, **FR-25** \| **NFR-03**, **NFR-11** \| `src/data/inventoryDataService.ts#L520-L585` |

---

### UC-20: Receive & Verify Stock Transfer (with UC-20b Discrepancy)

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-20: Receive & Verify Stock Transfer** (including **UC-20b: Flag Discrepancy**) |
| **Primary Actor** | Restaurant (`restaurant`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Inter-Location Goods Receipt / User-Goal Level |
| **Description** | Kitchen staff inspects physical meat delivery from butcher, weighs received cuts, verifies quantities against manifest, and accepts transfer (or logs variance). |
| **Preconditions** | An outbound transfer exists with `status: "Sent"` targeted to Restaurant. |
| **Trigger** | Restaurant staff taps on pending transfer alert banner or navigates to Transfers tab. |
| **Main Success Scenario (MSS)** | 1. System displays pending transfer details (`src/data/inventoryDataService.ts#L590`): sender, timestamp, line items, and sent weights.<br>2. Restaurant staff weighs incoming physical goods using scale (`UC-05`) or keypad.<br>3. Staff enters received weight for each line item.<br>4. Received weights match sent weights within tolerance threshold (+/- 1%).<br>5. Staff clicks "Confirm & Accept / استلام وتأكيد".<br>6. System transitions transfer `status` to `"Received"`.<br>7. System records receiving timestamp and recipient user identifier.<br>8. System updates restaurant inventory balances: increases expected stock by verified received weight.<br>9. System updates transfer document in Firestore.<br>10. System notifies butcher device that shipment was accepted without issues. |
| **Extensions (Alternative & Error Flows)** | **4a. Received weight differs from sent weight (UC-20b Flag Discrepancy):**<br>&nbsp;&nbsp;1. Entered weight exceeds tolerance (e.g. Sent: `10.0 kg`, Received: `8.8 kg`, delta: `-1.2 kg`).<br>&nbsp;&nbsp;2. System highlights discrepancy in red with variance calculation.<br>&nbsp;&nbsp;3. System requires mandatory discrepancy reason code from dropdown: `scale_difference`, `transit_spill`, `short_delivered`, or `rejected`.<br>&nbsp;&nbsp;4. Staff enters mandatory comment explaining dispute.<br>&nbsp;&nbsp;5. Staff clicks "Accept with Discrepancy / استلام مع تسجيل فرق".<br>&nbsp;&nbsp;6. System sets transfer `status: "Discrepancy"`.<br>&nbsp;&nbsp;7. System credits restaurant stock ONLY with actual received weight (`8.8 kg`).<br>&nbsp;&nbsp;8. System logs `-1.2 kg` shrinkage against butcher outbound ledger.<br>&nbsp;&nbsp;9. System dispatches high-priority notification to Owner dashboard (`UC-38`). |
| **Postconditions** | **Success**: Transfer marked `"Received"` or `"Discrepancy"`; recipient stock updated; variance recorded; both nodes synchronized.<br>**Failure**: Transfer remains in `"Sent"` state; no stock credited to kitchen. |
| **Traceability** | **FR-21**, **FR-22**, **FR-35** \| **NFR-03**, **NFR-11** \| `src/data/inventoryDataService.ts#L590-L645` |

---

### UC-21: Cancel Outbound Transfer

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-21: Cancel Outbound Transfer** |
| **Primary Actor** | Butcher (`butcher`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Inter-Location Exception Handling / Sub-function Level |
| **Description** | Butcher revokes an accidental or recalled transfer before it has been accepted by the restaurant terminal. |
| **Preconditions** | Transfer exists in local/remote state with current `status == "Sent"`. |
| **Trigger** | Butcher clicks "Cancel Transfer / إلغاء التحويل" button on pending transfer card. |
| **Main Success Scenario (MSS)** | 1. System prompts confirmation dialog: "هل أنت متأكد من إلغاء هذا التحويل؟ سيتم استعادة الكميات للملحمة".<br>2. Butcher confirms cancellation.<br>3. System verifies transfer status is still `"Sent"` (concurrency check against remote snapshot).<br>4. System updates transfer `status` to `"Cancelled"` (`src/data/inventoryDataService.ts#L650`).<br>5. System rolls back reserved stock quantities into butcher active stock.<br>6. System broadcasts cancellation update to Firestore.<br>7. Restaurant UI removes the pending transfer alert and displays cancellation notice. |
| **Extensions (Alternative & Error Flows)** | **3a. Transfer was already accepted by Restaurant (race condition):**<br>&nbsp;&nbsp;1. Remote check reveals status is `"Received"` or `"Discrepancy"`.<br>&nbsp;&nbsp;2. System aborts cancellation and alerts Butcher: "لا يمكن الإلغاء، تم استلام الشحنة بالفعل من قبل المطعم".<br>&nbsp;&nbsp;3. Flow terminates without stock modification. |
| **Postconditions** | **Success**: Transfer marked `"Cancelled"`; butcher stock restored; pending notification cleared.<br>**Failure**: Cancellation rejected; existing status preserved. |
| **Traceability** | **FR-23** \| **NFR-11** \| `src/data/inventoryDataService.ts#L650-L685` |

---

### UC-24 & UC-26: Conduct, Review & Finalise Comprehensive Audit Session

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-24 & UC-26: Conduct, Review & Finalise Comprehensive Audit Session** |
| **Primary Actor** | Owner (`owner`), Butcher (`butcher`), Restaurant (`restaurant`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Audit Governance & Financial Reconciliation / Business Level |
| **Description** | Terminal completes physical counts for all items in shift, reviews aggregate variances/shrinkage, and commits an immutable, archived audit snapshot. |
| **Preconditions** | 1. Active shift in progress (`UC-01`).<br>2. At least 80% of catalog items counted (or operator forces submission). |
| **Trigger** | Operator clicks "Finish & Archive Audit / إنهاء واعتماد الجرد" button (`src/App.tsx#L2650`). |
| **Main Success Scenario (MSS)** | 1. System transitions view to Audit Review Screen (`src/App.tsx#L2800`).<br>2. System computes aggregate audit statistics (`src/features/inventoryStatus.ts`):<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Total counted items vs. uncounted items.<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Count of matched items (`matchedCount`), within-tolerance items (`toleranceCount`), and shortage items (`shortageCount`).<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Net variance weight in kg (`totalVarianceKg`) and estimated monetary variance.<br>3. System renders color-coded variance review table showing items with significant shrinkage.<br>4. Operator reviews discrepancies and enters final audit remarks.<br>5. Operator clicks "Commit Final Audit / اعتماد الترحيل النهائي".<br>6. System prompts security challenge: requires Owner or Manager PIN (`UC-40`).<br>7. Operator inputs valid 4-digit PIN.<br>8. System compiles immutable `AuditRecord` object (`src/models.ts#L52`):<br>&nbsp;&nbsp;&nbsp;&nbsp;`{ id: UUID, date, shiftType, location, branchId, totalItems, matchedCount, shortageCount, totalVarianceKg, lines: [...], committedBy, committedAt }`.<br>9. System saves record into local `audits` repository (`src/data/inventoryDataService.ts#L780`).<br>10. System pushes audit snapshot to Firestore `audits` collection.<br>11. System resets active shift counting counters, archives current balances, and unlocks PDF generation (`UC-29`). |
| **Extensions (Alternative & Error Flows)** | **2a. Uncounted items exist in catalog:**<br>&nbsp;&nbsp;1. System displays warning modal: "يوجد X أصناف لم يتم جردها بعد. هل تريد اعتبار رصيدها صفراً أم تخطيها؟".<br>&nbsp;&nbsp;2. Operator selects preference; system applies chosen zero-fill policy.<br>**7a. Invalid PIN entered:**<br>&nbsp;&nbsp;1. System displays error shake animation and message: "رمز الأمان غير صحيح".<br>&nbsp;&nbsp;2. Audit is not committed; remains in review state. |
| **Postconditions** | **Success**: Immutable `AuditRecord` archived; shift counters cleared; audit history updated; cloud synced.<br>**Failure**: Session remains open; counts editable; no archive entry created. |
| **Traceability** | **FR-26**, **FR-27**, **FR-28** \| **NFR-01**, **NFR-11**, **NFR-13** \| `src/App.tsx#L2650-L2880`, `src/data/inventoryDataService.ts#L780-L840` |

---

### UC-29 & UC-30: Generate Canvas PDF Report & Share via WhatsApp

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-29 & UC-30: Generate Canvas PDF Report & Share via WhatsApp** |
| **Primary Actor** | Owner (`owner`) |
| **Secondary Actor(s)** | WhatsApp Service (`«external service»`) |
| **Scope & Level** | Reporting & Stakeholder Dispatch / Sub-function Level |
| **Description** | System renders an Arabic RTL audit report on an HTML5 Canvas, exports it to a vector jsPDF document, and constructs a pre-formatted WhatsApp deep-link. |
| **Preconditions** | An audit record exists (active session or historical audit from `AuditHistory`). |
| **Trigger** | Owner clicks "PDF Report / تقرير PDF" or "Send to WhatsApp / إرسال عبر واتساب" button. |
| **Main Success Scenario (MSS)** | 1. System initializes `PdfReport` component (`src/PdfReport.tsx#L55`).<br>2. System creates offscreen HTML5 `<canvas>` element configured for high-DPI (2x scale).<br>3. Canvas rendering engine draws Arabic text, header banners, store branding, and summary metrics.<br>4. Canvas draws structured inventory data table: Item Name, Base Unit, Expected Qty, Actual Count, Variance, and Status Badge.<br>5. System converts rendered Canvas pages into PDF format via `jsPDF` (`src/PdfReport.tsx#L180`).<br>6. System displays interactive PDF preview modal to Owner with zoom/pagination controls.<br>7. Owner clicks "Share via WhatsApp / مشاركة واتساب" button (`UC-30`).<br>8. System invokes `sharePdfViaWhatsApp()` (`src/features/pdfDelivery.ts#L35`):<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Compiles concise WhatsApp text summary: Shift name, date, total variance kg, shortage count, and key alerts.<br>&nbsp;&nbsp;&nbsp;&nbsp;b. URL-encodes the text payload.<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Constructs deep-link URL: `https://wa.me/?text={encodedPayload}`.<br>9. System opens external WhatsApp web/app interface with pre-filled message.<br>10. On native Android (Capacitor), system triggers native file share sheet allowing direct PDF attachment sharing. |
| **Extensions (Alternative & Error Flows)** | **5a. Canvas font loading failure (Arabic glyph corruption):**<br>&nbsp;&nbsp;1. System checks font metric readiness prior to draw calls.<br>&nbsp;&nbsp;2. Falls back to standard embedded Cairo/Amiri webfont or system Arabic font.<br>**9a. WhatsApp client not installed on device:**<br>&nbsp;&nbsp;1. Browser redirects to web WhatsApp (`web.whatsapp.com`).<br>&nbsp;&nbsp;2. User can copy generated clipboard text manually. |
| **Postconditions** | **Success**: PDF generated, previewed, and downloadable; formatted summary transferred to WhatsApp dispatch queue.<br>**Failure**: Error toast displayed; no PDF download initiated. |
| **Traceability** | **FR-31**, **FR-32**, **FR-36** \| **NFR-04**, **NFR-21**, **NFR-23** \| `src/PdfReport.tsx#L55-L230`, `src/features/pdfDelivery.ts#L35-L80` |

---

## 5. Fully Dressed Use Case Scenarios (Domain 3: Owner Administration, Device & Data)

### UC-39 & UC-40: Select / Switch Device Role with Role PIN Verification

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-39 & UC-40: Select / Switch Device Role with Role PIN Verification** |
| **Primary Actor** | Butcher (`butcher`), Restaurant (`restaurant`), Owner (`owner`) |
| **Secondary Actor(s)** | None |
| **Scope & Level** | Access Control & Terminal Configuration / Sub-function Level |
| **Description** | Operator switches terminal operating mode between Owner, Butcher, and Restaurant, enforcing PIN protection on privileged transitions. |
| **Preconditions** | Role PINs configured in system settings (`rolePins` key in local storage). |
| **Trigger** | Operator taps the role badge in the application header or opens Device Connect Modal. |
| **Main Success Scenario (MSS)** | 1. System opens Device Connect & Role Modal (`src/DeviceConnectModal.tsx#L40`).<br>2. System displays three role cards: `owner` (المالك), `butcher` (الملحمة), and `restaurant` (المطعم).<br>3. Operator taps desired target role (e.g. `owner`).<br>4. If target role has an active PIN configured (default: Owner PIN required):<br>&nbsp;&nbsp;&nbsp;&nbsp;a. System displays 4-digit PIN keypad entry modal (`UC-40`).<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Operator enters 4-digit PIN.<br>&nbsp;&nbsp;&nbsp;&nbsp;c. System compares entered PIN hash against stored role PIN (`src/DeviceConnectModal.tsx#L110`).<br>&nbsp;&nbsp;&nbsp;&nbsp;d. PIN matches successfully.<br>5. System sets `activeRole = targetRole` in application state and persists to `device_role` storage.<br>6. System reconfigures UI navigation: reveals Owner tabs (Analytics, Catalog Management, Data Backup).<br>7. System broadcasts role update to Firebase presence channel (`UC-43`).<br>8. System displays confirmation banner: "تم تغيير الدور إلى: المالك". |
| **Extensions (Alternative & Error Flows)** | **4d. Operator enters incorrect PIN:**<br>&nbsp;&nbsp;1. Keypad displays error animation and plays haptic error vibration.<br>&nbsp;&nbsp;2. Error message displayed: "رمز PIN غير صحيح، حاول مرة أخرى".<br>&nbsp;&nbsp;3. After 3 failed attempts, system enforces a 30-second lockout timer.<br>&nbsp;&nbsp;4. Role remains unchanged.<br>**4e. Role has no PIN set:**<br>&nbsp;&nbsp;1. System bypasses PIN prompt and executes role transition immediately. |
| **Postconditions** | **Success**: Active role updated; UI permissions aligned; device presence reflects new role.<br>**Failure**: Role transition aborted; previous role and UI permissions retained. |
| **Traceability** | **FR-41**, **FR-42** \| **NFR-06** \| `src/DeviceConnectModal.tsx#L40-L160`, `src/data/inventoryDataService.ts#L940` |

---

### UC-41 & UC-42: Branch Pairing via Dynamic QR Code Display & Scan

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-41 & UC-42: Branch Pairing via Dynamic QR Code Display & Scan** |
| **Primary Actor** | Owner (`owner`), Operator (Butcher/Restaurant) |
| **Secondary Actor(s)** | Device Camera Hardware |
| **Scope & Level** | Multi-Device Provisioning & Onboarding / User-Goal Level |
| **Description** | Owner displays an encrypted branch configuration QR code on the primary terminal; a secondary tablet scans it using its camera to pair instantly without manual typing. |
| **Preconditions** | 1. Primary device configured with valid `branchId` and sync credentials.<br>2. Secondary device has camera permission enabled. |
| **Trigger** | Owner clicks "Share Branch QR / مشاركة رمز الفرع" in Device Connect Modal. |
| **Main Success Scenario (MSS)** | 1. Primary terminal generates a payload containing: `{ branchId, storeCode, authType, createdAt }`.<br>2. Primary terminal renders high-resolution QR code using `qrcode` library (`src/DeviceConnectModal.tsx#L185`).<br>3. Operator on secondary tablet taps "Scan Branch QR / مسح رمز الفرع" (`UC-42`).<br>4. Secondary tablet initializes camera feed via HTML5 video stream / native barcode scanner.<br>5. Secondary tablet detects and decodes the QR code pattern.<br>6. Secondary tablet validates JSON schema of decoded payload.<br>7. Secondary tablet applies `branchId` and store credentials to local configuration.<br>8. Secondary tablet triggers cloud authentication handshake (`src/data/firebase/authService.ts`).<br>9. Secondary tablet joins branch sync group and downloads catalog and pending transfers.<br>10. Primary and secondary devices display mutual connection success indicators. |
| **Extensions (Alternative & Error Flows)** | **5a. Camera unable to focus or QR code corrupted:**<br>&nbsp;&nbsp;1. Scanner provides visual framing guide and torch/flash toggle.<br>&nbsp;&nbsp;2. If scanning fails after 15 seconds, system surfaces manual text entry fallback: "أو أدخل كود الفرع يدوياً".<br>**6a. Invalid or expired QR payload:**<br>&nbsp;&nbsp;1. Scanner rejects payload: "رمز QR غير صالح أو خاص بنظام آخر".<br>&nbsp;&nbsp;2. Flow terminates without altering branch settings. |
| **Postconditions** | **Success**: Secondary terminal linked to primary branch; automatic cloud synchronization active.<br>**Failure**: Secondary device retains prior configuration; no unauthorized branch access. |
| **Traceability** | **FR-43**, **FR-44** \| **NFR-21** \| `src/DeviceConnectModal.tsx#L185-L250` |

---

### UC-43: Real-Time Multi-Device Presence Tracking (12s Heartbeats)

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-43: Real-Time Multi-Device Presence Tracking** |
| **Primary Actor** | Owner (`owner`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Distributed System Diagnostics & Monitoring / Sub-function Level |
| **Description** | System maintains continuous active device roster across butcher, kitchen, and owner terminals via periodic 12-second cloud heartbeats. |
| **Preconditions** | Device connected to Internet; branch session initialized. |
| **Trigger** | Application bootstrap initializes background presence daemon (`src/data/firebaseInventorySync.ts#L310`). |
| **Main Success Scenario (MSS)** | 1. Background daemon generates ephemeral client ID (`deviceId`) and records local role.<br>2. Daemon schedules recurring timer with 12-second interval (`HEARTBEAT_INTERVAL_MS = 12000`).<br>3. At each tick, daemon writes timestamp to Firestore: `branches/{branchId}/presence/{deviceId}`.<br>4. Owner terminal subscribes to real-time snapshot of `presence` collection.<br>5. Owner UI inspects all presence records: devices with `lastSeen < 30 seconds ago` marked "Online" (أخضر).<br>6. Devices with `30s <= lastSeen < 90s` marked "Idle" (أصفر); devices `>90s` pruned or marked "Offline" (رمادي).<br>7. Owner views live device grid in Device Connect Modal showing active stations and ping latencies. |
| **Extensions (Alternative & Error Flows)** | **3a. Device loses Internet connectivity:**<br>&nbsp;&nbsp;1. Local heartbeat fails silently without crashing.<br>&nbsp;&nbsp;2. Remote devices detect stale heartbeat and mark terminal offline.<br>&nbsp;&nbsp;3. Upon reconnect, daemon immediately sends flush heartbeat. |
| **Postconditions** | **Success**: Firestore presence registry updated; Owner UI displays accurate live roster.<br>**Failure**: Terminal marked offline in remote view until next successful heartbeat. |
| **Traceability** | **FR-45** \| **NFR-12** \| `src/data/firebaseInventorySync.ts#L310-L355` |

---

### UC-46: Manage Products & Recipes (CRUD Operations)

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-46: Manage Products & Recipes (CRUD Operations)** |
| **Primary Actor** | Owner (`owner`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Master Data Management / User-Goal Level |
| **Description** | Owner creates, modifies, or archives products in the catalog, configuring base units, conversion multipliers, tolerance thresholds, and recipe formulas. |
| **Preconditions** | Active role is Owner (`activeRole == "owner"`). |
| **Trigger** | Owner navigates to "Manage Products / إدارة الأصناف" view (`src/App.tsx#L4100`). |
| **Main Success Scenario (MSS)** | 1. System displays searchable product catalog table grouped by 5 fixed categories (`meat`, `poultry`, `vegetables`, `spices`, `beverages`).<br>2. Owner clicks "Add Product / إضافة صنف جديد".<br>3. Owner enters product name in Arabic (e.g., "شاورما دجاج متبلة").<br>4. Owner selects category, base unit (`kg`, `g`, `pack`, `piece`), and entry unit multiplier (`UC-47`).<br>5. Owner sets variance tolerance threshold percentage (e.g. `2.5%`) (`UC-48`).<br>6. If product is a composite dish, Owner toggles "Recipe Item" and defines component ingredient requirements (`UC-12`).<br>7. Owner clicks "Save Product / حفظ الصنف".<br>8. System validates that product name is unique within category and multiplier > 0.<br>9. System creates/updates `Item` entity in local catalog storage.<br>10. System broadcasts updated catalog delta to Firestore `keys/catalog` collection.<br>11. All connected butcher and restaurant terminals receive updated catalog in real time. |
| **Extensions (Alternative & Error Flows)** | **8a. Duplicate product name detected:**<br>&nbsp;&nbsp;1. System flags error: "اسم الصنف مسجل مسبقاً في هذا التصنيف".<br>&nbsp;&nbsp;2. Form remains open for editing.<br>**10a. Cloud sync offline:**<br>&nbsp;&nbsp;1. Product saved in local storage; queued for sync upon next reconnect. |
| **Postconditions** | **Success**: Master product record saved and synchronized across all branch nodes.<br>**Failure**: Product not saved; catalog remains unchanged. |
| **Traceability** | **FR-48**, **FR-49**, **FR-50** \| **NFR-11** \| `src/App.tsx#L4100-L4250`, `src/inventoryCatalog.ts#L180` |

---

### UC-49 & UC-59: Import Catalog from Excel with Levenshtein Fuzzy Matching

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-49 & UC-59: Import Catalog from Excel with Fuzzy Matching** |
| **Primary Actor** | Owner (`owner`) |
| **Secondary Actor(s)** | None |
| **Scope & Level** | Data Onboarding & Bulk Migration / User-Goal Level |
| **Description** | Owner uploads a supplier or legacy Excel spreadsheet (`.xlsx`); the system parses rows, validates columns, maps names via Damerau-Levenshtein distance, and executes bulk catalog updates. |
| **Preconditions** | Active role is Owner; spreadsheet file formatted with recognized column headers. |
| **Trigger** | Owner clicks "Import Excel / استيراد من إكسيل" button (`src/features/productImport.ts#L30`). |
| **Main Success Scenario (MSS)** | 1. Owner selects local `.xlsx` file via native file picker.<br>2. System reads binary workbook using `read-excel-file` library.<br>3. System scans header row: maps Arabic and English headers (`اسم الصنف/Item Name`, `التصنيف/Category`, `الوحدة/Unit`, `السعر/Price`).<br>4. System processes data rows sequentially:<br>&nbsp;&nbsp;&nbsp;&nbsp;a. Extracts raw item name and normalizes Arabic characters (strips Tashkeel, standardizes Alef/Yaa).<br>&nbsp;&nbsp;&nbsp;&nbsp;b. Executes Damerau-Levenshtein distance matching against existing catalog items (`UC-59`, `src/features/productImport.ts#L120`).<br>&nbsp;&nbsp;&nbsp;&nbsp;c. Computes similarity score: rows with score >= 0.85 classified as existing product updates; others classified as new products.<br>5. System displays interactive Import Preview modal showing: New Items (أخضر), Updates (أزرق), and Unrecognized (أصفر).<br>6. Owner reviews preview, resolves any ambiguous matches, and clicks "Confirm Import / تأكيد الاستيراد".<br>7. System applies bulk additions and updates atomically to local catalog repository.<br>8. System queues catalog sync to Firestore (`UC-18`).<br>9. System presents summary banner: "تم استيراد X صنف بنجاح وتحديث Y صنف". |
| **Extensions (Alternative & Error Flows)** | **2a. File is corrupted or invalid format:**<br>&nbsp;&nbsp;1. System catches parser exception and displays alert: "الملف غير صالح، يرجى التأكد من اختيار ملف إكسيل بصيغة .xlsx".<br>&nbsp;&nbsp;2. Flow terminates safely without mutating storage.<br>**3a. Mandatory headers missing:**<br>&nbsp;&nbsp;1. System identifies missing columns (e.g. "اسم الصنف missing").<br>&nbsp;&nbsp;2. Displays template guide and offers "Download Excel Template / تحميل قالب فارغ" (`UC-50`). |
| **Postconditions** | **Success**: Catalog updated with imported items; fuzzy match mappings resolved; cloud sync dispatched.<br>**Failure**: Catalog untouched; detailed parsing error report displayed. |
| **Traceability** | **FR-51**, **FR-52** \| **NFR-04**, **NFR-21** \| `src/features/productImport.ts#L30-L195` |

---

### UC-54 & UC-55: Full System JSON Backup Export & Restore

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-54 & UC-55: Full System JSON Backup Export & Restore** |
| **Primary Actor** | Owner (`owner`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Disaster Recovery & Data Portability / User-Goal Level |
| **Description** | Owner generates an encrypted/validated JSON snapshot of entire system state (catalog, counts, transfers, audit history, PINs) or restores a prior backup. |
| **Preconditions** | Active role is Owner; device storage accessible. |
| **Trigger** | Owner navigates to "Data Backup / النسخ الاحتياطي" screen (`src/DataBackup.tsx#L35`). |
| **Main Success Scenario (MSS) — Export (UC-54)** | 1. Owner clicks "Export Backup / تصدير نسخة احتياطية".<br>2. System queries all repositories via `InventoryDataService`: catalog, stock movements, transfers, audits, shifts, and settings.<br>3. System packages data into single structured JSON schema:<br>&nbsp;&nbsp;&nbsp;&nbsp;`{ schemaVersion: 4, exportedAt: ISOString, branchId, data: { ... } }`.<br>4. System computes payload SHA-256 integrity checksum.<br>5. System triggers client-side file download: `smart-inventory-backup-{branchId}-{date}.json`.<br>6. System logs export event in diagnostic history. |
| **Main Success Scenario (MSS) — Restore (UC-55)** | 1. Owner clicks "Restore from Backup / استعادة من نسخة احتياطية" (`src/DataBackup.tsx#L85`).<br>2. Owner selects JSON backup file from file picker.<br>3. System reads and parses JSON contents.<br>4. System validates schema compatibility: verifies `schemaVersion <= INVENTORY_SCHEMA_VERSION` (v4).<br>5. System prompts critical security challenge: requires Owner PIN verification (`UC-40`).<br>6. Owner inputs valid PIN.<br>7. System presents summary of data to be overwritten: item counts, transfer records, historical audits.<br>8. Owner clicks "Confirm Full Restore / تأكيد الاستعادة".<br>9. System executes transactional batch restore into local storage repository.<br>10. System pushes restored dataset to Firestore to synchronize branch devices.<br>11. System forces application cache reload and redirects to Home dashboard. |
| **Extensions (Alternative & Error Flows)** | **4a. (Restore) Incompatible schema version detected (e.g. v1 or v2):**<br>&nbsp;&nbsp;1. System executes migration transforms (`src/data/inventoryDataService.ts#L1500`) to upgrade legacy data to Schema v4.<br>&nbsp;&nbsp;2. If migration succeeds, flow resumes at Step 5; if corrupted, restore aborts with error alert.<br>**6a. (Restore) Invalid PIN entered:**<br>&nbsp;&nbsp;1. Restore operation instantly cancelled; no data overwritten. |
| **Postconditions** | **Success (Export)**: Complete JSON backup file downloaded locally.<br>**Success (Restore)**: System state restored to backup snapshot; cloud synchronized; app reloaded.<br>**Failure**: Existing database state remains 100% untouched. |
| **Traceability** | **FR-38**, **FR-39** \| **NFR-13** \| `src/DataBackup.tsx#L35-L140`, `src/data/inventoryDataService.ts#L1120-L1190` |

---

### UC-57: Offline Cloud Synchronization & Conflict Resolution

| Element | Specification |
|---|---|
| **Use Case ID & Name** | **UC-57: Offline Cloud Synchronization & Conflict Resolution** |
| **Primary Actor** | System (`«internal engine»`) |
| **Secondary Actor(s)** | Firebase Firestore (`«external system»`) |
| **Scope & Level** | Data Consistency & Resilience / Sub-function Level |
| **Description** | System detects network restoration after offline operations, flushes pending local mutations to Firestore, and resolves concurrent cross-device conflicting edits using domain merge logic. |
| **Preconditions** | Terminal was operating offline with mutations buffered in local storage queue; network connectivity restored. |
| **Trigger** | Browser/Capacitor `online` event fired or background sync poller detects reachable Firestore endpoint (`src/data/firebaseInventorySync.ts#L420`). |
| **Main Success Scenario (MSS)** | 1. `FirebaseInventorySync` engine detects active connection (`isOnline = true`).<br>2. Engine retrieves queued pending mutations from local write queue.<br>3. Engine fetches latest remote state from Firestore for each key via `getDoc()`.<br>4. For each key with concurrent modifications, engine invokes domain-specific merge strategy (`src/data/firebaseInventorySync.ts#L440`):<br>&nbsp;&nbsp;&nbsp;&nbsp;a. **Stock Counts (`counts`)**: Merges per-item maps using Last-Write-Wins (LWW) based on item mutation timestamp.<br>&nbsp;&nbsp;&nbsp;&nbsp;b. **Transfers (`transfers`)**: Merges by transfer ID; state machine progression dominates (`Received` > `Sent`; terminal states immutable).<br>&nbsp;&nbsp;&nbsp;&nbsp;c. **Role PINs (`rolePins`)**: Merges PIN maps preserving newest owner modification timestamp.<br>&nbsp;&nbsp;&nbsp;&nbsp;d. **Audits (`audits`)**: Union of audit records by immutable UUID.<br>5. Engine writes merged canonical state to Firestore in atomic batch.<br>6. Engine updates local storage with resolved canonical state.<br>7. Engine clears processed entries from pending write queue.<br>8. Engine updates sync status pill to "Synced / متزامن" (أخضر).<br>9. Engine notifies UI reactive listeners to refresh dashboard views. |
| **Extensions (Alternative & Error Flows)** | **5a. Network drops mid-batch write:**<br>&nbsp;&nbsp;1. Firestore SDK retains transaction in internal offline buffer.<br>&nbsp;&nbsp;2. Sync pill transitions to "Pending / معلق" (أصفر).<br>&nbsp;&nbsp;3. Sync engine reschedules retry with exponential backoff (`NFR-14`). |
| **Postconditions** | **Success**: Local and cloud databases unified without data loss; pending queue drained.<br>**Failure**: Local pending queue preserved; application remains operational offline. |
| **Traceability** | **FR-19**, **FR-20** \| **NFR-03**, **NFR-14** \| `src/data/firebaseInventorySync.ts#L420-L510` |

---

## 6. Verification & Traceability Summary

All 59 Use Cases mapped across Deliverable 1 (`01-requirements.md`), Deliverable 2 (`02-use-case-diagram.md`), and Deliverable 3 (`03-use-case-scenarios.md`) are grounded in the active codebase:

```
[Deliverable 1: 52 FRs + 25 NFRs]
              │
              ▼
[Deliverable 2: 59 UCs in 3 Domain Diagrams]
              │
              ▼
[Deliverable 3: 59 UCs Documented — 14 Fully Dressed Core Scenarios]
              │
              ▼
[Grounded Source Modules]
 ├── src/App.tsx (Keypad, Undo, Shift, Audit, Products)
 ├── src/features/bleScale.ts (GATT Scale Driver)
 ├── src/features/speechRecognition.ts (Arabic Voice Parser)
 ├── src/features/compositeInventory.ts (Recipe Auto-Deduct)
 ├── src/features/pdfDelivery.ts (Canvas PDF & WhatsApp)
 ├── src/features/productImport.ts (Excel & Levenshtein Matching)
 ├── src/data/inventoryDataService.ts (Transfers, Audits, Backups)
 └── src/data/firebaseInventorySync.ts (Presence & Conflict Merge)
```
