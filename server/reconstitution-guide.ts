import PDFDocument from "pdfkit";
import path from "path";
import type { Request, Response } from "express";

const NAVY     = "#201C16";
const CLOUD    = "#E9E2D5";
const SMOKE    = "#D3D6E0";
const STEEL    = "#BCBFCC";
const GRAPH    = "#6B6258";
const ARSENIC  = "#3A332B";
const PHANTOM  = "#1E1E24";
const WHITE    = "#FFFFFF";
const W = 612;
const H = 792;
const MARGIN = 40;
const INNER = W - MARGIN * 2;

function section(doc: InstanceType<typeof PDFDocument>, label: string, x: number, y: number, w: number): number {
  doc.rect(x, y, w, 18).fill(NAVY);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE)
    .text(label, x + 10, y + 5, { width: w - 20, characterSpacing: 1.2 });
  return y + 18;
}

function bullet(doc: InstanceType<typeof PDFDocument>, num: string | null, text: string, x: number, y: number, w: number): number {
  const BULLET_W = num ? 16 : 10;
  const TEXT_X = x + BULLET_W + 4;
  const TEXT_W = w - BULLET_W - 4;
  if (num) {
    doc.circle(x + 8, y + 5.5, 6).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(WHITE)
      .text(num, x, y + 1.5, { width: 16, align: "center" });
  } else {
    doc.circle(x + 4, y + 5, 3).fill(STEEL);
  }
  doc.font("Helvetica").fontSize(8).fillColor(ARSENIC)
    .text(text, TEXT_X, y, { width: TEXT_W, lineGap: 1 });
  const h = doc.heightOfString(text, { width: TEXT_W, lineGap: 1 });
  return y + Math.max(h + 6, 16);
}

function checkItem(doc: InstanceType<typeof PDFDocument>, text: string, x: number, y: number, w: number): number {
  doc.rect(x, y + 1, 8, 8).lineWidth(0.75).strokeColor(STEEL).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(ARSENIC)
    .text(text, x + 13, y, { width: w - 13, lineGap: 1 });
  const h = doc.heightOfString(text, { width: w - 13, lineGap: 1 });
  return y + Math.max(h + 5, 14);
}

