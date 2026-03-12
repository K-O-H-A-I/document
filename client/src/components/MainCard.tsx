import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainCardProps {
  onAnalyze: (data: { files: File[] }) => void;
  isAnalyzing: boolean;
  isDisabled?: boolean;
  disabledReason?: string | null;
}

type SelectedFile = {
  id: string;
  signature: string;
  file: File;
  sizeLabel: string;
  error?: string;
};

const MAX_FILES = 3;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

export function MainCard({ onAnalyze, isAnalyzing, isDisabled, disabledReason }: MainCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openingPickerRef = useRef(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return "";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const isAcceptedFile = (file: File) => {
    const name = file.name.toLowerCase();
    const hasExtension = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
    const hasType = ACCEPTED_TYPES.includes(file.type);
    return hasExtension || hasType;
  };

  const buildSignature = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

  const mapFile = (file: File) => {
    let error = "";
    if (!isAcceptedFile(file)) {
      error = "Only JPG/JPEG/PNG allowed.";
    }
    if (file.size > MAX_IMAGE_SIZE) {
      error = error
        ? `${error} File exceeds 10MB.`
        : "File exceeds 10MB.";
    }
    return {
      id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
      signature: buildSignature(file),
      file,
      sizeLabel: formatBytes(file.size),
      error: error || undefined,
    };
  };

  const processFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;

    const nextErrors: string[] = [];
    const nextWarnings: string[] = [];
    setSelectedFiles((prev) => {
      const existingSignatures = new Set(prev.map((item) => item.signature));
      const availableSlots = Math.max(0, MAX_FILES - prev.length);
      const accepted: SelectedFile[] = [];
      let remainingSlots = availableSlots;

      for (const file of incoming) {
        const signature = buildSignature(file);
        if (existingSignatures.has(signature)) {
          nextWarnings.push(`File already added: ${file.name}`);
          continue;
        }
        if (remainingSlots <= 0) {
          nextWarnings.push("Max 3 files allowed. Extra files were ignored.");
          break;
        }
        existingSignatures.add(signature);
        accepted.push(mapFile(file));
        remainingSlots -= 1;
      }

      return [...prev, ...accepted];
    });

    setErrors(nextErrors);
    setWarnings(nextWarnings);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    processFiles(incoming);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const hasErrors = errors.length > 0 || selectedFiles.some((file) => file.error);

  const handleRemove = (id: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.id !== id));
    setErrors([]);
    setWarnings([]);
  };

  const handleRun = () => {
    if (hasErrors || selectedFiles.length === 0 || isDisabled) return;
    const files = selectedFiles.filter((file) => !file.error).map((item) => item.file);
    if (files.length === 0) return;
    onAnalyze({ files });
  };

  const openPicker = () => {
    if (openingPickerRef.current) return;
    openingPickerRef.current = true;
    fileInputRef.current?.click();
    window.setTimeout(() => {
      openingPickerRef.current = false;
    }, 300);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    processFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  // Render content based on tool type
  const renderContent = () => {
    return (
      <div className="space-y-4">
        <div 
          className="file-drop-area compact group bg-[var(--panel)] border-border hover:bg-[var(--panel2)]/50 hover:border-[var(--accent)] transition-all duration-300 shadow-[var(--shadow)] hover:shadow-[var(--shadow-strong)]"
          onClick={openPicker}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileSelect}
            accept="image/jpeg,image/png"
            multiple
          />
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
            <UploadCloud className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-[var(--text)]">Drop files or click</span>
            <span className="text-[10px] text-[var(--muted)] ml-2">Document files</span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
            className="btn btn-secondary hover-elevate active-elevate-2 px-3 py-1 text-[10px] shrink-0"
          >
            {isAnalyzing ? "Processing" : "Select"}
          </button>
        </div>

        <div className="text-xs text-[var(--muted)]">
          Max 3 files • JPG/PNG ≤ 10MB
        </div>

        {errors.length > 0 && (
          <div className="text-xs text-[var(--danger)] border border-[var(--danger)]/30 bg-[var(--danger)]/5 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              {errors.map((error, idx) => (
                <div key={`${error}-${idx}`}>{error}</div>
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="text-xs text-[var(--muted)] border border-[var(--border)] bg-[var(--panel2)]/60 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--muted)]" />
            <div className="space-y-1">
              {warnings.map((warning, idx) => (
                <div key={`${warning}-${idx}`}>{warning}</div>
              ))}
            </div>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            {selectedFiles.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 bg-[var(--panel)]",
                  item.error
                    ? "border-[var(--danger)]/30 bg-[var(--danger)]/5"
                    : "border-[var(--border)]"
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-[var(--panel2)] border border-[var(--border)] flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text)] truncate" title={item.file.name}>
                    {item.file.name}
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Image • {item.sizeLabel}
                  </div>
                  {item.error && (
                    <div className="text-[11px] text-[var(--danger)] mt-2">
                      {item.error}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="btn btn-ghost p-2 rounded-full hover:bg-[var(--panel2)]"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[var(--muted)]">
            {selectedFiles.length === 0
              ? "Select up to 3 files to begin."
              : `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} ready.`}
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={isAnalyzing || selectedFiles.length === 0 || hasErrors || !!isDisabled}
            className={cn(
              "min-h-[44px] px-[18px] py-3 text-xs font-bold uppercase tracking-wider rounded-[var(--radius)] border shadow-[var(--shadow)] transition-all",
              "hover:-translate-y-[1px] hover:shadow-[var(--shadow-strong)]",
              "active:scale-[0.98] disabled:opacity-100 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0",
              "bg-[var(--panel)] text-[var(--text)] border-[var(--accent)]",
              "disabled:bg-[var(--panel2)] disabled:text-[var(--muted)] disabled:border-[var(--border)]"
            )}
          >
            {isAnalyzing ? "Processing" : "Run Verification"}
          </button>
        </div>
        {isDisabled && disabledReason && (
          <div className="text-[11px] text-[var(--danger)]">{disabledReason}</div>
        )}
      </div>
    );
  };

  const getToolInfo = () => {
    return {
      title: "Document Forensics",
      icon: FileText,
      desc: "Analyze documents for digital alteration and manipulation.",
    };
  };

  const info = getToolInfo();
  const Icon = info.icon;

  return (
    <div className="card hover-lift p-1 md:p-2 mb-8">
      <div className="bg-[var(--panel2)]/50 rounded-lg p-6 md:p-8">
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 bg-[var(--accent)]/10 rounded-xl">
            <Icon className="w-8 h-8 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-2">{info.title}</h2>
            <p className="text-[var(--muted)]">{info.desc}</p>
          </div>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
