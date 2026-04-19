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
    padding: 22px 24px;
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
    gap: 14px;
  }
  .header {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 18px;
    border-bottom: 1px solid var(--line-strong);
    padding-bottom: 14px;
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
  }
  .brand-block h1 {
    margin: 0;
    font-size: 24px;
    letter-spacing: 0.4px;
  }
  .brand-block .sub {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.45;
  }
  .meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    align-content: start;
  }
  .meta-card {
    border: 1px solid var(--line);
    background: linear-gradient(180deg, #fbfdff 0%, #f3f7fb 100%);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .meta-label {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .meta-value {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
    word-break: break-word;
  }
  .summary-row {
    display: grid;
    grid-template-columns: 1.35fr .85fr .85fr .85fr;
    gap: 12px;
  }
  .summary-card {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #f5f9fd 100%);
    min-height: 94px;
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
    margin-bottom: 7px;
  }
  .summary-value {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.05;
    margin-bottom: 6px;
  }
  .summary-note {
    font-size: 11px;
    line-height: 1.45;
    color: var(--muted);
  }
  .summary-card.primary .summary-note { color: rgba(255,255,255,.86); }
  .matrix-wrap {
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
  }
  .matrix-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background: linear-gradient(90deg, #f1f6fb, #f8fbfe);
    border-bottom: 1px solid var(--line);
  }
  .matrix-head h2 {
    margin: 0;
    font-size: 15px;
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
    gap: 8px;
    padding: 12px 14px;
    background: linear-gradient(180deg, #fbfdff 0%, #f4f8fc 100%);
    border-bottom: 1px solid var(--line);
  }
  .matrix-summary-card {
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #fff;
    padding: 10px 11px;
    min-height: 60px;
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
    line-height: 1.35;
    color: var(--muted);
  }
  table.matrix {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 11px;
  }
  .matrix thead th {
    background: #f7fafc;
    border-bottom: 1px solid var(--line);
    border-right: 1px solid var(--line);
    padding: 10px 6px;
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
    padding: 8px 6px;
    text-align: center;
    vertical-align: middle;
  }
  .matrix tbody th {
    text-align: left;
    font-weight: 700;
    background: #fbfdff;
    padding-left: 14px;
    line-height: 1.2;
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
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 3px;
    line-height: 1.2;
    word-break: break-word;
  }
  .doc-type {
    display: block;
    font-size: 10px;
    color: var(--muted);
    line-height: 1.2;
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
    font-size: 10px;
    color: var(--muted);
    line-height: 1.2;
    word-break: break-word;
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
    gap: 12px;
  }
  .note-box {
    border: 1px solid var(--line);
    border-radius: 11px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    padding: 12px 14px;
  }
  .note-box h3 {
    margin: 0 0 8px 0;
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
    gap: 6px;
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
  const files = run.files.slice(0, 8);
  const overallRisk =
    typeof batchMeta?.overallRisk === 'number'
      ? Math.round(batchMeta.overallRisk)
      : Math.max(...files.map((file) => file.riskScore), 0);
  const identitySimilarity =
    typeof batchMeta?.identitySimilarity === 'number'
      ? `${Math.round(batchMeta.identitySimilarity)}%`
      : 'N/A';
  const correlationSummary = batchMeta?.correlation?.conclusion?.trim() || 'Cross-document review completed.';
  const analystNotes =
    batchMeta?.correlation?.story?.trim() ||
    files
      .map((file) => file.summary?.trim())
      .filter((summary): summary is string => Boolean(summary))
      .join(' ');

  const canonicalName = collectComparableValue(files, (file) => file.identity?.name);
  const canonicalDob = collectComparableValue(files, (file) => file.identity?.dob);
  const canonicalAddress = collectComparableValue(files, (file) => file.identity?.address);

  const executiveSummary =
    run.overallDecision === 'REJECT'
      ? 'One or more uploaded documents show high-risk forensic signals and require rejection.'
      : run.overallDecision === 'MANUAL_REVIEW'
        ? 'The batch contains mixed authenticity signals and should be manually reviewed before approval.'
        : 'The uploaded documents show acceptable consistency against the currently available forensic checks.';

  const identitySummary =
    canonicalName || canonicalDob || canonicalAddress
      ? `Primary identity anchors detected across ${files.length} document${files.length === 1 ? '' : 's'}.`
      : 'Identity fields were limited in the returned analysis payload.';

  const exceptionSummary = files
    .filter((file) => file.decision !== 'APPROVE')
    .map((file) => `${file.name}: ${verdictText(file.decision)}`)
    .join('; ') || 'No material exceptions flagged.';

  const rowBuilders: Array<{ label: string; build: (file: ReportFile) => MatrixCell }> = [
    {
      label: 'KYC Verdict',
      build: (file) => ({
        tone: file.decision === 'REJECT' ? 'bad' : file.decision === 'MANUAL_REVIEW' ? 'warn' : 'ok',
        note: verdictText(file.decision),
      }),
    },
    {
      label: 'Authenticity Signals',
      build: (file) => ({
        tone: getRiskTone(file.riskScore),
        note: `${file.riskScore}% risk`,
      }),
    },
    {
      label: 'Security / Tamper Check',
      build: (file) => ({
        tone: getRiskTone(file.riskScore),
        note: file.summary?.trim() || 'Derived from model risk score',
      }),
    },
    {
      label: 'OCR / Data Extraction',
      build: (file) => {
        const confidence = file.identity?.confidence;
        if (typeof confidence === 'number') {
          return {
            tone: confidence >= 0.85 ? 'ok' : confidence >= 0.6 ? 'warn' : 'bad',
            note: `OCR confidence ${(confidence * 100).toFixed(0)}%`,
          };
        }
        if (file.identity?.name || file.identity?.dob || file.identity?.address) {
          return { tone: 'warn', note: 'Partial identity extracted' };
        }
        return { tone: 'na', note: 'No OCR payload' };
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
      build: (file) => {
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
      build: (file) => {
        const isAcademic = /degree|certificate|marks|transcript|diploma/i.test(file.name);
        return isAcademic ? { tone: 'warn', note: 'Requires issuer check' } : { tone: 'na', note: 'Not applicable' };
      },
    },
    {
      label: 'Certificate / Degree Genuine',
      build: (file) => {
        const isAcademic = /degree|certificate|marks|transcript|diploma/i.test(file.name);
        return isAcademic ? { tone: 'warn', note: 'Manual validation pending' } : { tone: 'na', note: 'Not applicable' };
      },
    },
    {
      label: 'Marks / CGPA / Grade Consistency',
      build: (file) => {
        const isAcademic = /marks|grade|cgpa|transcript/i.test(file.name);
        return isAcademic ? { tone: 'warn', note: 'No structured marks payload' } : { tone: 'na', note: 'Not applicable' };
      },
    },
    {
      label: 'Date Correlation Across Batch',
      build: (file) => {
        if (files.length <= 1) return { tone: 'na', note: 'Single document batch' };
        return buildMatchCell(file.identity?.dob, canonicalDob, 'Date');
      },
    },
    {
      label: 'Issue / Exam / Academic Timeline Plausible',
      build: (file) => {
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
      build: (file) => ({
        tone: getRiskTone(file.riskScore),
        note: verdictText(file.decision),
        score: file.riskScore,
      }),
    },
  ];

  const matrixRows: MatrixRow[] = rowBuilders.map((row) => ({
    label: row.label,
    cells: files.map((file) => row.build(file)),
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

  const footerPolicy = batchMeta?.correlation?.confidence
    ? `Correlation confidence ${(batchMeta.correlation.confidence * 100).toFixed(0)}%`
    : 'Policy version not supplied by API';

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
                <div class="logo">RL</div>
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
                  <div class="meta-label">Batch / Case Ref</div>
                  <div class="meta-value mono">${escapeHtml(run.runId)}</div>
                </div>
              </div>
            </section>

            <section class="summary-row">
              <div class="summary-card primary">
                <div class="summary-title">Executive Summary</div>
                <div class="summary-value">${escapeHtml(verdictText(run.overallDecision))}</div>
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
                <div class="summary-note">Up to 8 documents are shown in the verification matrix.</div>
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
                <div class="matrix-summary-card primary">
                  <div class="matrix-summary-label">Batch Verdict</div>
                  <div class="matrix-summary-value">${escapeHtml(verdictText(run.overallDecision))}</div>
                  <div class="matrix-summary-note">${escapeHtml(correlationSummary)}</div>
                </div>
                <div class="matrix-summary-card">
                  <div class="matrix-summary-label">Identity Summary</div>
                  <div class="matrix-summary-value">${escapeHtml(identitySummary)}</div>
                  <div class="matrix-summary-note">Based on identity fields returned by the API.</div>
                </div>
                <div class="matrix-summary-card">
                  <div class="matrix-summary-label">Date Summary</div>
                  <div class="matrix-summary-value">${escapeHtml(canonicalDob || 'Insufficient date data')}</div>
                  <div class="matrix-summary-note">DOB matching is only available when OCR identity data is returned.</div>
                </div>
                <div class="matrix-summary-card">
                  <div class="matrix-summary-label">Exception Summary</div>
                  <div class="matrix-summary-value">${escapeHtml(exceptionSummary)}</div>
                  <div class="matrix-summary-note">Highest risk or review items in the batch.</div>
                </div>
              </div>

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