export async function reconstitutionGuideHandler(_req: Request, res: Response) {
  try {
    const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="aura-peptides-reconstitution-guide.pdf"`);
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.end(Buffer.concat(chunks));
    });

    const logoPath = path.join(process.cwd(), "public", "images", "logo-mark.png");

    // ── Full-width navy header band ───────────────────────────────────────────
    const HDR_H = 72;
    doc.rect(0, 0, W, HDR_H).fill(NAVY);

    // Logo
    try { doc.image(logoPath, MARGIN, 14, { height: 42 }); } catch {}

    // Brand name + tagline
    doc.font("Helvetica-Bold").fontSize(13).fillColor(WHITE)
      .text("AURA PEPTIDES", MARGIN + 50, 18);
    doc.font("Helvetica").fontSize(8).fillColor(STEEL)
      .text("Lab-Verified Compounds", MARGIN + 50, 34);

    // Document title (right)
    doc.font("Helvetica-Bold").fontSize(18).fillColor(WHITE)
      .text("RECONSTITUTION GUIDE", 0, 16, { width: W - MARGIN, align: "right" });
    doc.font("Helvetica").fontSize(7.5).fillColor(STEEL)
      .text("Research Preparation Guide  ·  For laboratory use only", 0, 38, { width: W - MARGIN, align: "right" });

    // Navy accent bar under header
    doc.rect(0, HDR_H, W, 4).fill(PHANTOM);

    let y = HDR_H + 16;

    // ── Two-column layout ─────────────────────────────────────────────────────
    const GAP   = 14;
    const COL_W = (INNER - GAP) / 2;
    const L     = MARGIN;          // left column x
    const R     = MARGIN + COL_W + GAP; // right column x

    // ╔══════════════════════════╗  LEFT COLUMN
    // ║ RECONSTITUTION STEPS     ║
    // ╚══════════════════════════╝

    let ly = section(doc, "RECONSTITUTION STEPS", L, y, COL_W);
    ly += 6;

    const steps = [
      ["1", "Gather supplies: peptide vial, bacteriostatic water (BW), a fresh insulin syringe, and alcohol swabs."],
      ["2", "Wipe both vial stoppers with an alcohol swab and allow to fully dry before proceeding."],
      ["3", "Draw the desired volume of bacteriostatic water into the syringe (typically 1–2 mL per vial)."],
      ["4", "Insert the needle at an angle along the inside wall of the vial — do not inject directly onto the powder."],
      ["5", "Allow the water to run slowly down the glass. Do not shake. Gently swirl until fully dissolved."],
      ["6", "The solution should appear clear. Discard if cloudy or particulate matter is present."],
    ];
    for (const [num, text] of steps) {
      ly = bullet(doc, num, text, L + 6, ly, COL_W - 12);
      ly += 2;
    }

    ly += 8;

    // ── Common Ratios ─────────────────────────────────────────────────────────
    ly = section(doc, "COMMON RECONSTITUTION RATIOS", L, ly, COL_W);
    ly += 6;

    const ratios = [
      ["5 mg vial + 1 mL BAC Water", "5 mg/mL  (500 mcg / 0.1 mL)"],
      ["5 mg vial + 2 mL BAC Water", "2.5 mg/mL  (250 mcg / 0.1 mL)"],
      ["10 mg vial + 1 mL BAC Water", "10 mg/mL  (1,000 mcg / 0.1 mL)"],
      ["10 mg vial + 2 mL BAC Water", "5 mg/mL  (500 mcg / 0.1 mL)"],
    ];

    for (let i = 0; i < ratios.length; i++) {
      const [dose, conc] = ratios[i];
      const bg = i % 2 === 0 ? CLOUD : WHITE;
      const ROW_H = 20;
      doc.rect(L, ly, COL_W, ROW_H).fill(bg);
      doc.font("Helvetica").fontSize(7.5).fillColor(ARSENIC)
        .text(dose, L + 8, ly + 5, { width: COL_W * 0.54 - 8 });
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY)
        .text(conc, L + COL_W * 0.54, ly + 5, { width: COL_W * 0.46 - 4, align: "right" });
      ly += ROW_H;
    }

    doc.font("Helvetica").fontSize(6.5).fillColor(GRAPH)
      .text("Recommended amounts vary by peptide. Visit aurapepts.com for compound-specific guidance.", L, ly + 5, { width: COL_W });
    ly += 22;

    // ── Equipment Checklist ───────────────────────────────────────────────────
    ly = section(doc, "EQUIPMENT CHECKLIST", L, ly, COL_W);
    ly += 6;

    const equipment = [
      "Bacteriostatic water (BW) — not regular sterile water",
      "Insulin syringes (29–31 gauge, 0.5 mL or 1 mL)",
      "Alcohol swabs (70% isopropyl)",
      "Sharps disposal container",
      "Reconstituted vial label with date & concentration",
    ];
    for (const item of equipment) {
      ly = checkItem(doc, item, L + 8, ly, COL_W - 16);
    }

    // ╔══════════════════════════╗  RIGHT COLUMN
    // ║ STORAGE INSTRUCTIONS     ║
    // ╚══════════════════════════╝

    let ry = y;
    ry = section(doc, "STORAGE INSTRUCTIONS", R, ry, COL_W);
    ry += 6;

    ry = bullet(doc, null, "BEFORE RECONSTITUTION", R + 6, ry, COL_W - 12);
    const beforeStorage = [
      "Store lyophilized (freeze-dried) vials in a cool, dry place away from direct light.",
      "Long-term storage: freezer at −20°C for up to 24 months.",
      "Short-term storage: refrigerator (2–8°C) for up to 3–6 months.",
      "Allow vials to reach room temperature before opening to prevent condensation.",
    ];
    for (const t of beforeStorage) {
      ry = bullet(doc, null, t, R + 14, ry, COL_W - 22);
    }

    ry += 6;
    ry = bullet(doc, null, "AFTER RECONSTITUTION", R + 6, ry, COL_W - 12);
    const afterStorage = [
      "Store reconstituted peptide in the refrigerator at 2–8°C.",
      "Use within 28–30 days once reconstituted with bacteriostatic water.",
      "Keep away from light — wrap vial in foil if needed.",
      "Never freeze a reconstituted solution; this degrades peptide bonds.",
    ];
    for (const t of afterStorage) {
      ry = bullet(doc, null, t, R + 14, ry, COL_W - 22);
    }

    ry += 10;

    // ── Injection Guidance ────────────────────────────────────────────────────
    ry = section(doc, "INJECTION GUIDANCE", R, ry, COL_W);
    ry += 6;

    const injections = [
      "Always use a new sterile insulin syringe for each injection.",
      "Clean the injection site with an alcohol swab; allow to air-dry before injecting.",
      "Draw the calculated volume based on your target dose and reconstitution ratio.",
      "Subcutaneous (SQ): inject into pinched skin of the abdomen, thigh, or upper arm.",
      "Dispose of used sharps in a proper sharps container immediately after use.",
    ];
    for (const t of injections) {
      ry = bullet(doc, null, t, R + 6, ry, COL_W - 12);
    }

    ry += 10;

    // ── Handling & Safety ─────────────────────────────────────────────────────
    ry = section(doc, "HANDLING & SAFETY NOTES", R, ry, COL_W);
    ry += 6;

    const safety = [
      "These peptides are strictly for laboratory and in vitro research use only.",
      "Not approved by the FDA for human or animal administration.",
      "Follow all applicable institutional safety protocols.",
      "Keep all materials out of reach of children and untrained individuals.",
    ];
    for (const t of safety) {
      ry = bullet(doc, null, t, R + 6, ry, COL_W - 12);
    }

    // ── Disclaimer band ───────────────────────────────────────────────────────
    const discY = Math.max(ly, ry) + 18;
    const discH = 32;
    doc.rect(MARGIN, discY, INNER, discH).fill(CLOUD);
    doc.rect(MARGIN, discY, 3, discH).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(NAVY)
      .text("RESEARCH USE DISCLAIMER", MARGIN + 10, discY + 5);
    doc.font("Helvetica").fontSize(6.5).fillColor(GRAPH)
      .text(
        "All products sold by Aura Peptides are intended exclusively for in vitro research and laboratory use. They are not intended for human or veterinary use, diagnosis, or treatment. By handling these compounds, the researcher accepts full responsibility for compliance with all applicable laws and institutional guidelines.",
        MARGIN + 10, discY + 16,
        { width: INNER - 20, lineGap: 0 }
      );

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = H - 26;
    doc.rect(0, footerY - 6, W, 1).fill(SMOKE);
    doc.font("Helvetica").fontSize(7).fillColor(GRAPH)
      .text("Aura Peptides  ·  aurapepts.com  ·  support@aurapepts.com", 0, footerY, { width: W, align: "center" });

    doc.end();
  } catch (err: any) {
    console.error("Reconstitution guide error:", err);
    res.status(500).json({ message: err.message });
  }
}
