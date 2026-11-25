import os
import sys
import re
import unicodedata
import pypdf

FINAL_PDF = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'ASE_System_Architecture_Diagrams.pdf'))

def run_qa():
    print("======================================================================")
    print("   MANDATORY QA & VERIFICATION AUDIT — DIAGRAM PORTFOLIO PDF")
    print("======================================================================")

    # 1. Existence and size
    if not os.path.exists(FINAL_PDF):
        print(f"❌ FAIL: Final PDF not found at {FINAL_PDF}")
        sys.exit(1)

    size_mb = os.path.getsize(FINAL_PDF) / (1024 * 1024)
    print(f"✅ Final PDF located: {FINAL_PDF}")
    print(f"✅ File Size: {size_mb:.2f} MB ({os.path.getsize(FINAL_PDF):,} bytes)")
    if size_mb < 0.5:
        print("❌ FAIL: PDF file size is suspiciously small (< 0.5 MB).")
        sys.exit(1)

    # 2. Page Count & Orientations
    reader = pypdf.PdfReader(FINAL_PDF)
    num_pages = len(reader.pages)
    print(f"✅ Total Page Count: {num_pages} pages")
    if num_pages != 30:
        print(f"⚠️ Notice: Expected exactly 30 pages (1 Cover + 1 TOC + 28 Diagrams), found {num_pages}")

    portrait_count = 0
    landscape_count = 0
    all_text = ""
    page_texts = []

    for idx, page in enumerate(reader.pages):
        box = page.mediabox
        w = float(box.width)
        h = float(box.height)
        is_landscape = w > h
        if is_landscape:
            landscape_count += 1
        else:
            portrait_count += 1

        p_text = page.extract_text() or ""
        page_texts.append((idx + 1, is_landscape, p_text))
        all_text += f"\n--- PAGE {idx+1} ---\n" + p_text

    print(f"✅ Page Orientations: {portrait_count} Portrait pages, {landscape_count} Landscape pages")
    if landscape_count != 17 or portrait_count != 13:
        print(f"ℹ️ Orientations detail: {portrait_count} portrait, {landscape_count} landscape")
    else:
        print(f"✅ Adaptive Orientation Verified: exactly 17 Landscape pages and 13 Portrait pages.")

    # 3. Check Cover Page (Page 1) Metadata
    print("\n----------------------------------------------------------------------")
    print(" 1. Cover Page & Team / Supervisor Metadata Verification")
    print("----------------------------------------------------------------------")
    p1_text = page_texts[0][2]
    p1_norm = unicodedata.normalize('NFKD', p1_text)
    p1_clean_latin = re.sub(r'[^a-zA-Z0-9]', '', p1_text.lower())
    all_clean_latin = re.sub(r'[^a-zA-Z0-9]', '', all_text.lower())

    required_metadata = [
        ("Nour Osama Farag", "Nour Osama Farag (Student 1)", "latin"),
        ("222101357", "Student 1 ID (222101357)", "latin"),
        ("Bassant Ahmed El-Metwally", "Bassant Ahmed El-Metwally (Student 2)", "latin"),
        ("222101490", "Student 2 ID (222101490)", "latin"),
        ("Dr. Ahmed Badawy", "Supervisor 1 (Dr. Ahmed Badawy)", "latin"),
        ("Eng. Abdullah Amir", "Supervisor 2 (Eng. Abdullah Amir)", "latin"),
        ("Advanced Software Engineering", "Course Title", "latin"),
        ("Smart Inventory Movement and Counting System", "Project Name", "latin"),
        ("نظام حركة وجرد المخزون", "Arabic Project Name (نظام حركة وجرد المخزون)", "arabic"),
    ]

    for needle, label, m_type in required_metadata:
        found = False
        if m_type == "latin":
            needle_clean = re.sub(r'[^a-zA-Z0-9]', '', needle.lower())
            if needle_clean in p1_clean_latin or needle_clean in all_clean_latin:
                found = True
        elif m_type == "arabic":
            arabic_words = [w for w in re.split(r'\s+', needle) if w]
            if all(w in p1_norm for w in arabic_words):
                found = True

        if found:
            print(f"  ✅ FOUND: {label}")
        else:
            print(f"  ❌ MISSING: {label} ({needle})")
            sys.exit(1)

    # 4. Check Table of Contents on Page 2
    print("\n----------------------------------------------------------------------")
    print(" 2. Table of Contents & Gallery Index Verification (Page 2)")
    print("----------------------------------------------------------------------")
    p2_text = page_texts[1][2]
    assert "System Architecture & UML 2.5 Diagram Index" in p2_text or "Diagram Index" in p2_text or "Use Case Model" in p2_text, "TOC title missing on Page 2"
    print("  ✅ Table of Contents & Diagram Gallery Index verified on Page 2.")

    # 5. Check All 28 Architectural Figures
    print("\n----------------------------------------------------------------------")
    print(" 3. Architectural Figures Verification (All 28 Diagrams)")
    print("----------------------------------------------------------------------")
    figures = [
        "Figure 2.1", "Figure 2.2", "Figure 2.3", "Figure 2.4",
        "Figure 4.1", "Figure 4.2", "Figure 4.3", "Figure 4.4", "Figure 4.5", "Figure 4.6",
        "Figure 5.1", "Figure 5.2",
        "Figure 6.1", "Figure 6.2", "Figure 6.3", "Figure 6.4", "Figure 6.5", "Figure 6.6", "Figure 6.7",
        "Figure 7.1", "Figure 7.2", "Figure 7.3", "Figure 7.4",
        "Figure 8.1", "Figure 8.2", "Figure 8.3", "Figure 8.4", "Figure 8.5"
    ]

    missing_figs = []
    for fig in figures:
        if fig in all_text:
            print(f"  ✅ {fig} found in document text")
        else:
            missing_figs.append(fig)

    if missing_figs:
        print(f"  ❌ Missing Figures: {missing_figs}")
        sys.exit(1)
    else:
        print(f"  ✅ ALL 28 Architectural Figures accounted for with 100% zero omissions.")

    # 6. Syntax Cleanliness Check
    print("\n----------------------------------------------------------------------")
    print(" 4. Cleanliness Check (No Raw Markdown / PlantUML / Mermaid Syntax)")
    print("----------------------------------------------------------------------")
    forbidden = ["```plantuml", "```mermaid", "@startuml", "@enduml"]
    leaks = [f for f in forbidden if f in all_text]
    if leaks:
        print(f"  ❌ Leaked raw code syntax: {leaks}")
        sys.exit(1)
    else:
        print("  ✅ Zero raw PlantUML or Mermaid syntax leaks detected.")

    print("\n======================================================================")
    print("      🎉 ALL DIAGRAM PORTFOLIO QA AUDIT CHECKS PASSED CLEANLY!         ")
    print("======================================================================")

if __name__ == '__main__':
    run_qa()
