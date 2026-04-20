import React, { useMemo } from 'react';

type Decision = 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
type StatusTone = 'ok' | 'warn' | 'bad' | 'na';

type ReportFile = {
  id: string;
  name: string;
  sizeLabel: string;
  isPdf: boolean;
  previewUrl: string | null;
  verdict: string;
  riskScore: number;
  decision: Decision;
  summary: string | null;
  identity?: {
    name?: string;
    dob?: string;
    address?: string;
    confidence?: number;
  } | null;
};

type ReportRun = {
  id: string;
  runId: string;
  createdAt: Date;
  overallDecision: Decision;
  files: ReportFile[];
};

type BatchMeta = {
  overallRisk?: number;
  verdict?: string;
  risk?: string;
  finalVerdict?: any;
  identitySimilarity?: number;
  correlation?: {
    conclusion?: string;
    confidence?: number;
    story?: string;
  };
};

type ForensicReportFrameProps = {
  run: ReportRun;
  batchMeta?: BatchMeta;
};

type MatrixCell = {
  tone: StatusTone;
  note: string;
  score?: number;
};

type MatrixRow = {
  label: string;
  cells: MatrixCell[];
};

const reportStyles = String.raw`
  :root {
    --ink: #10213a;
    --muted: #5b6b82;
    --line: #cfd7e3;
    --line-strong: #96a5bd;
    --brand: #123b7a;
    --brand-2: #198b7a;
    --ok: #1f8f55;
    --warn: #c98714;
    --bad: #c23b3b;
    --na: #7d8796;
    --white: #ffffff;
    --card-teal-a: #0ea5b7;
    --card-teal-b: #19c6bf;
    --card-risk-a: #ff4b7d;
    --card-risk-b: #ff315f;
    --card-review-a: #ff9558;
    --card-review-b: #ff6a86;
    --card-safe-a: #14c99b;
    --card-safe-b: #09dd72;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #dfe6ef;
    color: var(--ink);
    font-family: Arial, Helvetica, sans-serif;
  }
  .page {
    width: 100%;
    min-height: 100vh;
    margin: 0 auto;
    background: var(--white);
    position: relative;
    overflow: hidden;
    padding: 24px 26px;
  }
  .watermark {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
  }
  .watermark span {
    font-size: 88px;
    font-weight: 700;
    letter-spacing: 12px;
    color: rgba(18, 59, 122, 0.055);
    transform: rotate(-24deg);
    user-select: none;
  }
  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .header {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 20px;
    border-bottom: 1px solid var(--line-strong);
    padding-bottom: 16px;
  }
  .brand-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--brand), var(--brand-2));
    color: var(--white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 24px;
    box-shadow: 0 6px 16px rgba(18, 59, 122, 0.16);
  }
  .brand-block h1 {
    margin: 0;
    font-size: 25px;
    letter-spacing: 0.2px;
  }
  .brand-block .sub {
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
    max-width: 760px;
  }
  .meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    align-content: start;
    justify-self: end !important;
    margin-left: auto !important;
  }
  .meta-card {
    border: 1px solid rgba(0,0,0,0.07);
    background: linear-gradient(145deg, #ffffff 0%, #f5f8ff 100%);
    border-radius: 16px;
    padding: 16px 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    position: relative;
    overflow: hidden;
  }
  .meta-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #123b7a, #198b7a);
    border-radius: 16px 16px 0 0;
  }
  .meta-label {
    font-size: 9.5px;
    color: #9aa3b5;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 700;
    margin-bottom: 8px;
    margin-top: 2px;
  }
  .meta-value {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.2;
    color: #0f1f3d;
    word-break: break-word;
  }
  .meta-value.mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    color: #123b7a;
  }
  .summary-row {
    display: grid;
    grid-template-columns: 1.35fr .85fr .85fr .85fr;
    gap: 14px;
  }
  .summary-card {
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 14px;
    background: linear-gradient(180deg, #ffffff 0%, #f5f9fd 100%);
    min-height: 104px;
  }
  .summary-card.primary {
    background: linear-gradient(135deg, rgba(18,59,122,.98), rgba(25,139,122,.96));
    color: #fff;
    border: none;
  }
  .summary-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: .86;
    margin-bottom: 8px;
  }
  .summary-value {
    font-size: 25px;
    font-weight: 700;
    line-height: 1.05;
    margin-bottom: 8px;
  }
  .summary-note {
    font-size: 11px;
    line-height: 1.5;
    color: var(--muted);
  }
  .summary-card.primary .summary-note { color: rgba(255,255,255,.86); }
  .matrix-wrap {
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    overflow: hidden;
    background: #fff;
  }
  .matrix-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    background: linear-gradient(90deg, #f1f6fb, #f8fbfe);
    border-bottom: 1px solid var(--line);
  }
  .matrix-head h2 {
    margin: 0;
    font-size: 16px;
    letter-spacing: 0.2px;
  }
  .legend {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 11px;
    color: var(--muted);
  }
  .legend span { display: inline-flex; align-items: center; gap: 4px; }
  .chip {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid currentColor;
    line-height: 1;
  }
  .chip.ok { color: var(--ok); }
  .chip.bad { color: var(--bad); }
  .chip.warn { color: var(--warn); }
  .chip.na { color: var(--na); }
  .matrix-summary {
    display: grid;
    grid-template-columns: 1.15fr .95fr .95fr .95fr;
    gap: 10px;
    padding: 14px 16px;
    background: linear-gradient(180deg, #fbfdff 0%, #f4f8fc 100%);
    border-bottom: 1px solid var(--line);
  }
  .matrix-summary-card {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #fff;
    padding: 12px 13px;
    min-height: 78px;
  }
  .matrix-summary-card.primary {
    background: linear-gradient(135deg, rgba(18,59,122,.1), rgba(25,139,122,.08));
    border-color: rgba(18,59,122,.18);
  }
  .matrix-summary-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.35px;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .matrix-summary-value {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--ink);
    margin-bottom: 3px;
  }
  .matrix-summary-note {
    font-size: 10px;
    line-height: 1.4;
    color: var(--muted);
  }
  .matrix-summary-card:last-child .matrix-summary-value,
  .matrix-summary-card:last-child .matrix-summary-note {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .matrix-scroll {
    overflow-x: auto;
  }
  table.matrix {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10.5px;
  }
  .matrix thead th {
    background: #f7fafc;
    border-bottom: 1px solid var(--line);
    border-right: 1px solid var(--line);
    padding: 12px 7px;
    vertical-align: bottom;
    line-height: 1.2;
  }
  .matrix thead th:first-child {
    width: 22%;
    text-align: left;
    padding-left: 14px;
  }
  .matrix tbody td,
  .matrix tbody th {
    border-top: 1px solid var(--line);
    border-right: 1px solid var(--line);
    padding: 10px 7px;
    text-align: center;
    vertical-align: middle;
  }
  .matrix tbody th {
    text-align: left;
    font-weight: 700;
    background: #fbfdff;
    padding-left: 14px;
    line-height: 1.28;
  }
  .matrix tbody tr:nth-child(even) td,
  .matrix tbody tr:nth-child(even) th {
    background: #fcfdff;
  }
  .matrix tbody td:last-child,
  .matrix thead th:last-child,
  .matrix tbody th:last-child {
    border-right: none;
  }
  .doc-name {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 4px;
    line-height: 1.24;
    word-break: break-word;
  }
  .doc-type {
    display: block;
    font-size: 9px;
    color: var(--muted);
    line-height: 1.25;
    word-break: break-word;
  }
  .status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 1px solid currentColor;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 3px;
  }
  .status.ok { color: var(--ok); }
  .status.bad { color: var(--bad); }
  .status.warn { color: var(--warn); }
  .status.na { color: var(--na); }
  .tiny {
    display: block;
    font-size: 9.5px;
    color: var(--muted);
    line-height: 1.32;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .score {
    display: inline-block;
    font-size: 16px;
    font-weight: 700;
    color: var(--brand);
    line-height: 1;
    margin-bottom: 4px;
  }
  .bottom {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 14px;
  }
  .note-box {
    border: 1px solid var(--line);
    border-radius: 13px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    padding: 14px 16px;
  }
  .note-box h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
  }
  .note-box p,
  .note-box li {
    font-size: 12px;
    line-height: 1.45;
    color: var(--ink);
    margin: 0;
  }
  .note-box ul {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 7px;
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-top: 1px solid var(--line);
    padding-top: 10px;
    color: var(--muted);
    font-size: 11px;
  }
  .mono {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }

  /* ══════════════════════════════════════════
     REAGVIS FORENSIC REPORT — Visual Polish
     Layout unchanged — CSS only
  ══════════════════════════════════════════ */

  /* ── Font ── */
  body,
  body *,
  .page,
  .page *,
  .content,
  .content * {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    -webkit-font-smoothing: antialiased !important;
  }

  /* ── Page background ── */
  body {
    background: #F8F7F5 !important;
  }

  /* ══════════════════════════════════════════
     REPORT HEADER
  ══════════════════════════════════════════ */

  .header {
    grid-template-columns: minmax(0, 1fr) minmax(660px, 720px) !important;
    align-items: start !important;
    background: white !important;
    border-radius: 20px !important;
    padding: 28px 32px !important;
    margin-bottom: 20px !important;
    box-shadow:
      0 1px 3px rgba(0,0,0,0.05),
      0 4px 16px rgba(0,0,0,0.06),
      0 16px 48px rgba(0,0,0,0.05) !important;
    border: 1px solid rgba(0,0,0,0.06) !important;
  }

  .meta {
    width: 100% !important;
    max-width: 720px !important;
    justify-self: stretch !important;
    margin-left: 0 !important;
  }

  .logo {
    border-radius: 16px !important;
    font-size: 20px !important;
    font-weight: 900 !important;
    letter-spacing: -0.02em !important;
    box-shadow:
      0 4px 12px rgba(20,83,76,0.30),
      inset 0 1px 0 rgba(255,255,255,0.15) !important;
  }

  .brand-block h1 {
    font-size: 26px !important;
    font-weight: 800 !important;
    letter-spacing: -0.03em !important;
    color: #0D1117 !important;
  }

  .brand-block .sub {
    font-size: 13px !important;
    color: #9CA3AF !important;
    font-weight: 400 !important;
    letter-spacing: -0.01em !important;
    margin-top: 4px !important;
  }

  .meta {
    gap: 12px !important;
  }

  .meta-card {
    border-radius: 16px !important;
    border: 1px solid rgba(0,0,0,0.07) !important;
    background: linear-gradient(145deg, #ffffff 0%, #f5f8ff 100%) !important;
    padding: 16px 20px !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.8) inset !important;
    position: relative !important;
    overflow: hidden !important;
    transition: box-shadow 0.2s !important;
  }

  .meta-card::before {
    content: '' !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: 3px !important;
    background: linear-gradient(90deg, #123b7a, #198b7a) !important;
    border-radius: 16px 16px 0 0 !important;
  }

  .meta-label {
    font-size: 9.5px !important;
    font-weight: 700 !important;
    letter-spacing: 0.13em !important;
    text-transform: uppercase !important;
    color: #9aa3b5 !important;
    margin-bottom: 8px !important;
    margin-top: 2px !important;
  }

  .meta-value {
    font-size: 14px !important;
    font-weight: 700 !important;
    letter-spacing: -0.01em !important;
    color: #0f1f3d !important;
    line-height: 1.2 !important;
  }

  .meta-value.mono {
    font-family: 'SF Mono', 'Fira Code', monospace !important;
    font-size: 13px !important;
    color: #123b7a !important;
  }

  /* ══════════════════════════════════════════
     EXECUTIVE SUMMARY + STAT CARDS ROW
  ══════════════════════════════════════════ */

  .summary-row {
    margin-bottom: 20px !important;
    gap: 14px !important;
  }

  .summary-card.primary {
    border-radius: 20px !important;
    padding: 28px !important;
    background: linear-gradient(135deg, var(--card-teal-a) 0%, var(--card-teal-b) 100%) !important;
    box-shadow:
      0 4px 16px rgba(14,165,183,0.30),
      0 16px 48px rgba(25,198,191,0.22),
      inset 0 1px 0 rgba(255,255,255,0.08) !important;
    position: relative !important;
    overflow: hidden !important;
  }

  .summary-card.primary::before {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background:
      radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 60%),
      radial-gradient(circle at 20% 80%, rgba(0,0,0,0.10) 0%, transparent 50%) !important;
    pointer-events: none !important;
  }

  .summary-title {
    font-size: 10px !important;
    font-weight: 800 !important;
    letter-spacing: 0.16em !important;
    text-transform: uppercase !important;
    color: #C4C9D4 !important;
    margin-bottom: 10px !important;
    position: relative !important;
    z-index: 1 !important;
  }

  .summary-card.primary .summary-title {
    color: rgba(255,255,255,0.55) !important;
  }

  .summary-card.primary .summary-value {
    font-size: 36px !important;
    font-weight: 900 !important;
    letter-spacing: -0.04em !important;
    color: white !important;
    text-shadow: 0 2px 12px rgba(0,0,0,0.20) !important;
    margin-bottom: 12px !important;
    position: relative !important;
    z-index: 1 !important;
  }

  .summary-card.primary .summary-note {
    font-size: 14px !important;
    color: rgba(255,255,255,0.72) !important;
    line-height: 1.6 !important;
    font-weight: 400 !important;
    position: relative !important;
    z-index: 1 !important;
  }

  .summary-card:not(.primary) {
    border-radius: 20px !important;
    padding: 24px !important;
    background: white !important;
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 4px 16px rgba(0,0,0,0.06),
      0 16px 48px rgba(0,0,0,0.05),
      inset 0 1px 0 rgba(255,255,255,0.90) !important;
    border: 1px solid rgba(0,0,0,0.05) !important;
    transition: transform 200ms, box-shadow 200ms !important;
  }

  .summary-row .summary-card:nth-child(2) {
    background: linear-gradient(135deg, var(--card-risk-a) 0%, var(--card-risk-b) 100%) !important;
    border-color: transparent !important;
    box-shadow:
      0 4px 16px rgba(255,75,125,0.22),
      0 16px 48px rgba(255,49,95,0.18),
      inset 0 1px 0 rgba(255,255,255,0.10) !important;
  }

  .summary-row .summary-card:nth-child(3) {
    background: linear-gradient(135deg, var(--card-review-a) 0%, var(--card-review-b) 100%) !important;
    border-color: transparent !important;
    box-shadow:
      0 4px 16px rgba(255,149,88,0.22),
      0 16px 48px rgba(255,106,134,0.16),
      inset 0 1px 0 rgba(255,255,255,0.10) !important;
  }

  .summary-row .summary-card:nth-child(4) {
    background: linear-gradient(135deg, var(--card-safe-a) 0%, var(--card-safe-b) 100%) !important;
    border-color: transparent !important;
    box-shadow:
      0 4px 16px rgba(20,201,155,0.22),
      0 16px 48px rgba(9,221,114,0.16),
      inset 0 1px 0 rgba(255,255,255,0.10) !important;
  }

  .summary-card:not(.primary):hover {
    transform: translateY(-3px) !important;
    box-shadow:
      0 4px 16px rgba(0,0,0,0.08),
      0 16px 48px rgba(0,0,0,0.08) !important;
  }

  .summary-card:not(.primary) .summary-title {
    font-size: 10px !important;
    font-weight: 800 !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    color: rgba(255,255,255,0.75) !important;
    margin-bottom: 10px !important;
  }

  .summary-card:not(.primary) .summary-value {
    font-size: 42px !important;
    font-weight: 900 !important;
    letter-spacing: -0.05em !important;
    color: #ffffff !important;
    line-height: 1 !important;
    margin-bottom: 8px !important;
  }

  .summary-card:not(.primary) .summary-note {
    font-size: 12px !important;
    color: rgba(255,255,255,0.82) !important;
    font-weight: 400 !important;
    line-height: 1.5 !important;
  }

  .subject-section,
  .flagged-section,
  .closing-summary {
    background: white !important;
    border-radius: 20px !important;
    padding: 24px 28px !important;
    border: 1px solid rgba(0,0,0,0.06) !important;
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 8px 32px rgba(0,0,0,0.06) !important;
  }

  .section-heading {
    margin: 0 0 14px 0 !important;
    font-size: 18px !important;
    font-weight: 800 !important;
    letter-spacing: -0.03em !important;
    color: #0D1117 !important;
  }

  .section-subcopy {
    margin: -6px 0 18px 0 !important;
    font-size: 13px !important;
    color: #9CA3AF !important;
    line-height: 1.55 !important;
  }

  .subject-grid {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    gap: 12px !important;
  }

  .subject-card,
  .flagged-card,
  .closing-panel {
    border-radius: 16px !important;
    padding: 16px 18px !important;
    background: #FAFAFA !important;
    border: 1px solid rgba(0,0,0,0.06) !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;
  }

  .subject-label {
    font-size: 10px !important;
    font-weight: 800 !important;
    letter-spacing: 0.16em !important;
    text-transform: uppercase !important;
    color: #C4C9D4 !important;
    margin-bottom: 8px !important;
  }

  .subject-value {
    font-size: 18px !important;
    font-weight: 800 !important;
    letter-spacing: -0.03em !important;
    color: #111827 !important;
    line-height: 1.35 !important;
    overflow-wrap: anywhere !important;
  }

  .subject-note,
  .closing-panel p {
    margin-top: 6px !important;
    font-size: 12px !important;
    color: #6B7280 !important;
    line-height: 1.45 !important;
  }

  .closing-summary-grid {
    display: grid !important;
    grid-template-columns: 1.2fr .8fr !important;
    gap: 14px !important;
    align-items: start !important;
  }

  .closing-summary h4 {
    margin: 0 0 10px 0 !important;
    font-size: 14px !important;
    font-weight: 800 !important;
    letter-spacing: -0.02em !important;
    color: #111827 !important;
  }

  .closing-summary ul {
    margin: 0 !important;
    padding-left: 18px !important;
    display: grid !important;
    gap: 8px !important;
  }

  .closing-summary li {
    font-size: 13px !important;
    color: #374151 !important;
    line-height: 1.55 !important;
  }

  /* ══════════════════════════════════════════
     CROSS-VERIFICATION MATRIX SECTION
  ══════════════════════════════════════════ */

  .matrix-wrap {
    background: white !important;
    border-radius: 20px !important;
    margin-bottom: 20px !important;
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 8px 32px rgba(0,0,0,0.06) !important;
    border: 1px solid rgba(0,0,0,0.06) !important;
  }

  .matrix-head h2 {
    font-size: 20px !important;
    font-weight: 800 !important;
    letter-spacing: -0.03em !important;
    color: #0D1117 !important;
  }

  .legend {
    display: flex !important;
    align-items: center !important;
    gap: 16px !important;
  }

  .legend span {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    letter-spacing: 0.01em !important;
    padding: 4px 10px !important;
    border-radius: 999px !important;
    background: #FAFAFA !important;
  }

  /* ══════════════════════════════════════════
     4 SUMMARY BOXES
  ══════════════════════════════════════════ */

  .matrix-summary {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    gap: 12px !important;
    margin-bottom: 16px !important;
  }

  .matrix-summary-card {
    border-radius: 16px !important;
    padding: 16px !important;
    background: #FAFAFA !important;
    border: 1px solid rgba(0,0,0,0.07) !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;
    transition: box-shadow 180ms !important;
  }

  .matrix-summary-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
    background: white !important;
  }

  .matrix-summary-label {
    font-size: 9px !important;
    font-weight: 800 !important;
    letter-spacing: 0.14em !important;
    text-transform: uppercase !important;
    color: #C4C9D4 !important;
    margin-bottom: 8px !important;
  }

  .matrix-summary-value {
    font-size: 13px !important;
    font-weight: 700 !important;
    letter-spacing: -0.02em !important;
    color: #111827 !important;
    line-height: 1.35 !important;
    margin-bottom: 6px !important;
  }

  .matrix-summary-note {
    font-size: 11px !important;
    color: #6B7280 !important;
    line-height: 1.45 !important;
    font-weight: 400 !important;
  }

  .matrix-summary-card .matrix-summary-value,
  .matrix-summary-card .matrix-summary-note {
    overflow-wrap: anywhere !important;
  }

  .matrix-summary-card.issue {
    background: linear-gradient(135deg, #fff5f7 0%, #fff0f3 100%) !important;
  }

  .matrix-summary-card.issue.ok {
    background: linear-gradient(135deg, #f1fdf8 0%, #ebfbf4 100%) !important;
  }

  .matrix-summary-card.issue.warn {
    background: linear-gradient(135deg, #fff7ef 0%, #fff1e5 100%) !important;
  }

  .matrix-summary-badge {
    display: inline-flex !important;
    align-items: center !important;
    border-radius: 999px !important;
    padding: 4px 8px !important;
    font-size: 9px !important;
    font-weight: 800 !important;
    letter-spacing: 0.1em !important;
    text-transform: uppercase !important;
    margin-bottom: 8px !important;
    background: rgba(220,38,38,0.10) !important;
    color: #DC2626 !important;
  }

  .matrix-summary-card.issue.ok .matrix-summary-badge {
    background: rgba(22,163,74,0.10) !important;
    color: #16A34A !important;
  }

  .matrix-summary-card.issue.warn .matrix-summary-badge {
    background: rgba(217,119,6,0.10) !important;
    color: #D97706 !important;
  }

  .matrix-summary-card.compact .matrix-summary-value {
    font-size: 12px !important;
    margin-bottom: 4px !important;
  }

  .matrix-summary-card.compact .matrix-summary-note {
    font-size: 10px !important;
    line-height: 1.35 !important;
  }

  .matrix-summary-more {
    font-size: 10px !important;
    color: #64748B !important;
    margin-top: 6px !important;
  }

  .flagged-grid {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 12px !important;
  }

  .flagged-card strong {
    display: block !important;
    font-size: 13px !important;
    line-height: 1.3 !important;
    color: #111827 !important;
    margin-bottom: 6px !important;
    overflow-wrap: anywhere !important;
  }

  .flagged-card span {
    display: block !important;
    font-size: 12px !important;
    line-height: 1.45 !important;
    color: #475569 !important;
    overflow-wrap: anywhere !important;
  }

  /* ══════════════════════════════════════════
     MAIN VERIFICATION TABLE
  ══════════════════════════════════════════ */

  table.matrix {
    border-collapse: separate !important;
    border-spacing: 0 !important;
    width: 100% !important;
    table-layout: fixed !important;
  }

  .matrix-scroll {
    overflow-x: visible !important;
  }

  .matrix thead th {
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: -0.01em !important;
    color: #374151 !important;
    background: #F3F4F6 !important;
    padding: 12px 10px !important;
    text-align: center !important;
    vertical-align: middle !important;
    border-bottom: 2px solid #E5E7EB !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 2 !important;
  }

  .matrix thead th:first-child {
    text-align: left !important;
    padding-left: 14px !important;
    vertical-align: middle !important;
  }

  .matrix tbody th {
    font-size: 13px !important;
    font-weight: 700 !important;
    color: #111827 !important;
    letter-spacing: -0.01em !important;
    padding: 16px 14px !important;
    background: #FAFAFA !important;
    border-right: 2px solid #F0F0F0 !important;
    vertical-align: middle !important;
    white-space: normal !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
    line-height: 1.35 !important;
    position: sticky !important;
    left: 0 !important;
    z-index: 1 !important;
  }

  .matrix tbody td {
    padding: 14px 10px !important;
    text-align: center !important;
    vertical-align: middle !important;
    border-bottom: 1px solid #F5F5F5 !important;
    font-size: 12px !important;
    color: #374151 !important;
    line-height: 1.5 !important;
  }

  .matrix tbody tr:first-child td,
  .matrix tbody tr:first-child th {
    border-top: 0 !important;
  }

  .matrix tbody tr:nth-child(even) td,
  .matrix tbody tr:nth-child(even) th {
    background: #FDFDFD !important;
  }

  .matrix tbody tr:hover td {
    background: #FFF8F5 !important;
  }

  .matrix tbody tr:hover th {
    background: #FAFAFA !important;
    color: #111827 !important;
  }

  .matrix thead th:not(:first-child) {
    font-size: 10px !important;
    font-weight: 700 !important;
    color: #374151 !important;
    height: 130px !important;
    width: 52px !important;
    vertical-align: bottom !important;
    padding: 0 8px 10px 8px !important;
  }

  .matrix thead th:not(:first-child) .doc-name {
    display: block !important;
    writing-mode: vertical-rl !important;
    transform: rotate(180deg) !important;
    white-space: nowrap !important;
    font-size: 10.5px !important;
    font-weight: 700 !important;
    color: #374151 !important;
    letter-spacing: 0.01em !important;
    max-height: 120px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .matrix thead th:not(:first-child) .doc-type {
    display: none !important;
  }

  /* ══════════════════════════════════════════
     STATUS ICONS
  ══════════════════════════════════════════ */

  .status {
    width: 24px !important;
    height: 24px !important;
    font-size: 14px !important;
    font-weight: 800 !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important;
    background: white !important;
  }

  .status.ok { color: #16A34A !important; }
  .status.warn { color: #D97706 !important; }
  .status.bad { color: #DC2626 !important; }
  .status.na { color: #9CA3AF !important; }

  .tiny {
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.01em !important;
    display: block !important;
    margin-top: 4px !important;
    line-height: 1.45 !important;
  }

  .score {
    font-size: 18px !important;
    font-weight: 800 !important;
    display: block !important;
    margin-top: 3px !important;
  }

  /* ══════════════════════════════════════════
     DOCUMENT TYPE BADGE
  ══════════════════════════════════════════ */

  .doc-type {
    display: inline-block !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    color: #9CA3AF !important;
    letter-spacing: 0.02em !important;
    background: #F3F4F6 !important;
    padding: 2px 7px !important;
    border-radius: 6px !important;
    margin-top: 3px !important;
    white-space: nowrap !important;
  }

  @media (max-width: 980px) {
    .matrix-summary {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    .flagged-grid { grid-template-columns: 1fr !important; }
  }

  @media (max-width: 860px) {
    .matrix-summary,
    .subject-grid,
    .closing-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .flagged-grid { grid-template-columns: 1fr !important; }
  }

  /* ══════════════════════════════════════════
     PRINT / PAGE STYLES
  ══════════════════════════════════════════ */
  @media print {
    body { background: white !important; }
    .summary-card:not(.primary),
    .matrix-wrap,
    .matrix-summary-card,
    .note-box,
    .header {
      box-shadow: none !important;
      border: 1px solid #E5E7EB !important;
    }
  }
`;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const decisionLabel: Record<Decision, string> = {
  APPROVE: 'Approve',
  MANUAL_REVIEW: 'Manual Review',
  REJECT: 'Reject',
};

