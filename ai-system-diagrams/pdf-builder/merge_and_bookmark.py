import sys
import json
import pypdf

def merge_and_bookmark(cover_pdf, body_pdf, out_pdf, outline_data_path):
    cover_reader = pypdf.PdfReader(cover_pdf)
    body_reader = pypdf.PdfReader(body_pdf)
    writer = pypdf.PdfWriter()

    print(f"Cover pages: {len(cover_reader.pages)}, Body pages: {len(body_reader.pages)}")

    # Add page 1 from cover (clean, no running headers/footers)
    writer.add_page(cover_reader.pages[0])

    # Add pages 2..end from body (with running headers & footers)
    for p_idx in range(1, len(body_reader.pages)):
        writer.add_page(body_reader.pages[p_idx])

    # Now add bookmarks outline
    try:
        with open(outline_data_path, 'r', encoding='utf-8') as f:
            outline_tree = json.load(f)

        for item in outline_tree:
            page_num = max(0, min(len(writer.pages) - 1, item.get('page', 1) - 1))
            parent = writer.add_outline_item(item['title'], page_num)
            for child in item.get('children', []):
                child_page = max(0, min(len(writer.pages) - 1, child.get('page', 1) - 1))
                writer.add_outline_item(child['title'], child_page, parent=parent)
        print("Successfully added PDF outline bookmarks.")
    except Exception as e:
        print(f"Notice: Outline generation note: {e}")

    with open(out_pdf, 'wb') as f:
        writer.write(f)

    final_reader = pypdf.PdfReader(out_pdf)
    print(f"Merged PDF successfully created at {out_pdf} with {len(final_reader.pages)} pages.")

if __name__ == '__main__':
    cover = sys.argv[1]
    body = sys.argv[2]
    out = sys.argv[3]
    outline = sys.argv[4]
    merge_and_bookmark(cover, body, out, outline)
