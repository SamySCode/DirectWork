import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { DealSheet } from "./api";
import { shortDate, termLines } from "./logic";

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");

// Defence in depth: everything user-written is escaped above, and the page
// itself may not run scripts or load anything, so a future escaping slip
// still can't execute in the print window (which shares our web origin).
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`;

export type DealParties = { projectTitle: string; ownerName: string; memberName: string };

/** A dated, printable copy of the Deal Sheet. */
export function dealSheetHtml(sheet: DealSheet, parties: DealParties, printedOn = new Date()) {
  const status = sheet.agreed_at
    ? `Agreed by both parties on ${shortDate(sheet.agreed_at)}`
    : "Not yet agreed by both parties";
  const rows = termLines(sheet)
    .map((line) => `<tr><th>${escape(line.label)}</th><td>${escape(line.value)}</td></tr>`)
    .join("");
  const business = (yes: boolean) => (yes ? "Yes" : "No");
  return `<!doctype html><html><head><meta charset="utf-8">${CSP}<title>Deal Sheet - ${escape(parties.projectTitle)}</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16133D;margin:32px;font-size:12pt;line-height:1.45}
h1{font-size:20pt;margin:0 0 4px}p{margin:4px 0}.muted{color:#4E4A72}
table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #E3E1F0;padding:8px;text-align:left;vertical-align:top}
th{width:30%;background:#F5F4FC}.foot{margin-top:24px;font-size:10pt;color:#4E4A72}
</style></head><body>
<h1>Deal Sheet: ${escape(parties.projectTitle)}</h1>
<p>Between ${escape(parties.ownerName)} (owner) and ${escape(parties.memberName)} (professional)</p>
<p class="muted">Version ${sheet.version} · ${escape(status)} · printed ${escape(shortDate(printedOn.toISOString()))}</p>
<table>${rows}
<tr><th>Owner acting in the course of business</th><td>${business(sheet.owner_business)}</td></tr>
<tr><th>Professional acting in the course of business</th><td>${business(sheet.member_business)}</td></tr>
</table>
<p class="foot">Recorded on DirectWork. DirectWork is not a party to this agreement, did not draft its terms and does not give legal advice. Payment outcomes reported on agreed Deal Sheets are shown to signed-in DirectWork users, with dispute rights.</p>
</body></html>`;
}

/**
 * Native: render a PDF and open the share sheet (save to Files, mail it...).
 * Web: open a print view and use the browser's print dialog, where "Save as
 * PDF" is one of the destinations.
 */
export async function saveDealSheetPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === "web") {
    const view = window.open("", "_blank");
    if (!view) {
      window.print();
      return;
    }
    view.document.write(html);
    view.document.close();
    view.focus();
    view.print();
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: title,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ uri });
  }
}
