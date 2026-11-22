import sys
import json
import re
import pypdf

def find_pages(pdf_path, target_entries):
    reader = pypdf.PdfReader(pdf_path)
    num_pages = len(reader.pages)
    print(f"Total pages in {pdf_path}: {num_pages}")
    
    # Extract text from each page
    page_texts = []
    for idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        page_texts.append(text)
    
    # Identify how many pages TOC takes: search for where Deliverable 1 starts
    toc_end_page = 3  # default start after page 3
    for p_idx, text in enumerate(page_texts):
        if "Deliverable 01 • ASE Architecture" in text or "Deliverable 1 — Requirement" in text:
            # First occurrence outside TOC
            if p_idx >= 2:
                toc_end_page = p_idx
                break
    print(f"Detected TOC ends before page {toc_end_page + 1}")

    results = {}
    for entry in target_entries:
        anchor_id = entry['id']
        search_terms = entry['search']
        found_page = None
        
        # Start searching after TOC for document content
        start_idx = 2 if anchor_id == 'system-snapshot' else toc_end_page
        
        # Search page by page from start_idx
        for p_idx in range(start_idx, num_pages):
            text = page_texts[p_idx]
            match = True
            for term in search_terms:
                if term.lower() not in text.lower():
                    match = False
                    break
            if match:
                found_page = p_idx + 1  # 1-indexed
                break
        
        if found_page is None:
            # Fallback to any of the search terms
            for p_idx in range(start_idx, num_pages):
                text = page_texts[p_idx]
                for term in search_terms:
                    if term.lower() in text.lower():
                        found_page = p_idx + 1
                        break
                if found_page:
                    break
                    
        results[anchor_id] = found_page or (toc_end_page + 1)
        print(f"  {anchor_id:20} -> Page {results[anchor_id]} (Search: {search_terms[0]})")
        
    return results

if __name__ == '__main__':
    pdf_file = sys.argv[1]
    entries_file = sys.argv[2]
    out_file = sys.argv[3]
    
    with open(entries_file, 'r', encoding='utf-8') as f:
        targets = json.load(f)
        
    page_map = find_pages(pdf_file, targets)
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(page_map, f, indent=2)
    print(f"Successfully saved {len(page_map)} page mappings to {out_file}")
