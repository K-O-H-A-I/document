import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { NavBar } from '@/components/NavBar';
import { KpiTiles } from '@/components/KpiTiles';
import { MainCard } from '@/components/MainCard';
import { useAnalysisSimulation } from '@/hooks/use-analysis-simulation';
import { Search, Download, Loader2, ChevronDown, FileText, X, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnalysisResult, ToolType } from '@shared/schema';

type Decision = 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
type PanelKey = 'qwen' | 'gpt';

type FileResult = {
  id: string;
  name: string;
  sizeLabel: string;
  isPdf: boolean;
  previewUrl: string | null;
  verdict: string;
  riskScore: number;
  decision: Decision;
  summary: string | null;
  createdAt: Date;
};

type AnalysisRun = {
  id: string;
  runId: string;
  createdAt: Date;
  overallDecision: Decision;
  files: FileResult[];
};

const decisionOrder: Record<Decision, number> = {
  APPROVE: 1,
  MANUAL_REVIEW: 2,
  REJECT: 3,
};

const decisionLabel: Record<Decision, string> = {
  APPROVE: 'Approve',
  MANUAL_REVIEW: 'Manual Review',
  REJECT: 'Reject',
};

const decisionPillClass: Record<Decision, string> = {
  APPROVE: 'bg-[var(--ok)]/10 text-[var(--ok)] border-[var(--ok)]/30',
  MANUAL_REVIEW: 'bg-[var(--grad-orange-start)]/10 text-[var(--grad-orange-start)] border-[var(--grad-orange-start)]/30',
  REJECT: 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30',
};

const decisionTextClass: Record<Decision, string> = {
  APPROVE: 'text-[var(--ok)]',
  MANUAL_REVIEW: 'text-[var(--grad-orange-start)]',
  REJECT: 'text-[var(--danger)]',
};

