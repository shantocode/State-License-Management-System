import "regenerator-runtime/runtime";
import ExcelJS from "exceljs";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
export type Report = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
};
export async function excelReport(report: Report) {
  const book = new ExcelJS.Workbook();
  book.creator = "SLMS";
  book.created = new Date();
  const sheet = book.addWorksheet(report.title.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = report.headers.map((header, i) => ({
    header,
    key: String(i),
    width: i === 0 ? 24 : 22,
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF173F6C" },
  };
  sheet.getRow(1).height = 26;
  for (const row of report.rows) sheet.addRow(row);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: report.headers.length },
  };
  for (let i = 0; i < report.headers.length; i++)
    if (report.headers[i].includes("($)"))
      sheet.getColumn(i + 1).numFmt = "#,##0.00";
  return new Uint8Array(await book.xlsx.writeBuffer());
}
export async function pdfReport(report: Report) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(report.title);
  doc.setAuthor("State Licensing Management System");
  const fonts = await Promise.all(
    ["NotoSans-Regular.ttf", "NotoSansBengali-Regular.ttf"].map(async (f) =>
      doc.embedFont(
        await readFile(path.join(process.cwd(), "public", "fonts", f)),
        { subset: true },
      ),
    ),
  );
  const fontFor = (text: string) =>
    /[\u0980-\u09ff]/.test(text) ? fonts[1] : fonts[0];
  const runs = (text: string) =>
    text.match(
      /[\u0980-\u09ff\u200c\u200d]+|[^\u0980-\u09ff\u200c\u200d]+/g,
    ) || [""];
  function width(text: string, size: number) {
    return runs(text).reduce(
      (n, t) => n + fontFor(t).widthOfTextAtSize(t, size),
      0,
    );
  }
  function draw(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    size: number,
    color = rgb(0.12, 0.18, 0.26),
  ) {
    for (const run of runs(text)) {
      const font = fontFor(run);
      page.drawText(run, { x, y, size, font, color });
      x += font.widthOfTextAtSize(run, size);
    }
  }
  function wrap(text: string, max: number, size: number) {
    const lines: string[] = [];
    let line = "";
    for (const char of Array.from(text.replace(/[\r\n\t]+/g, " "))) {
      if (width(line + char, size) > max && line) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  const w = 842,
    h = 595,
    margin = 30,
    cell = (w - margin * 2) / report.headers.length,
    size = 8;
  let page!: PDFPage,
    y = 0,
    pageNumber = 0;
  function newPage() {
    page = doc.addPage([w, h]);
    pageNumber++;
    draw(page, report.title, margin, h - 40, 18);
    draw(
      page,
      `SLMS | Generated ${new Date().toISOString().slice(0, 10)} | Page ${pageNumber}`,
      margin,
      h - 58,
      9,
    );
    page.drawRectangle({
      x: margin,
      y: h - 99,
      width: w - margin * 2,
      height: 29,
      color: rgb(0.09, 0.24, 0.4),
    });
    report.headers.forEach((head, i) =>
      wrap(head, cell - 10, size).forEach((t, j) =>
        draw(
          page,
          t,
          margin + i * cell + 5,
          h - 82 - j * 10,
          size,
          rgb(1, 1, 1),
        ),
      ),
    );
    y = h - 111;
  }
  newPage();
  for (const row of report.rows) {
    const wrapped = row.map((v) => wrap(String(v), cell - 10, size)),
      height = Math.max(...wrapped.map((x) => x.length)) * 12 + 12;
    if (y - height < 35) newPage();
    wrapped.forEach((lines, i) =>
      lines.forEach((line, j) =>
        draw(page, line, margin + i * cell + 5, y - j * 12, size),
      ),
    );
    y -= height;
    page.drawLine({
      start: { x: margin, y: y + 7 },
      end: { x: w - margin, y: y + 7 },
      thickness: 0.4,
      color: rgb(0.85, 0.88, 0.91),
    });
  }
  if (!report.rows.length)
    draw(page!, "No records in this period.", margin, y, 11);
  return doc.save();
}
