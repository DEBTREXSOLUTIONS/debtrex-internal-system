"""Build a single PDF from all markdown docs in this folder.

Run from inside the docs/ folder (or anywhere — paths are derived from __file__):
    python _build_pdf.py

Produces: DEBTREX-Documentation.pdf
"""
from __future__ import annotations

import os
import re
import html as html_lib
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Preformatted,
)

DOCS_DIR = Path(__file__).resolve().parent
OUT_PDF = DOCS_DIR / "DEBTREX-Documentation.pdf"

# ─── Order docs the same way README routes new readers ───
DOC_ORDER = [
    ("README.md",                 "Documentation Index"),
    ("EDITING-GUIDE.md",          "The Editing Guide"),
    ("feature-walkthroughs.md",   "Feature Walkthroughs"),
    ("recipes.md",                "Recipes — Copy-Paste Templates"),
    ("file-index.md",             "File Index"),
    ("HOW-I-BUILT-task-requests.md", "How I Built: Task Requests"),
    ("architecture.md",           "Architecture"),
    ("data-model.md",             "Data Model"),
    ("auth-and-permissions.md",   "Auth & Permissions"),
    ("api-reference.md",          "API Reference"),
    ("ui-and-styling.md",         "UI & Styling"),
    ("dev-workflow.md",           "Developer Workflow"),
    ("performance.md",            "Performance Notes"),
    ("troubleshooting.md",        "Troubleshooting"),
]

BRAND_RED = colors.HexColor("#E02020")
BRAND_RED_DARK = colors.HexColor("#B81414")
INK = colors.HexColor("#111111")
GRAY = colors.HexColor("#666666")
GRAY_LIGHT = colors.HexColor("#E5E5E5")
GRAY_BG = colors.HexColor("#F5F5F5")
CODE_BG = colors.HexColor("#F4F4F4")
CODE_BORDER = colors.HexColor("#DDDDDD")

# ─── Styles ───
styles = getSampleStyleSheet()

def make_style(name, **kw):
    parent = styles["Normal"]
    return ParagraphStyle(name, parent=parent, **kw)

S_COVER_TITLE = make_style("CoverTitle",
    fontName="Helvetica-Bold", fontSize=42, leading=46, textColor=INK,
    alignment=TA_LEFT, spaceAfter=8)
S_COVER_SUB = make_style("CoverSub",
    fontName="Helvetica", fontSize=14, leading=18, textColor=GRAY,
    spaceAfter=6)
S_COVER_BRAND = make_style("CoverBrand",
    fontName="Helvetica-Bold", fontSize=28, leading=32, textColor=BRAND_RED,
    alignment=TA_LEFT, spaceAfter=10)

S_H1 = make_style("H1",
    fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=INK,
    spaceBefore=24, spaceAfter=10, keepWithNext=1)
S_H2 = make_style("H2",
    fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=INK,
    spaceBefore=18, spaceAfter=6, keepWithNext=1)
S_H3 = make_style("H3",
    fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=BRAND_RED_DARK,
    spaceBefore=14, spaceAfter=4, keepWithNext=1)
S_H4 = make_style("H4",
    fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=INK,
    spaceBefore=10, spaceAfter=3, keepWithNext=1)

S_BODY = make_style("Body",
    fontName="Helvetica", fontSize=10, leading=14, textColor=INK,
    spaceAfter=6)
S_LIST = make_style("List",
    fontName="Helvetica", fontSize=10, leading=14, textColor=INK,
    leftIndent=18, bulletIndent=6, spaceAfter=3)
S_QUOTE = make_style("Quote",
    fontName="Helvetica-Oblique", fontSize=10, leading=14, textColor=GRAY,
    leftIndent=14, borderColor=BRAND_RED, borderWidth=0,
    spaceAfter=8)
S_CODE = ParagraphStyle("Code",
    fontName="Courier", fontSize=8.5, leading=11, textColor=INK,
    backColor=CODE_BG, borderColor=CODE_BORDER, borderWidth=0.5,
    borderPadding=6, leftIndent=0, rightIndent=0,
    spaceBefore=4, spaceAfter=8)
S_TOC_DOC = make_style("TocDoc",
    fontName="Helvetica-Bold", fontSize=11, leading=16, textColor=INK,
    spaceAfter=2)
S_TOC_PAGE = make_style("TocPage",
    fontName="Helvetica", fontSize=11, leading=16, textColor=GRAY)

S_SECTION_LABEL = make_style("SectionLabel",
    fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=BRAND_RED,
    spaceAfter=4)


