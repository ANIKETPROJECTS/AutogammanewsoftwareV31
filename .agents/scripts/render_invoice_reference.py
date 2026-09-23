from pathlib import Path
import fitz

source = Path("attached_assets/invoice_message_1790159442776.pdf")
output_dir = Path(".agents/outputs/invoice_reference")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")
for index, page in enumerate(document):
    image = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    output = output_dir / f"page-{index + 1}.png"
    image.save(output)
    print(output)