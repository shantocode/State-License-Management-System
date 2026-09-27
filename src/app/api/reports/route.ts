import { currentUser, ipAddress } from "@/lib/auth";
import { reportData, reportTypes, type ReportType } from "@/lib/report-data";
import { excelReport, pdfReport } from "@/lib/export";
import { audit } from "@/lib/service";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || user.mustChangePassword)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  if (user.role.code !== "ADMIN")
    return Response.json(
      { error: "Administrator access required" },
      { status: 403 },
    );
  const p = new URL(request.url).searchParams,
    type = p.get("type") as ReportType,
    format = p.get("format");
  if (!reportTypes.includes(type) || !["pdf", "xlsx"].includes(format || ""))
    return Response.json(
      { error: "Invalid report type or format" },
      { status: 400 },
    );
  try {
    const report = await reportData(type, p.get("from"), p.get("to"));
    const bytes =
      format === "xlsx" ? await excelReport(report) : await pdfReport(report);
    await audit(db, user, "REPORT_EXPORTED", type, await ipAddress(), {
      format,
      records: report.rows.length,
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="slms-${type}-${new Date().toISOString().slice(0, 10)}.${format}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const expected =
      message.startsWith("More than") || message.startsWith("Select a valid");
    return Response.json(
      {
        error: expected
          ? message
          : "Report generation failed. Please try a smaller date range.",
      },
      { status: expected ? 400 : 500 },
    );
  }
}
