import React, { useRef, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';

interface MainCardProps {
  onAnalyze: (data: { files: File[] }) => void;
  isAnalyzing: boolean;
}

export function MainCard({ onAnalyze, isAnalyzing }: MainCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    onAnalyze({ files });
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Render content based on tool type
  const renderContent = () => {
    return (
      <div className="space-y-4">
        <div 
          className="file-drop-area compact group bg-[var(--panel)] border-border hover:bg-[var(--panel2)]/50 hover:border-[var(--accent)] transition-all duration-300 shadow-[var(--shadow)] hover:shadow-[var(--shadow-strong)]"
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileSelect}
            accept="image/*"
            multiple={false}
          />
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
            <UploadCloud className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-[var(--text)]">Drop file or click</span>
            <span className="text-[10px] text-[var(--muted)] ml-2">Document files</span>
          </div>
          <button className="btn btn-secondary hover-elevate active-elevate-2 px-3 py-1 text-[10px] shrink-0">
            {isAnalyzing ? "Processing" : "Select"}
          </button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="text-xs text-[var(--muted)]">
            Selected: {selectedFiles.map((file) => file.name).join(", ")}
          </div>
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
    <div className="card p-1 md:p-2 mb-8">
      <div className="bg-[var(--panel2)]/50 rounded-lg p-6 md:p-8">
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 bg-[var(--accent)]/10 rounded-xl">
            <Icon className="w-8 h-8 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-1">{info.title}</h2>
            <p className="text-[var(--muted)]">{info.desc}</p>
          </div>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