const statusSymbol: Record<StatusTone, string> = {
  ok: '&#10003;',
  warn: '!',
  bad: '&#10005;',
  na: '&mdash;',
};

const formatDisplayDate = (value: Date) =>
  value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const getRiskTone = (riskScore: number): StatusTone => {
  if (riskScore >= 70) return 'bad';
  if (riskScore >= 31) return 'warn';
  return 'ok';
};

const verdictText = (decision: Decision) => decisionLabel[decision];

const formatCaseVerdict = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return normalized
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const toneFromPromptVerdict = (verdict?: string, fallbackRisk?: number): StatusTone => {
  const normalized = String(verdict || '').toUpperCase();
  if (normalized.includes('FAKE') || normalized.includes('REJECT')) return 'bad';
  if (normalized.includes('SUSPICIOUS') || normalized.includes('INSUFFICIENT') || normalized.includes('UNVERIFIABLE')) {
    return 'warn';
  }
  if (normalized.includes('AUTHENTIC') || normalized.includes('VERIFIED')) return 'ok';
  return typeof fallbackRisk === 'number' ? getRiskTone(fallbackRisk) : 'na';
};

const compactList = (items: string[], fallback: string) => {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (!cleaned.length) return fallback;
  return cleaned.slice(0, 4).join('; ');
};

