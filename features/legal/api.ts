import { Platform, Share } from "react-native";
import { supabase } from "../../lib/supabase";
import { PRIVACY_VERSION, TERMS_VERSION, type LegalStatus } from "./versions";

/** Latest Terms/Privacy versions the signed-in person accepted (nulls if none). */
export async function getMyLegalStatus(): Promise<LegalStatus> {
  const { data, error } = await supabase.rpc("get_my_legal_status");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Partial<LegalStatus> | null | undefined;
  return {
    terms_version: row?.terms_version ?? null,
    privacy_version: row?.privacy_version ?? null,
  };
}

/** Records acceptance of the current Terms and Privacy Notice (and the 18+ confirmation). */
export async function recordLegalAcceptance() {
  const { error } = await supabase.rpc("record_legal_acceptance", {
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error) throw error;
}

/** Everything DirectWork holds about the caller, as JSON (UK GDPR access/portability). */
export async function exportMyData(): Promise<unknown> {
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) throw error;
  return data;
}

export function exportFileName(now = new Date()) {
  return `directwork-data-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Hands the export to the person: a file download on web, the share sheet
 * on iOS/Android (save to Files, email it to yourself, etc.). The export
 * holds file paths, not the images themselves, so it stays small.
 */
export async function saveExport(data: unknown) {
  const text = JSON.stringify(data, null, 2);
  const fileName = exportFileName();
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }
  await Share.share({ title: fileName, message: text });
}
