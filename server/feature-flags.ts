import { storage } from "./storage";

export interface FeatureFlags {
  emails: boolean;
  affiliates: boolean;
  aiImage: boolean;
  packingSlip: boolean;
  reconstitutionGuide: boolean;
}

export const FAIL_CLOSED_FLAGS: FeatureFlags = {
  emails: false,
  affiliates: false,
  aiImage: false,
  packingSlip: false,
  reconstitutionGuide: false,
};

export async function computeFeatureFlags(): Promise<FeatureFlags> {
  const [emails, affiliates, aiImage, packingSlip, reconstitutionGuide] = await Promise.all([
    storage.getSetting("feature_emails_enabled"),
    storage.getSetting("feature_affiliates_enabled"),
    storage.getSetting("feature_ai_image_enabled"),
    storage.getSetting("feature_packing_slip_enabled"),
    storage.getSetting("feature_reconstitution_guide_enabled"),
  ]);
  return {
    emails: emails !== "false",
    affiliates: affiliates !== "false",
    aiImage: aiImage !== "false",
    packingSlip: packingSlip !== "false",
    reconstitutionGuide: reconstitutionGuide !== "false",
  };
}

export async function injectFeatureFlags(html: string): Promise<string> {
  let flags: FeatureFlags;
  try {
    flags = await computeFeatureFlags();
  } catch {
    flags = FAIL_CLOSED_FLAGS;
  }
  const tag = `<script>window.__FEATURE_FLAGS__=${JSON.stringify(flags)};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${tag}</head>`);
  }
  return tag + html;
}
