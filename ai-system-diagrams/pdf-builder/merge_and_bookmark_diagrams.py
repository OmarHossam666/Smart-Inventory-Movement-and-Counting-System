import os
import sys
import pypdf

def merge_and_bookmark(cover_pdf_path, body_pdf_path, output_pdf_path):
    print(f"Merging {cover_pdf_path} (Page 1) and {body_pdf_path} (Pages 2..N) -> {output_pdf_path}")
    
    if not os.path.exists(cover_pdf_path):
        print(f"Error: Cover PDF not found: {cover_pdf_path}")
        sys.exit(1)
    if not os.path.exists(body_pdf_path):
        print(f"Error: Body PDF not found: {body_pdf_path}")
        sys.exit(1)

    cover_reader = pypdf.PdfReader(cover_pdf_path)
    body_reader = pypdf.PdfReader(body_pdf_path)
    writer = pypdf.PdfWriter()

    # Add cover page (Page 1)
    writer.add_page(cover_reader.pages[0])

    # Add body pages (Pages 2..N)
    for p in body_reader.pages:
        writer.add_page(p)

    total_pages = len(writer.pages)
    print(f"Total merged pages: {total_pages}")

    # Add Bookmarks Outline
    # Page indices are 0-based
    writer.add_outline_item("Cover Page", 0)
    writer.add_outline_item("Table of Contents & Diagram Gallery Index", 1)

    # Category 1: Use Case Model
    cat1 = writer.add_outline_item("01. Use Case Model (UML 2.5)", 2)
    writer.add_outline_item("Figure 2.1 — Part 1: Inventory Counting & Stock Management", 2, parent=cat1)
    writer.add_outline_item("Figure 2.2 — Part 2: Inter-Location Transfers, Audits & Reporting", 3, parent=cat1)
    writer.add_outline_item("Figure 2.3 — Part 3: Owner Administration & System Sync", 4, parent=cat1)
    writer.add_outline_item("Figure 2.4 — System Use Case Architecture Overview", 5, parent=cat1)

    # Category 2: Activity Workflows
    cat2 = writer.add_outline_item("02. Activity & Workflow Workflows (UML 2.5)", 6)
    writer.add_outline_item("Figure 4.1 — Workflow 1: Inventory Counting & Multi-Modal Input", 6, parent=cat2)
    writer.add_outline_item("Figure 4.2 — Workflow 2: Inter-Location Transfer Lifecycle", 7, parent=cat2)
    writer.add_outline_item("Figure 4.3 — Workflow 3: Composite Item Counting & Recipe Auto-Deductions", 8, parent=cat2)
    writer.add_outline_item("Figure 4.4 — Workflow 4: Comprehensive Audit Finalization & Canvas PDF", 9, parent=cat2)
    writer.add_outline_item("Figure 4.5 — Workflow 5: Offline Cloud Synchronization & Conflict Merge", 10, parent=cat2)
    writer.add_outline_item("Figure 4.6 — Operational Flowchart Overview Companion", 11, parent=cat2)

    # Category 3: Class Architecture
    cat3 = writer.add_outline_item("03. Structural Class Architecture (UML 2.5)", 12)
    writer.add_outline_item("Figure 5.1 — UML 2. Domain Class Diagram (6-Package Architecture)", 12, parent=cat3)
    writer.add_outline_item("Figure 5.2 — Structural Architecture: Domain & Package Overview", 13, parent=cat3)

    # Category 4: Sequence Interaction Flows
    cat4 = writer.add_outline_item("04. Runtime Interaction Sequences (UML 2.5)", 14)
    writer.add_outline_item("Figure 6.1 — Sequence Flow 1: BLE Scale Pairing & Live Weight Streaming", 14, parent=cat4)
    writer.add_outline_item("Figure 6.2 — Sequence Flow 2: Arabic Voice Recognition & Phonetic Parsing", 15, parent=cat4)
    writer.add_outline_item("Figure 6.3 — Sequence Flow 3: Transfer Lifecycle & Discrepancy Reconciliation", 16, parent=cat4)
    writer.add_outline_item("Figure 6.4 — Sequence Flow 4: Composite Dish Counting & Recipe Deductions", 17, parent=cat4)
    writer.add_outline_item("Figure 6.5 — Sequence Flow 5: Audit Finalization, Canvas PDF & WhatsApp Export", 18, parent=cat4)
    writer.add_outline_item("Figure 6.6 — Sequence Flow 6: Offline Cloud Synchronization & Conflict Resolution", 19, parent=cat4)
    writer.add_outline_item("Figure 6.7 — System Interaction Loop Runtime Overview Companion", 20, parent=cat4)

    # Category 5: Kruchten 4+1 Views
    cat5 = writer.add_outline_item("05. Kruchten 4+1 Architecture Views", 21)
    writer.add_outline_item("Figure 7.1 — Logical Subsystem Architecture (5 Layers)", 21, parent=cat5)
    writer.add_outline_item("Figure 7.2 — Physical Runtime Architecture (Processes & Threads)", 22, parent=cat5)
    writer.add_outline_item("Figure 7.3 — Deployment Architecture & Network Topology", 23, parent=cat5)
    writer.add_outline_item("Figure 7.4 — Cloud Edge & Network Gateway Overview Companion", 24, parent=cat5)

    # Category 6: State Machine Lifecycles
    cat6 = writer.add_outline_item("06. State Machine Lifecycles (UML 2.5)", 25)
    writer.add_outline_item("Figure 8.1 — Lifecycle 1: Transfer Entity (TransferStatus)", 25, parent=cat6)
    writer.add_outline_item("Figure 8.2 — Lifecycle 2: Work Shift & Audit Session", 26, parent=cat6)
    writer.add_outline_item("Figure 8.3 — Lifecycle 3: BLE Scale Connection & GATT Measurement", 27, parent=cat6)
    writer.add_outline_item("Figure 8.4 — Lifecycle 4: Cloud Synchronization & Conflict Engine", 28, parent=cat6)
    writer.add_outline_item("Figure 8.5 — Unified Entity Lifecycles Dynamics Overview", 29, parent=cat6)

    with open(output_pdf_path, "wb") as f_out:
        writer.write(f_out)

    print(f"Successfully generated merged and bookmarked PDF at {output_pdf_path}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python merge_and_bookmark_diagrams.py <cover.pdf> <body.pdf> <output.pdf>")
        sys.exit(1)
    merge_and_bookmark(sys.argv[1], sys.argv[2], sys.argv[3])