const collectComparableValue = (
  files: ReportFile[],
  selector: (file: ReportFile) => string | undefined
) => {
  const values = files
    .map((file) => selector(file)?.trim())
    .filter((value): value is string => Boolean(value));

  if (!values.length) return null;

  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const buildMatchCell = (
  value: string | undefined,
  expected: string | null,
  label: string
): MatrixCell => {
  const trimmed = value?.trim();
  if (!trimmed || !expected) {
    return { tone: 'na', note: `${label} unavailable` };
  }
  if (trimmed.toLowerCase() === expected.toLowerCase()) {
    return { tone: 'ok', note: trimmed };
  }
  return { tone: 'warn', note: `Observed: ${trimmed}` };
};

const buildReportHtml = (run: ReportRun, batchMeta?: BatchMeta) => {
  const files = run.files.slice(0, 10);
  const finalVerdict = batchMeta?.finalVerdict || {};
  const candidate = finalVerdict?.candidate || {};
  const academicTimeline = Array.isArray(finalVerdict?.academic?.timeline)
    ? finalVerdict.academic.timeline
    : [];
  const employmentTimeline = Array.isArray(finalVerdict?.employment?.timeline)
    ? finalVerdict.employment.timeline
    : [];
  const perDocVerdicts = Array.isArray(finalVerdict?.per_doc_verdicts)
    ? finalVerdict.per_doc_verdicts
    : [];
  const fraudPatterns = Array.isArray(finalVerdict?.fraud_patterns)
    ? finalVerdict.fraud_patterns
    : [];
  const missingDocs = Array.isArray(finalVerdict?.missing_docs)
    ? finalVerdict.missing_docs
    : [];
  const docsExcluded = Array.isArray(finalVerdict?.docs_excluded)
    ? finalVerdict.docs_excluded
    : [];
  const hasPrompt2 =
    Boolean(finalVerdict?.verdict) ||
    Boolean(finalVerdict?.summary) ||
    Boolean(candidate?.name) ||
    perDocVerdicts.length > 0 ||
    academicTimeline.length > 0 ||
    employmentTimeline.length > 0;
  const caseVerdict = formatCaseVerdict(finalVerdict?.verdict || batchMeta?.verdict);
  const overallRisk =
    typeof batchMeta?.overallRisk === 'number'
      ? Math.round(batchMeta.overallRisk)
      : Math.max(...files.map((file) => file.riskScore), 0);
  const identitySimilarity =
    typeof batchMeta?.identitySimilarity === 'number'
      ? `${Math.round(batchMeta.identitySimilarity)}%`
      : hasPrompt2
        ? 'Prompt 2'
        : 'N/A';
  const correlationSummary =
    finalVerdict?.summary?.trim() ||
    batchMeta?.correlation?.conclusion?.trim() ||
    'Cross-document review completed.';
  const analystNotes =
    finalVerdict?.summary?.trim() ||
    batchMeta?.correlation?.story?.trim() ||
    files
      .map((file) => file.summary?.trim())
      .filter((summary): summary is string => Boolean(summary))
      .join(' ');

  const canonicalName = candidate?.name?.trim() || collectComparableValue(files, (file) => file.identity?.name);
  const canonicalDob = candidate?.dob?.trim() || collectComparableValue(files, (file) => file.identity?.dob);
  const canonicalAddress = collectComparableValue(files, (file) => file.identity?.address);
  const subjectDocuments = files.map((file) => file.name).join(', ');

  const executiveSummary =
    finalVerdict?.summary?.trim() ||
    (run.overallDecision === 'REJECT'
      ? 'One or more uploaded documents show high-risk forensic signals and require rejection.'
      : run.overallDecision === 'MANUAL_REVIEW'
        ? 'The batch contains mixed authenticity signals and should be manually reviewed before approval.'
        : 'The uploaded documents show acceptable consistency against the currently available forensic checks.');

  const identitySummary =
    hasPrompt2 && (canonicalName || canonicalDob)
      ? `Prompt 2 resolved candidate${canonicalName ? ` as ${canonicalName}` : ''}${canonicalDob ? `, DOB ${canonicalDob}` : ''}.`
      : canonicalName || canonicalDob || canonicalAddress
      ? `Primary identity anchors detected across ${files.length} document${files.length === 1 ? '' : 's'}.`
      : 'Identity fields were limited in the returned analysis payload.';

  const exceptionSummary = compactList(
    [
      ...fraudPatterns.map((item: any) => `${item.sev || 'FLAG'}: ${item.pattern || item.detail || item.evidence || 'Fraud pattern flagged'}`),
      ...missingDocs.map((item: any) => `Missing ${item.type || 'document'}${item.impact ? ` (${item.impact})` : ''}`),
      ...docsExcluded.map((item: any) => `Excluded ${item.doc || 'document'}: ${item.reason || 'not analyzed'}`),
      ...perDocVerdicts
        .filter((item: any) => !/AUTHENTIC|VERIFIED/i.test(String(item.verdict || '')))
        .map((item: any) => `${item.doc || 'Document'}: ${item.verdict || 'Review'}${item.key_flag ? ` - ${item.key_flag}` : ''}`),
      ...files
        .filter((file) => file.decision !== 'APPROVE')
        .map((file) => `${file.name}: ${verdictText(file.decision)}`),
    ],
    'No material exceptions flagged.'
  );

  const subjectDetails = [
    {
      label: 'Name',
      value: canonicalName || 'Not available',
      note: canonicalName
        ? 'Primary identity inferred from the strongest matching documents.'
        : 'No stable name could be extracted from the returned payload.',
    },
    {
      label: 'DOB',
      value: canonicalDob || 'Not available',
      note: canonicalDob
        ? 'Cross-document DOB reference used in correlation checks.'
        : 'DOB was not consistently returned across the uploaded documents.',
    },
    {
      label: 'Address',
      value: canonicalAddress || 'Not available',
      note: canonicalAddress
        ? 'Most consistent address observed across the available records.'
        : 'Address details were partial or missing in the returned analysis data.',
    },
    {
      label: 'Documents Submitted',
      value: String(files.length),
      note: subjectDocuments || 'No document names available.',
    },
  ];

  const issueSummary =
    run.overallDecision === 'REJECT'
      ? {
          statusClass: 'risk',
          badge: 'Issue Found',
          title: 'Material issues found.',
          copy: 'Reject-level signals detected. Hold batch for external validation.',
        }
      : run.overallDecision === 'MANUAL_REVIEW'
        ? {
            statusClass: 'warn',
            badge: 'Needs Review',
            title: 'Analyst review required.',
            copy: 'Mixed signals detected. Review before approval.',
          }
        : {
            statusClass: 'ok',
            badge: 'No Major Issue',
            title: 'No major issue found.',
            copy: 'Documents broadly align across current checks.',
          };

  const issueBullets = files
    .filter((file) => file.decision !== 'APPROVE')
    .map((file) => `${file.name}: ${file.summary?.trim() || verdictText(file.decision)}`);

  const issuePreviewItems = files
    .filter((file) => file.decision !== 'APPROVE')
    .map((file) => ({
      name: file.name,
      summary: file.summary?.trim() || verdictText(file.decision),
    }));

  const issueListPreview =
    issueBullets.length > 0
      ? issuePreviewItems
          .map(
            (item) =>
              `<div class="flagged-card"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.summary)}</span></div>`
          )
          .join('')
      : 'No material issue flagged.';

  const finalSummaryBullets = [
    `Primary subject details used for review: ${canonicalName || 'name unavailable'}, ${canonicalDob || 'DOB unavailable'}, ${canonicalAddress || 'address unavailable'}.`,
    `KYC outcome for this batch: ${caseVerdict || verdictText(run.overallDecision)}.`,
    `Highest-risk note: ${exceptionSummary}`,
    `Recommended next step: ${executiveSummary}`,
  ];

  const promptDocFor = (index: number) => perDocVerdicts[index] || null;
  const academicFor = (index: number) => academicTimeline[index] || null;
  const employmentFor = (index: number) => employmentTimeline[index] || null;

  const rowBuilders: Array<{ label: string; build: (file: ReportFile, index: number) => MatrixCell }> = [
    {
      label: 'Authenticity Signals',
      build: (file, index) => {
        const promptDoc = promptDocFor(index);
        if (promptDoc?.confidence || promptDoc?.verdict) {
          return {
            tone: toneFromPromptVerdict(promptDoc.verdict, file.riskScore),
            note: `${formatCaseVerdict(promptDoc.verdict) || 'Analyzed'}${promptDoc.confidence ? ` (${promptDoc.confidence}%)` : ''}`,
          };
        }
        return {
          tone: getRiskTone(file.riskScore),
          note: `${file.riskScore}% risk`,
        };
      },
    },
    {
      label: 'Security / Tamper Check',
      build: (file, index) => {
        const promptDoc = promptDocFor(index);
        if (promptDoc?.key_flag) {
          return {
            tone: toneFromPromptVerdict(promptDoc.verdict, file.riskScore),
            note: promptDoc.key_flag,
          };
        }
        return {
          tone: getRiskTone(file.riskScore),
          note: file.summary?.trim() || analystNotes || 'Derived from model risk score',
        };
      },
    },
    {
      label: 'Photo / Face Presence & Clarity',
      build: (file) => {
        if (file.isPdf) return { tone: 'na', note: 'PDF source' };
        if (file.previewUrl) return { tone: 'ok', note: 'Preview available' };
        return { tone: 'warn', note: 'Preview unavailable' };
      },
    },
    {
      label: 'Name Match vs Batch Identity',
      build: (file) => buildMatchCell(file.identity?.name, canonicalName, 'Name'),
    },
    {
      label: 'DOB Match',
      build: (file) => buildMatchCell(file.identity?.dob, canonicalDob, 'DOB'),
    },
    {
      label: 'Address Match',
      build: (file) => buildMatchCell(file.identity?.address, canonicalAddress, 'Address'),
    },
    {
      label: 'ID Number / Format Validation',
      build: () => ({ tone: 'na', note: 'Not returned by API' }),
    },
    {
      label: 'Data Field Completeness',
      build: (file, index) => {
        const academicItem = academicFor(index);
        const employmentItem = employmentFor(index);
        if (hasPrompt2 && (candidate?.name || candidate?.dob || academicItem || employmentItem)) {
          const fields = [
            candidate?.name,
            candidate?.dob,
            academicItem?.institution || employmentItem?.company,
            academicItem?.year || employmentItem?.join_doc,
          ].filter(Boolean).length;
          return { tone: fields >= 2 ? 'ok' : 'warn', note: `${fields} Prompt 2 fields available` };
        }
        const fieldCount = [file.identity?.name, file.identity?.dob, file.identity?.address].filter(Boolean).length;
        if (fieldCount >= 3) return { tone: 'ok', note: 'Core fields present' };
        if (fieldCount >= 1) return { tone: 'warn', note: `${fieldCount}/3 fields present` };
        return { tone: 'na', note: 'No identity fields' };
      },
    },
    {
      label: 'Issuing Authority Verification',
      build: () => ({ tone: 'na', note: 'Not returned by API' }),
    },
    {
      label: 'Institution / Certificate Validation',
      build: (file, index) => {
        const academicItem = academicFor(index);
        if (academicItem) {
          return {
            tone: toneFromPromptVerdict(academicItem.status, file.riskScore),
            note: `${academicItem.status || 'Academic data'}${academicItem.institution ? `: ${academicItem.institution}` : ''}`,
          };
        }
        const isAcademic = /degree|certificate|marks|transcript|diploma/i.test(file.name);
        return isAcademic ? { tone: 'warn', note: 'Requires issuer check' } : { tone: 'na', note: 'Not applicable' };
      },
    },
    {
      label: 'Certificate / Degree Genuine',
      build: (file, index) => {
        const promptDoc = promptDocFor(index);
        if (promptDoc?.verdict) {
          return {
            tone: toneFromPromptVerdict(promptDoc.verdict, file.riskScore),
            note: `${formatCaseVerdict(promptDoc.verdict) || promptDoc.verdict}${promptDoc.confidence ? ` (${promptDoc.confidence}%)` : ''}`,
          };
        }
        const isAcademic = /degree|certificate|marks|transcript|diploma/i.test(file.name);
        return isAcademic ? { tone: 'warn', note: 'Manual validation pending' } : { tone: 'na', note: 'Not applicable' };
      },
    },
    {
      label: 'Marks / CGPA / Grade Consistency',
      build: (file, index) => {
        const academicItem = academicFor(index);
        if (academicItem) {
          const pctValues = [
            typeof academicItem.pct_marksheet === 'number' && academicItem.pct_marksheet > 0 ? `marksheet ${academicItem.pct_marksheet}%` : '',
            typeof academicItem.pct_certificate === 'number' && academicItem.pct_certificate > 0 ? `certificate ${academicItem.pct_certificate}%` : '',
            academicItem.pct_conflict_detail || '',
          ].filter(Boolean);
          return {
            tone: academicItem.pct_conflict ? 'warn' : toneFromPromptVerdict(academicItem.status, file.riskScore),
            note: pctValues.join('; ') || `${academicItem.level || 'Academic'} ${academicItem.status || 'reviewed'}`,
          };
        }
        const isAcademic = /marks|grade|cgpa|transcript/i.test(file.name);
        return isAcademic ? { tone: 'warn', note: 'No structured marks payload' } : { tone: 'na', note: 'Not applicable' };
      },
    },
    {
      label: 'Date Correlation Across Batch',
      build: (file, index) => {
        const academicItem = academicFor(index);
        const employmentItem = employmentFor(index);
        if (academicItem?.year) {
          return { tone: academicItem.year_resume_match === false ? 'warn' : 'ok', note: `Academic year ${academicItem.year}` };
        }
        if (employmentItem?.join_doc || employmentItem?.leave_doc) {
          return {
            tone: employmentItem.dates_match === false ? 'warn' : 'ok',
            note: [employmentItem.join_doc, employmentItem.leave_doc].filter(Boolean).join(' to '),
          };
        }
        if (files.length <= 1) return { tone: 'na', note: 'Single document batch' };
        return buildMatchCell(file.identity?.dob, canonicalDob, 'Date');
      },
    },
    {
      label: 'Issue / Exam / Academic Timeline Plausible',
      build: (file, index) => {
        const academicItem = academicFor(index);
        if (academicItem) {
          return {
            tone: academicItem.age_flag || academicItem.status === 'DISCREPANCY' ? 'warn' : 'ok',
            note: `${academicItem.level || 'Academic'} ${academicItem.year || ''} ${academicItem.status || 'reviewed'}`.trim(),
          };
        }
        const isAcademic = /degree|certificate|marks|transcript|diploma/i.test(file.name);
        return isAcademic ? { tone: 'warn', note: 'Timeline not structured' } : { tone: 'na', note: 'Not applicable' };
      },
    },
    {
      label: 'Font / Alignment / Layout Integrity',
      build: (file) => ({
        tone: getRiskTone(file.riskScore),
        note: file.riskScore >= 70 ? 'High visual-risk signal' : file.riskScore >= 31 ? 'Check recommended' : 'No major signal',
      }),
    },
    {
      label: 'QR / Barcode Decodable',
      build: () => ({ tone: 'na', note: 'Not returned by API' }),
    },
    {
      label: 'Signature Presence / Integrity',
      build: () => ({ tone: 'na', note: 'Not returned by API' }),
    },
    {
      label: 'Per-Document Final Verdict',
      build: (file, index) => {
        const promptDoc = promptDocFor(index);
        if (promptDoc?.verdict) {
          return {
            tone: toneFromPromptVerdict(promptDoc.verdict, file.riskScore),
            note: formatCaseVerdict(promptDoc.verdict) || String(promptDoc.verdict),
            score: typeof promptDoc.confidence === 'number' ? promptDoc.confidence : file.riskScore,
          };
        }
        return {
          tone: getRiskTone(file.riskScore),
          note: verdictText(file.decision),
          score: file.riskScore,
        };
      },
    },
  ];

  const matrixRows: MatrixRow[] = rowBuilders.map((row) => ({
    label: row.label,
    cells: files.map((file, index) => row.build(file, index)),
  }));

  const docHeaders = files
    .map(
      (file) => `
        <th>
          <span class="doc-name">${escapeHtml(file.name)}</span>
          <span class="doc-type">${escapeHtml(file.isPdf ? 'PDF document' : 'Image document')}</span>
        </th>
      `
    )
    .join('');

  const matrixBody = matrixRows
    .map((row) => {
      const cells = row.cells
        .map((cell) => {
          if (typeof cell.score === 'number') {
            return `
              <td>
                <span class="score">${cell.score}%</span>
                <span class="tiny">${escapeHtml(cell.note)}</span>
              </td>
            `;
          }
          return `
            <td>
              <span class="status ${cell.tone}">${statusSymbol[cell.tone]}</span>
              <span class="tiny">${escapeHtml(cell.note)}</span>
            </td>
          `;
        })
        .join('');
      return `<tr><th>${escapeHtml(row.label)}</th>${cells}</tr>`;
    })
    .join('');

  const footerPolicy = 'RVR-POL-001';

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reagvis Forensic Verification Report</title>
        <style>${reportStyles}</style>
      </head>
      <body>
        <div class="page">
          <div class="watermark"><span>REAGVIS</span></div>
          <div class="content">
            <section class="header">
              <div class="brand-wrap">
                <img src="/favicon-brand.png" alt="Reagvis Labs" class="logo" style="object-fit:contain;background:none;box-shadow:none;" />
                <div class="brand-block">
                  <h1>Reagvis Forensic Verification Report</h1>
                  <div class="sub">
                    Automated report generated from the current batch analysis payload available in TrustTrace.
                  </div>
                </div>
              </div>
              <div class="meta">
                <div class="meta-card">
                  <div class="meta-label">Report ID</div>
                  <div class="meta-value mono">${escapeHtml(`RVR-${run.id}`)}</div>
                </div>
                <div class="meta-card">
                  <div class="meta-label">Generated On</div>
                  <div class="meta-value">${escapeHtml(formatDisplayDate(run.createdAt))}</div>
                </div>
                <div class="meta-card">
                  <div class="meta-label">KYC Status</div>
                  <div class="meta-value">Not Checked</div>
                </div>
              </div>
            </section>

            <section class="summary-row">
              <div class="summary-card primary">
                <div class="summary-title">Batch Verdict</div>
                <div class="summary-value">${escapeHtml(caseVerdict || verdictText(run.overallDecision))}</div>
                <div class="summary-note">${escapeHtml(executiveSummary)}</div>
              </div>
              <div class="summary-card">
                <div class="summary-title">Risk Score</div>
                <div class="summary-value">${overallRisk}%</div>
                <div class="summary-note">Composite forensic risk across uploaded files.</div>
              </div>
              <div class="summary-card">
                <div class="summary-title">Identity Match</div>
                <div class="summary-value">${escapeHtml(identitySimilarity)}</div>
                <div class="summary-note">Cross-document name, DOB, and address alignment.</div>
              </div>
              <div class="summary-card">
                <div class="summary-title">Document Count</div>
                <div class="summary-value">${files.length}</div>
                <div class="summary-note">Up to 10 documents are shown in the verification matrix.</div>
              </div>
            </section>

            <section class="subject-section">
              <h2 class="section-heading">Subject Details</h2>
              <p class="section-subcopy">Primary KYC details inferred from the uploaded documents for the person under verification.</p>
              <div class="subject-grid">
                ${subjectDetails
                  .map(
                    (item) => `
                      <div class="subject-card">
                        <div class="subject-label">${escapeHtml(item.label)}</div>
                        <div class="subject-value">${escapeHtml(item.value)}</div>
                        <div class="subject-note">${escapeHtml(item.note)}</div>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </section>

            <section class="matrix-wrap">
              <div class="matrix-head">
                <h2>Cross-Verification Matrix</h2>
                <div class="legend">
                  <span><span class="chip ok">&#10003;</span>Pass</span>
                  <span><span class="chip warn">!</span>Review</span>
                  <span><span class="chip bad">&#10005;</span>Risk</span>
                  <span><span class="chip na">&mdash;</span>Unavailable</span>
                </div>
              </div>

              <div class="matrix-summary">
                <div class="matrix-summary-card compact primary">
                  <div class="matrix-summary-label">Batch Verdict</div>
                  <div class="matrix-summary-value">${escapeHtml(caseVerdict || verdictText(run.overallDecision))}</div>
                  <div class="matrix-summary-note">${escapeHtml(correlationSummary)}</div>
                </div>
                <div class="matrix-summary-card compact issue ${escapeHtml(issueSummary.statusClass)}">
                  <div class="matrix-summary-label">Issue Check</div>
                  <div class="matrix-summary-badge">${escapeHtml(issueSummary.badge)}</div>
                  <div class="matrix-summary-value">${escapeHtml(issueSummary.title)}</div>
                  <div class="matrix-summary-note">${escapeHtml(issueSummary.copy)}</div>
                </div>
                <div class="matrix-summary-card compact">
                  <div class="matrix-summary-label">Identity Summary</div>
                  <div class="matrix-summary-value">${escapeHtml(identitySummary)}</div>
                  <div class="matrix-summary-note">Derived from returned identity fields.</div>
                </div>
                <div class="matrix-summary-card compact">
                  <div class="matrix-summary-label">Date Summary</div>
                  <div class="matrix-summary-value">${escapeHtml(canonicalDob || 'Insufficient date data')}</div>
                  <div class="matrix-summary-note">DOB shown only when OCR identity data is available.</div>
                </div>
              </div>

              <div class="matrix-scroll">
                <table class="matrix">
                  <thead>
                    <tr>
                      <th>Verification Check</th>
                      ${docHeaders}
                    </tr>
                  </thead>
                  <tbody>
                    ${matrixBody}
                  </tbody>
                </table>
              </div>
            </section>

            <section class="flagged-section">
              <h2 class="section-heading">Flagged Documents</h2>
              <p class="section-subcopy">Documents that need review or carry the highest forensic concern in the current batch.</p>
              ${
                issueBullets.length > 0
                  ? `
                    <div class="flagged-grid">
                      ${issueListPreview}
                    </div>
                  `
                  : `<div class="matrix-summary-note">${escapeHtml(issueListPreview)}</div>`
              }
            </section>

            <section class="bottom">
              <div class="note-box">
                <h3>Cross-Document Findings</h3>
                <ul>
                  <li><strong>Name Correlation:</strong> ${escapeHtml(canonicalName || 'No consistent name extracted across the batch.')}</li>
                  <li><strong>DOB Correlation:</strong> ${escapeHtml(canonicalDob || 'No DOB correlation available from returned payload.')}</li>
                  <li><strong>Address Correlation:</strong> ${escapeHtml(canonicalAddress || 'No address correlation available from returned payload.')}</li>
                  <li><strong>Batch Correlation:</strong> ${escapeHtml(correlationSummary)}</li>
                  <li><strong>Material Exceptions:</strong> ${escapeHtml(exceptionSummary)}</li>
                </ul>
              </div>

              <div class="note-box">
                <h3>Analyst / Model Notes</h3>
                <p>${escapeHtml(analystNotes || 'No additional model narrative was returned for this batch.')}</p>
                <p style="margin-top: 10px;"><strong>Recommendation:</strong> ${escapeHtml(executiveSummary)}</p>
              </div>
            </section>

            <section class="closing-summary">
              <h2 class="section-heading">Final KYC Summary</h2>
              <p class="section-subcopy">High-level takeaways placed at the end of the report for quick reviewer sign-off.</p>
              <div class="closing-summary-grid">
                <div class="closing-panel">
                  <h4>Summary</h4>
                  <ul>
                    ${finalSummaryBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                  </ul>
                </div>
                <div class="closing-panel">
                  <h4>Decision</h4>
                  <p><strong>${escapeHtml(caseVerdict || verdictText(run.overallDecision))}</strong></p>
                  <p style="margin-top: 10px;">${escapeHtml(executiveSummary)}</p>
                </div>
              </div>
            </section>

            <section class="footer">
              <div>Prepared by <strong>Reagvis Labs</strong> · Automated Forensic Intelligence Stack · Confidential Internal Report</div>
              <div>Verification Policy: <span class="mono">${escapeHtml(footerPolicy)}</span></div>
            </section>
          </div>
        </div>
      </body>
    </html>
  `;
};

export function ForensicReportFrame({ run, batchMeta }: ForensicReportFrameProps) {
  const reportHtml = useMemo(() => buildReportHtml(run, batchMeta), [run, batchMeta]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel2)]/30 p-3">
      <iframe
        title={`Forensic report for ${run.runId}`}
        srcDoc={reportHtml}
        className="h-[980px] w-full rounded-lg border border-[var(--border)] bg-white"
      />
    </div>
  );
}

const buildPrintableReportElement = (run: ReportRun, batchMeta?: BatchMeta) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(buildReportHtml(run, batchMeta), 'text/html');
  const page = doc.querySelector('.page');

  if (!page) {
    throw new Error('Unable to prepare report for PDF export.');
  }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1400px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1';

  const style = document.createElement('style');
  style.textContent = reportStyles;
  container.appendChild(style);
  container.appendChild(document.importNode(page, true));
  document.body.appendChild(container);

  return container;
};

const sanitizeFileName = (value: string) =>
  value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();

export async function downloadForensicReportPdf(run: ReportRun, batchMeta?: BatchMeta) {
  const container = buildPrintableReportElement(run, batchMeta);

  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule as any).default || html2pdfModule;
    const baseName = sanitizeFileName(run.runId || run.id || 'report') || 'report';

    await html2pdf()
      .set({
        margin: 0,
        filename: `reagvis-forensic-report-${baseName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'landscape',
        },
      })
      .from(container)
      .save();
  } finally {
    container.remove();
  }
}