# ─── Inline markdown → reportlab mini-HTML ───
# reportlab Paragraph understands a subset of HTML: <b>, <i>, <u>, <font>, <a>, <br/>
_INLINE_CODE_RE = re.compile(r"`([^`]+?)`")
_BOLD_RE = re.compile(r"\*\*([^*]+?)\*\*")
_ITALIC_RE = re.compile(r"(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)")
_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_STRIKE_RE = re.compile(r"~~([^~]+?)~~")

def md_inline_to_rl(text: str) -> str:
    """Convert markdown inline syntax to reportlab Paragraph markup."""
    # Escape XML entities first (so user content can't break parsing)
    text = html_lib.escape(text, quote=False)

    # Markdown processed in a specific order — code first so its contents
    # aren't re-processed for bold/italic.
    placeholders = {}
    def stash_code(m):
        key = f"\x00CODE{len(placeholders)}\x00"
        placeholders[key] = (
            '<font face="Courier" size="9" backColor="#F4F4F4">'
            + m.group(1) + "</font>"
        )
        return key
    text = _INLINE_CODE_RE.sub(stash_code, text)

    text = _BOLD_RE.sub(r"<b>\1</b>", text)
    text = _ITALIC_RE.sub(r"<i>\1</i>", text)
    text = _STRIKE_RE.sub(r"<strike>\1</strike>", text)
    text = _LINK_RE.sub(
        lambda m: f'<font color="#B81414"><u>{m.group(1)}</u></font>', text)

    # Restore code
    for k, v in placeholders.items():
        text = text.replace(k, v)

    return text


# ─── Markdown block parser → reportlab flowables ───
class MdParser:
    def __init__(self, doc_index: int, doc_title: str):
        self.doc_index = doc_index
        self.doc_title = doc_title
        self.flowables = []

    def add(self, f):
        self.flowables.append(f)

    def emit_paragraph(self, lines):
        text = " ".join(lines).strip()
        if not text:
            return
        self.add(Paragraph(md_inline_to_rl(text), S_BODY))

    def parse(self, md: str):
        lines = md.splitlines()
        i = 0
        n = len(lines)

        # Skip leading blank lines
        while i < n and not lines[i].strip():
            i += 1

        while i < n:
            line = lines[i]
            stripped = line.strip()

            # ─── Code fence ───
            if stripped.startswith("```"):
                fence = stripped[:3]
                i += 1
                code_lines = []
                while i < n and not lines[i].strip().startswith(fence):
                    code_lines.append(lines[i])
                    i += 1
                i += 1  # skip closing fence
                code_text = "\n".join(code_lines).rstrip()
                if code_text:
                    # Use Preformatted — preserves whitespace, no XML parsing
                    self.add(Preformatted(code_text, S_CODE))
                continue

            # ─── Horizontal rule ───
            if re.match(r"^\s*(-{3,}|\*{3,}|_{3,})\s*$", line):
                self.add(Spacer(1, 4))
                self.add(Table([[""]], colWidths=[6.5*inch],
                               style=TableStyle([
                                   ("LINEBELOW", (0,0), (-1,-1), 0.5, GRAY_LIGHT),
                               ])))
                self.add(Spacer(1, 6))
                i += 1
                continue

            # ─── Heading ───
            m = re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", line)
            if m:
                level = len(m.group(1))
                heading_text = m.group(2).strip()
                # Strip leading anchor-only number prefixes? We keep them.
                style = {1: S_H1, 2: S_H2, 3: S_H3}.get(level, S_H4)
                self.add(Paragraph(md_inline_to_rl(heading_text), style))
                i += 1
                continue

            # ─── Blockquote ───
            if stripped.startswith(">"):
                quote_lines = []
                while i < n and lines[i].lstrip().startswith(">"):
                    quote_lines.append(re.sub(r"^\s*>\s?", "", lines[i]))
                    i += 1
                qtext = " ".join(l.strip() for l in quote_lines if l.strip())
                if qtext:
                    self.add(Paragraph(md_inline_to_rl(qtext), S_QUOTE))
                continue

            # ─── Table ───
            if "|" in line and i + 1 < n and re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", lines[i+1]):
                rows = []
                # Header
                header = [c.strip() for c in line.strip().strip("|").split("|")]
                rows.append(header)
                i += 2  # skip header + separator
                while i < n and "|" in lines[i] and lines[i].strip():
                    row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                    # Pad / trim to header length
                    while len(row) < len(header): row.append("")
                    row = row[:len(header)]
                    rows.append(row)
                    i += 1
                self._emit_table(rows)
                continue

            # ─── List ───
            if re.match(r"^\s*[-*+]\s+", line) or re.match(r"^\s*\d+\.\s+", line):
                items = []
                while i < n and (re.match(r"^\s*[-*+]\s+", lines[i])
                                 or re.match(r"^\s*\d+\.\s+", lines[i])
                                 or (lines[i].startswith("    ") or lines[i].startswith("\t"))
                                 ) and lines[i].strip():
                    if (re.match(r"^\s*[-*+]\s+", lines[i])
                            or re.match(r"^\s*\d+\.\s+", lines[i])):
                        items.append(lines[i])
                    else:
                        # Continuation — append to last item
                        if items:
                            items[-1] += " " + lines[i].strip()
                    i += 1
                self._emit_list(items)
                continue

            # ─── Blank line ───
            if not stripped:
                i += 1
                continue

            # ─── Paragraph ───
            para_lines = []
            while i < n and lines[i].strip() and not (
                lines[i].startswith("#")
                or lines[i].strip().startswith("```")
                or lines[i].lstrip().startswith(">")
                or re.match(r"^\s*[-*+]\s+", lines[i])
                or re.match(r"^\s*\d+\.\s+", lines[i])
                or ("|" in lines[i] and i + 1 < n and re.match(r"^\s*\|?[\s\-:|]+\|?\s*$", lines[i+1]))
                or re.match(r"^\s*(-{3,}|\*{3,}|_{3,})\s*$", lines[i])
            ):
                para_lines.append(lines[i])
                i += 1
            self.emit_paragraph(para_lines)

    def _emit_list(self, items):
        for raw in items:
            m = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", raw, re.DOTALL)
            if not m:
                continue
            marker, rest = m.group(1), m.group(2)
            bullet = "•" if marker in ("-", "*", "+") else marker
            p = Paragraph(md_inline_to_rl(rest), S_LIST, bulletText=bullet)
            self.add(p)

    def _emit_table(self, rows):
        if not rows:
            return
        # Convert each cell to a Paragraph so long content wraps
        cell_style = ParagraphStyle("TblCell", parent=S_BODY, fontSize=9, leading=12)
        head_style = ParagraphStyle("TblHead", parent=cell_style,
                                    fontName="Helvetica-Bold", textColor=colors.white)
        data = []
        for ri, row in enumerate(rows):
            data.append([
                Paragraph(md_inline_to_rl(c), head_style if ri == 0 else cell_style)
                for c in row
            ])

        ncols = len(rows[0])
        avail = 6.5 * inch
        col_widths = [avail / ncols] * ncols

        t = Table(data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.25, GRAY_LIGHT),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAY_BG]),
        ]))
        self.add(Spacer(1, 4))
        self.add(t)
        self.add(Spacer(1, 8))