const formatRunTime = (date: Date) => {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const toFileResult = (result: AnalysisResult): FileResult => {
  const filename = result.filename || 'Untitled';
  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const createdAt = result.timestamp ? new Date(result.timestamp) : new Date();
  const summary = typeof result.summary === 'string' && result.summary.trim().length > 0
    ? result.summary
    : null;
  const verdict =
    result.riskScore >= 70
      ? 'Suspicious'
      : result.riskScore <= 30
        ? 'Authentic Likely'
        : 'Uncertain';

  return {
    id: String(result.id),
    name: filename,
    sizeLabel: '—',
    isPdf,
    previewUrl: result.previewUrl || null,
    verdict,
    riskScore: result.riskScore,
    decision: result.decision as Decision,
    summary,
    createdAt,
  };
};

const toRuns = (results: AnalysisResult[]): AnalysisRun[] => {
  const grouped = new Map<string, FileResult[]>();

  results.forEach((result) => {
    const batchId = result.batchId || `result-${result.id}`;
    const file = toFileResult(result);
    const existing = grouped.get(batchId);
    if (existing) {
      existing.push(file);
    } else {
      grouped.set(batchId, [file]);
    }
  });

  return Array.from(grouped.entries())
    .map(([batchId, files]) => {
      const createdAt = files.reduce(
        (latest, item) => (item.createdAt > latest ? item.createdAt : latest),
        files[0]?.createdAt || new Date()
      );
      const overallDecision = files.reduce<Decision>((acc, item) => {
        return decisionOrder[item.decision] > decisionOrder[acc] ? item.decision : acc;
      }, 'APPROVE');
      return {
        id: batchId,
        runId: batchId,
        createdAt,
        overallDecision,
        files,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

const historyBadge = (score: number) => {
  if (score >= 70) return { label: "High Risk", className: "text-[var(--danger)]" };
  if (score >= 31) return { label: "Uncertain", className: "text-[var(--grad-orange-start)]" };
  return { label: "Authentic Likely", className: "text-[var(--ok)]" };
};

export default function Home() {
  const activeTool: ToolType = 'document';
  const {
    isAnalyzing,
    results,
    stats,
    toastMessage,
    runAnalysis,
    refreshStats,
    loadHistory,
    usageStats,
    scanDisabled,
    scanDisabledReason,
    historyItems,
  } = useAnalysisSimulation();

  const safeResults = Array.isArray(results) ? results : [];
  const qwenRuns = useMemo(
    () => toRuns(safeResults.filter((item) => item.toolType === activeTool)),
    [safeResults, activeTool]
  );
  const gptRuns: AnalysisRun[] = [];
  const safeHistoryItems = Array.isArray(historyItems) ? historyItems : [];

  const [loading, setLoading] = useState({ qwen: false, gpt: false });
  const [expandedRuns, setExpandedRuns] = useState<{ qwen: Record<string, boolean>; gpt: Record<string, boolean> }>({
    qwen: {},
    gpt: {},
  });
  const [previewFile, setPreviewFile] = useState<FileResult | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setLoading({ qwen: isAnalyzing, gpt: false });
  }, [isAnalyzing]);

  useEffect(() => {
    refreshStats();
    loadHistory();
  }, [refreshStats, loadHistory]);

  useEffect(() => {
    if (!previewFile) return;
    setPreviewZoom(1);
  }, [previewFile]);

  useEffect(() => {
    if (!previewFile) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFile]);

  useEffect(() => {
    if (!previewFile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewFile]);

  const handleExport = () => {
    if (results.length === 0) return;
    const exportData = {
      generatedAt: new Date().toISOString(),
      appName: 'Reagvis Labs Pvt. Ltd.',
      activeTool,
      summary: {
        total: stats.total,
        rejected: stats.rejected,
        manualReview: stats.manual,
        approved: stats.approved,
      },
      results,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(exportData, null, 2));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').split('Z')[0];
    const filename = `reagvis-labs-report-${timestamp}.json`;

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const toggleExpand = (panel: PanelKey, runId: string) => {
    setExpandedRuns((prev) => ({
      ...prev,
      [panel]: {
        ...prev[panel],
        [runId]: !prev[panel][runId],
      },
    }));
  };

  const renderPanel = (panel: PanelKey, title: string, runs: AnalysisRun[]) => {
    const isLoading = panel === 'qwen' ? loading.qwen : loading.gpt;

    return (
      <div className="card p-6 bg-[var(--panel)]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
          </div>
          <div className="text-xs text-[var(--muted)]">
            {runs.length} run{runs.length === 1 ? '' : 's'}
          </div>
        </div>

        {isLoading && (
          <div className="border border-dashed border-[var(--border)] rounded-lg p-4 flex items-center gap-3 text-sm text-[var(--muted)] mb-4">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
            Processing batch...
          </div>
        )}

        {!isLoading && runs.length === 0 && (
          <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-xl bg-[var(--panel2)]">
            <div className="w-14 h-14 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
              <Search className="w-7 h-7 text-[var(--muted)]" />
            </div>
            <h4 className="text-base font-medium text-[var(--text)] mb-2">No analysis yet</h4>
            <p className="text-[var(--muted)] text-sm">Upload up to 3 files to start.</p>
          </div>
        )}

        <div className="space-y-4">
          {runs.map((run) => {
            const isExpanded = !!expandedRuns[panel][run.id];
            const batchRisk = run.files.reduce((max, file) => Math.max(max, file.riskScore), 0);
            const batchVerdict: Decision = run.files.some((file) => file.decision === 'REJECT')
              ? 'REJECT'
              : run.files.some((file) => file.decision === 'MANUAL_REVIEW')
                ? 'MANUAL_REVIEW'
                : 'APPROVE';
            const approveCount = run.files.filter((file) => file.decision === 'APPROVE').length;
            const rejectCount = run.files.filter((file) => file.decision === 'REJECT').length;
            const manualCount = run.files.filter((file) => file.decision === 'MANUAL_REVIEW').length;
            return (
              <div
                key={run.id}
                className="border border-[var(--border)] rounded-xl bg-[var(--panel)] p-4 shadow-[var(--shadow)] transition-all hover-lift"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] text-[var(--muted)]">
                      Run: {formatRunTime(run.createdAt)}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-1">
                      Files: {(Array.isArray(run.files) ? run.files : [])
                        .map((file) => file.name)
                        .join(", ")}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                          decisionPillClass[batchVerdict]
                        )}
                      >
                        {decisionLabel[batchVerdict]}
                      </span>
                      <span className="text-xs text-[var(--muted)]">Batch Risk: {batchRisk}%</span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-2">
                      {approveCount} Approve • {rejectCount} Reject • {manualCount} Manual
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExpand(panel, run.id)}
                    className="btn btn-ghost px-3 py-2 text-xs uppercase tracking-wider"
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                    <ChevronDown
                      className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')}
                    />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {(Array.isArray(run.files) ? run.files : []).slice(0, 3).map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        if (file.previewUrl) {
                          setPreviewFile(file);
                        }
                      }}
                      disabled={!file.previewUrl}
                      className={cn(
                        "w-12 h-12 rounded-lg border border-[var(--border)] bg-[var(--panel2)] flex items-center justify-center overflow-hidden transition-all",
                        file.previewUrl
                          ? "cursor-pointer hover:-translate-y-[1px] hover:shadow-[var(--shadow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
                          : "cursor-not-allowed opacity-70"
                      )}
                      aria-label={`Preview ${file.name}`}
                    >
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-[var(--muted)]" />
                      )}
                    </button>
                  ))}
                  {(Array.isArray(run.files) ? run.files : []).length > 3 && (
                    <div className="text-xs text-[var(--muted)]">
                      +{(Array.isArray(run.files) ? run.files : []).length - 3}
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                  {(Array.isArray(run.files) ? run.files : []).map((file) => (
                    <div key={`${file.id}-name`} className="truncate" title={file.name}>
                      {file.name}
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 grid gap-3">
                        {(Array.isArray(run.files) ? run.files : []).map((file) => (
                          <div
                            key={`${file.id}-detail`}
                            className="rounded-lg border border-[var(--border)] bg-[var(--panel2)]/60 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold text-[var(--text)] truncate" title={file.name}>
                                  {file.name}
                                </div>
                                <div className="text-[11px] text-[var(--muted)]">
                                  {file.isPdf ? 'PDF' : 'Image'} • {file.sizeLabel} • Verdict: {file.verdict}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-[var(--text)]">{file.riskScore}%</div>
                                <div className={cn('text-[11px] font-bold uppercase', decisionTextClass[file.decision])}>
                                  {decisionLabel[file.decision]}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-[var(--muted)]">
                              {file.summary || 'Summary unavailable.'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const modalContent = previewFile ? (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={() => setPreviewFile(null)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-[min(96vw,1400px)] h-[92vh] bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-strong)] flex flex-col overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 p-4 border-b border-[var(--border)]">
            <div>
              <div className="text-sm font-semibold text-[var(--text)] truncate" title={previewFile.name}>
                {previewFile.name}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {previewFile.isPdf ? 'PDF' : 'Image'} • {previewFile.sizeLabel} • Verdict: {previewFile.verdict}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!previewFile.isPdf && (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((prev) => Math.max(1, prev - 0.25))}
                    className="btn btn-ghost p-2 rounded-full"
                    aria-label="Zoom out"
                    disabled={previewZoom <= 1}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom((prev) => Math.min(2.5, prev + 0.25))}
                    className="btn btn-ghost p-2 rounded-full"
                    aria-label="Zoom in"
                    disabled={previewZoom >= 2.5}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                ref={closeButtonRef}
                onClick={() => setPreviewFile(null)}
                className="btn btn-ghost p-2 rounded-full"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-[var(--panel2)]/40 flex items-center justify-center overflow-hidden">
            {previewFile.isPdf ? (
              <div className="flex flex-col items-center gap-3 text-center p-6">
                <FileText className="w-10 h-10 text-[var(--muted)]" />
                <div className="text-sm text-[var(--text)]">PDF preview</div>
                <div className="text-xs text-[var(--muted)]">Open the file to view the full document.</div>
                <button
                  type="button"
                  onClick={() => {
                    if (previewFile.previewUrl) window.open(previewFile.previewUrl, '_blank');
                  }}
                  disabled={!previewFile.previewUrl}
                  className="btn btn-secondary h-9 px-4 text-xs font-semibold uppercase tracking-wider disabled:opacity-100 disabled:cursor-not-allowed"
                  aria-label="Open PDF"
                >
                  Open PDF
                </button>
              </div>
            ) : (
              previewFile.previewUrl && (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={previewFile.previewUrl}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain transition-transform"
                    style={{ transform: `scale(${previewZoom})` }}
                  />
                </div>
              )
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ) : null;

  return (
    <div className="min-h-screen pb-20 font-sans app-shell">
      <NavBar />

      <main className="max-w-[1280px] mx-auto px-6 pt-8 relative z-10">
        {/* Hero Section */}
        <div className="mb-8 text-center md:text-left section-glow">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6"
          >
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-[var(--text)] tracking-tight mb-4 leading-tight">
                TrustTrace
              </h1>
              <p className="text-lg md:text-xl text-[var(--muted)] max-w-2xl leading-relaxed">
                Analyze digital assets using AI-driven forensics and semantic analysis.
              </p>
            </div>

            <button
              onClick={handleExport}
              disabled={results.length === 0}
              className="btn btn-secondary disabled:opacity-100 disabled:cursor-not-allowed active:scale-[0.98] h-11 px-6 text-sm font-semibold tracking-wide uppercase transition-all hover-elevate"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </motion.div>
        </div>

        {/* KPI Tiles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <KpiTiles stats={stats} />
          {usageStats && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-[var(--muted)]">
              <span>
                Today Usage: {usageStats.tokens_used_today} / {usageStats.token_limit_daily}
              </span>
              <span className="hidden sm:inline">•</span>
              <span>Total Scans: {usageStats.total_scans}</span>
            </div>
          )}
        </motion.div>

        {/* Main Analysis Card */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="section-glow"
        >
          <MainCard
            onAnalyze={(data) => runAnalysis({ ...data, toolType: activeTool })}
            isAnalyzing={isAnalyzing}
            isDisabled={scanDisabled}
            disabledReason={scanDisabledReason}
          />
        </motion.div>

        {/* Results Section */}
        <div className="mt-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="heading-2">Recent Analysis</h2>
              <p className="text-sm text-[var(--muted)]">Document analysis results.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                className="btn btn-secondary h-9 px-3 text-xs font-semibold tracking-wide uppercase"
                aria-label="Refresh page"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
              <span className="text-xs text-[var(--muted)]">
                {qwenRuns.length} run{qwenRuns.length === 1 ? '' : 's'} total
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-6"
          >
            {renderPanel('qwen', 'Recent Analysis', qwenRuns)}
          </motion.div>
        </div>

        {/* Recent History */}
        <div className="mt-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="heading-2">Recent History</h2>
              <p className="text-sm text-[var(--muted)]">Latest scans from your account.</p>
            </div>
          </div>

          {safeHistoryItems.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-xl bg-[var(--panel2)]">
              <div className="w-12 h-12 rounded-full bg-[var(--border)] flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-[var(--muted)]" />
              </div>
              <h4 className="text-base font-medium text-[var(--text)] mb-2">No history yet</h4>
              <p className="text-[var(--muted)] text-sm">Run a scan to populate recent history.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeHistoryItems.slice(0, 6).map((item, index) => {
                const score = Math.max(0, Math.min(100, Math.round(item.risk_score)));
                const badge = historyBadge(score);
                const timestamp = item.scan_time
                  ? new Date(item.scan_time)
                  : new Date();
                const label = timestamp.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={`${item.key}-${index}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {badge.label} — {label}
                      </div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        {item.summary || "Summary unavailable."}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--text)]">{score}%</div>
                      <div className={cn("text-xs font-semibold uppercase", badge.className)}>
                        {badge.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {modalContent && ReactDOM.createPortal(modalContent, document.body)}

      {/* Floating Processing Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 50, x: 20 }}
            className="fixed bottom-8 right-8 z-[100] bg-[var(--panel)] border border-[var(--border)] shadow-[var(--shadow-strong)] rounded-[var(--radius)] p-4 flex items-center gap-4 min-w-[300px]"
          >
            {isAnalyzing ? (
              <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
            ) : (
              <div className="w-3 h-3 rounded-full bg-[var(--ok)] shadow-[0_0_12px_var(--ok)]" />
            )}
            <div className="flex flex-col">
              <span className="font-bold text-[var(--text)] text-sm tracking-tight">
                {isAnalyzing ? 'Processing...' : 'Action Complete'}
              </span>
              <span className="text-[var(--muted)] text-xs font-medium">{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