# ─── Document template with header / footer / page numbers ───
class DebtrexDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, pagesize=LETTER, leftMargin=0.9*inch,
                         rightMargin=0.9*inch, topMargin=0.9*inch,
                         bottomMargin=0.9*inch, **kw)
        self.current_doc_title = ""
        frame = Frame(self.leftMargin, self.bottomMargin,
                      self.width, self.height, id="normal")
        self.addPageTemplates([PageTemplate(id="all", frames=frame,
                                            onPage=self._draw_chrome)])

    def _draw_chrome(self, canvas, doc):
        canvas.saveState()
        page_num = canvas.getPageNumber()
        if page_num == 1:
            # Cover page — no chrome
            canvas.restoreState()
            return

        w, h = LETTER

        # Header: small brand strip
        canvas.setFillColor(BRAND_RED)
        canvas.rect(0, h - 0.35*inch, w, 0.35*inch, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(0.9*inch, h - 0.22*inch, "DEBTREX  ·  Internal System Documentation")
        if self.current_doc_title:
            canvas.setFont("Helvetica", 9)
            canvas.drawRightString(w - 0.9*inch, h - 0.22*inch, self.current_doc_title)

        # Footer: page number
        canvas.setFillColor(GRAY)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(w - 0.9*inch, 0.45*inch, f"Page {page_num}")
        canvas.drawString(0.9*inch, 0.45*inch, "debtrex-system / docs")
        canvas.setStrokeColor(GRAY_LIGHT)
        canvas.setLineWidth(0.5)
        canvas.line(0.9*inch, 0.65*inch, w - 0.9*inch, 0.65*inch)
        canvas.restoreState()


class _SetDocTitle:
    """Flowable that updates the current doc title shown in the header."""
    def __init__(self, title, doc_template):
        self.title = title
        self.doc_template = doc_template

    def wrap(self, *_): return (0, 0)
    def drawOn(self, *_): pass
    def draw(self): pass
    def __call__(self, canvas, doc):
        self.doc_template.current_doc_title = self.title

# Use a doc-callback flowable
from reportlab.platypus.flowables import Flowable
class SetHeader(Flowable):
    def __init__(self, title, doc_template):
        super().__init__()
        self.title = title
        self.doc_template = doc_template
    def wrap(self, *args): return (0, 0)
    def draw(self):
        self.doc_template.current_doc_title = self.title


# ─── Build the PDF ───
def build():
    doc = DebtrexDocTemplate(str(OUT_PDF), title="DEBTREX Documentation",
                             author="DEBTREX SOLUTIONS")

    story = []

    # ─── COVER PAGE ───
    story.append(Spacer(1, 1.6*inch))
    story.append(Paragraph("DEBTREX", S_COVER_BRAND))
    story.append(Paragraph("Internal System", S_COVER_BRAND))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Developer Documentation", S_COVER_TITLE))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph(
        "A complete guide to editing, extending, and operating the DEBTREX internal "
        "operations platform. Covers architecture, every feature, every API, "
        "every database table, the permission system, and copy-paste recipes for "
        "common changes.", S_COVER_SUB))
    story.append(Spacer(1, 0.4*inch))
    story.append(Paragraph("Built with Next.js 14 · TypeScript · Supabase · Tailwind CSS", S_COVER_SUB))
    story.append(PageBreak())

    # ─── TABLE OF CONTENTS ───
    story.append(SetHeader("Table of Contents", doc))
    story.append(Paragraph("Table of Contents", S_H1))
    toc_data = [
        [Paragraph("<b>#</b>", S_TOC_DOC),
         Paragraph("<b>Document</b>", S_TOC_DOC),
         Paragraph("<b>What it covers</b>", S_TOC_DOC)],
    ]
    blurbs = {
        "README.md":               "The index. Start here if you're new.",
        "EDITING-GUIDE.md":        "The master guide. Mental model + every common edit.",
        "feature-walkthroughs.md": "Every feature: files, tables, permissions, common edits.",
        "recipes.md":              "30 copy-paste templates for common tasks.",
        "file-index.md":           "Every file in the project mapped to its purpose.",
        "HOW-I-BUILT-task-requests.md": "Step-by-step record of building the task-requests feature.",
        "architecture.md":         "High-level shape of the system.",
        "data-model.md":           "Every database table and how they relate.",
        "auth-and-permissions.md": "Login flow, role system, the permission key matrix.",
        "api-reference.md":        "Every API route at a glance.",
        "ui-and-styling.md":       "Tailwind setup, brand classes, UI patterns.",
        "dev-workflow.md":         "Running locally, env vars, common tasks.",
        "performance.md":          "What was slow, what was fixed, where to look next.",
        "troubleshooting.md":      "Every error → cause → fix.",
    }
    for idx, (fn, title) in enumerate(DOC_ORDER, start=1):
        toc_data.append([
            Paragraph(str(idx), S_TOC_PAGE),
            Paragraph(f"<b>{title}</b><br/><font size='9' color='#777777'>{fn}</font>", S_TOC_DOC),
            Paragraph(blurbs.get(fn, ""), S_TOC_PAGE),
        ])
    toc = Table(toc_data, colWidths=[0.4*inch, 2.5*inch, 3.6*inch])
    toc.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("LINEBELOW", (0,0), (-1,0), 1, INK),
        ("LINEBELOW", (0,1), (-1,-1), 0.25, GRAY_LIGHT),
    ]))
    story.append(toc)
    story.append(PageBreak())

    # ─── EACH DOC ───
    for idx, (filename, display_title) in enumerate(DOC_ORDER, start=1):
        path = DOCS_DIR / filename
        if not path.exists():
            print(f"  ! skipping (missing): {filename}")
            continue

        # Section divider page
        story.append(SetHeader(display_title, doc))
        story.append(Spacer(1, 2.0*inch))
        story.append(Paragraph(f"PART {idx}", S_SECTION_LABEL))
        story.append(Paragraph(display_title, S_COVER_TITLE))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph(
            f'<font color="#999999"><i>Source: docs/{filename}</i></font>', S_BODY))
        story.append(PageBreak())

        # Content
        md = path.read_text(encoding="utf-8")
        parser = MdParser(idx, display_title)
        parser.parse(md)
        story.extend(parser.flowables)
        story.append(PageBreak())

    print(f"Building {OUT_PDF.name} from {len([f for f,_ in DOC_ORDER if (DOCS_DIR/f).exists()])} files…")
    doc.build(story)
    size_kb = OUT_PDF.stat().st_size / 1024
    print(f"Done. {OUT_PDF} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    build()
