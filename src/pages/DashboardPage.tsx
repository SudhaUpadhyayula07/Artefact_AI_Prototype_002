import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mic,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  ControlPreset,
  OutputType,
  RunControls,
  SourceInputType,
  SourceItem,
} from '../types/artefact';
import { ALL_OUTPUT_TYPES, OUTPUT_META } from '../utils/clientProvenance';

interface DashboardPageProps {
  sources: SourceItem[];
  setSources: React.Dispatch<React.SetStateAction<SourceItem[]>>;
  controls: RunControls;
  setControls: React.Dispatch<React.SetStateAction<RunControls>>;
  presets: ControlPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  termsAccepted: boolean;
  onAcceptTermsChange: (accepted: boolean) => void;
  onOpenTerms: () => void;
  apiKeyConfigured: boolean;
  onStartRun: () => void;
}

const AUDIENCE_PRESETS = [
  'General public',
  'Executives',
  'Students',
  'Technical staff',
  'Government officials',
  'Customers',
  'Media',
  'custom',
];

const TONE_PRESETS = [
  'Formal',
  'Friendly',
  'Urgent',
  'Neutral',
  'Authoritative',
  'Inspiring',
  'custom',
];

const LANGUAGE_PRESETS = [
  'English',
  'Hindi',
  'Telugu',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Punjabi',
  'Urdu',
  'Spanish',
  'French',
  'German',
  'Arabic',
  'Japanese',
  'Portuguese',
  'custom',
];

const OBJECTIVE_PRESETS = [
  'Inform',
  'Persuade',
  'Warn',
  'Announce',
  'Educate',
  'Summarise for decision-makers',
  'custom',
];

const STYLE_PRESETS = [
  'News style',
  'Executive style',
  'Plain-language style',
  'Technical style',
  'Storytelling style',
  'custom',
];

const DETAIL_STEP_LABELS: Record<1 | 2 | 3 | 4 | 5, { label: string; drives: string }> = {
  1: {
    label: 'Essential snapshot',
    drives: '1-2 tweets, 4 slides, 3 video scenes, concise summary',
  },
  2: {
    label: 'Brief overview',
    drives: '3-4 tweets, 6 slides, 4 video scenes, compact sections',
  },
  3: {
    label: 'Standard briefing',
    drives: '5-6 tweets, 8 slides, 6 video scenes, balanced depth',
  },
  4: {
    label: 'Detailed analysis',
    drives: '7-8 tweets, 10 slides, 8 video scenes, comprehensive findings',
  },
  5: {
    label: 'Exhaustive specification',
    drives: '9-10 tweets, 12 slides, 10 video scenes, maximum section depth',
  },
};

const SAMPLE_ADVISORY_SOURCE = `NATIONAL MARITIME GRID & PORT LOGISTICS RESILIENCE REPORT (Q3 2026)
Reference ID: NMG-2026-09-B4
Published: September 24, 2026
Prepared by: Port Infrastructure Resilience Directorate

1. Executive Overview
Between July 1 and September 15, 2026, automated crane telemetry systems across 14 coastal container terminals recorded 382 intermittent packet-loss incidents caused by outdated firmware in optical network units (Model ONU-440X, firmware versions 3.1.0 through 3.1.8). No unauthorized intrusion or data exfiltration occurred; root-cause analysis confirmed a memory buffer overflow triggered after 45 days of continuous uptime under high ambient temperatures exceeding 38 degrees Celsius.

2. Operational and Economic Impact
- Average container dwell time increased from 26.4 hours to 31.8 hours (a 20.5% increase) across the 6 most affected terminals.
- Approximately 42,600 twenty-foot equivalent units (TEUs) experienced scheduling delays of 12 hours or more.
- Terminals that deployed firmware patch 3.2.1 during the August pilot reduced packet-loss events by 98.4% within 48 hours and restored average dwell time to 25.9 hours.

3. Recommended Actions for Terminal Operators
- Immediate (Within 72 hours): Upgrade all Model ONU-440X optical network units to firmware version 3.2.1 during scheduled maintenance windows.
- High Priority (Within 14 days): Enable automated telemetry memory-threshold alerts at 75% buffer utilization in the terminal operations control room.
- Medium Priority (Within 30 days): Audit cabinet cooling ventilation in crane bays where internal temperatures exceeded 38 degrees Celsius during August 2026.`;

export const DashboardPage: React.FC<DashboardPageProps> = ({
  sources,
  setSources,
  controls,
  setControls,
  presets,
  onSavePreset,
  onDeletePreset,
  termsAccepted,
  onAcceptTermsChange,
  onOpenTerms,
  apiKeyConfigured,
  onStartRun,
}) => {
  const [activeTab, setActiveTab] = useState<SourceInputType>('text');
  const [textTitle, setTextTitle] = useState('');
  const [textInput, setTextInput] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlExtracting, setUrlExtracting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const wordCount = (str: string) => {
    const trimmed = str.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  };

  const handleAddTextSource = () => {
    if (!textInput.trim()) return;
    const item: SourceItem = {
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      title: textTitle.trim() || `Pasted text (${wordCount(textInput)} words)`,
      rawText: textInput.trim(),
      extractionStatus: 'ready',
      extractionMethod: 'Direct pasted text',
    };
    setSources((prev) => [...prev, item]);
    setTextTitle('');
    setTextInput('');
  };

  const handleLoadSampleSource = () => {
    setTextTitle('National Maritime Grid & Port Logistics Resilience Report (Q3 2026)');
    setTextInput(SAMPLE_ADVISORY_SOURCE);
    setActiveTab('text');
  };

  const handleAddPromptSource = () => {
    if (!promptInput.trim()) return;
    const item: SourceItem = {
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'prompt',
      title: `Direct prompt (${wordCount(promptInput)} words)`,
      rawText: promptInput.trim(),
      extractionStatus: 'ready',
      extractionMethod: 'Direct operator prompt',
    };
    setSources((prev) => [...prev, item]);
    setPromptInput('');
  };

  const handleExtractUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlExtracting(true);
    setUrlError(null);
    const tempId = `src-${Date.now()}`;
    const newItem: SourceItem = {
      id: tempId,
      type: 'url',
      title: urlInput.trim(),
      url: urlInput.trim(),
      rawText: '',
      extractionStatus: 'extracting',
    };
    setSources((prev) => [...prev, newItem]);
    const targetUrl = urlInput.trim();
    setUrlInput('');

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'URL extraction failed.');
      }
      setSources((prev) =>
        prev.map((s) =>
          s.id === tempId
            ? {
                ...s,
                title: data.title || targetUrl,
                rawText: data.text || '',
                extractionStatus: 'ready',
                extractionMethod: data.method,
              }
            : s
        )
      );
    } catch (err) {
      const msg = (err as Error).message;
      setUrlError(msg);
      setSources((prev) =>
        prev.map((s) =>
          s.id === tempId
            ? {
                ...s,
                extractionStatus: 'error',
                extractionError: msg,
              }
            : s
        )
      );
    } finally {
      setUrlExtracting(false);
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const tempId = `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const lower = file.name.toLowerCase();
      let detectedType: SourceInputType = activeTab;
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(lower)) {
        detectedType = 'image';
      } else if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac|aac)$/.test(lower)) {
        detectedType = 'audio';
      } else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/.test(lower)) {
        detectedType = 'video';
      } else {
        detectedType = 'document';
      }

      if (file.size > 25 * 1024 * 1024) {
        setSources((prev) => [
          ...prev,
          {
            id: tempId,
            type: detectedType,
            title: file.name,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            rawText: '',
            extractionStatus: 'error',
            extractionError:
              'File exceeds the 25 MB limit. Please upload a file under 25 MB or paste the text directly.',
          },
        ]);
        continue;
      }

      setSources((prev) => [
        ...prev,
        {
          id: tempId,
          type: detectedType,
          title: file.name,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          rawText: '',
          extractionStatus: 'extracting',
        },
      ]);

      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Could not extract readable text from file.');
        }
        setSources((prev) =>
          prev.map((s) =>
            s.id === tempId
              ? {
                  ...s,
                  title: data.title || file.name,
                  rawText: data.text || '',
                  extractionStatus: 'ready',
                  extractionMethod: data.method,
                }
              : s
          )
        );
      } catch (err) {
        setSources((prev) =>
          prev.map((s) =>
            s.id === tempId
              ? {
                  ...s,
                  extractionStatus: 'error',
                  extractionError: (err as Error).message,
                }
              : s
          )
        );
      }
    }
  };

  const moveSource = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= sources.length) return;
    setSources((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const removeSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSourceText = (id: string, newText: string) => {
    setSources((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              rawText: newText,
              extractionStatus: newText.trim().length > 0 ? 'ready' : s.extractionStatus,
            }
          : s
      )
    );
  };

  const toggleOutputType = (type: OutputType) => {
    setControls((prev) => {
      const exists = prev.selectedOutputs.includes(type);
      const next = exists
        ? prev.selectedOutputs.filter((t) => t !== type)
        : [...prev.selectedOutputs, type];
      return { ...prev, selectedOutputs: next };
    });
  };

  const readySources = sources.filter(
    (s) => s.extractionStatus === 'ready' && s.rawText.trim().length > 0
  );
  const totalWords = readySources.reduce((acc, s) => acc + wordCount(s.rawText), 0);
  const canRun =
    apiKeyConfigured &&
    readySources.length > 0 &&
    controls.selectedOutputs.length > 0 &&
    termsAccepted;

  const getFileAcceptForTab = () => {
    if (activeTab === 'document') return '.pdf,.docx,.txt,.md,.csv';
    if (activeTab === 'image') return '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
    if (activeTab === 'audio') return '.mp3,.wav,.m4a,.ogg,.flac,audio/*';
    if (activeTab === 'video') return '.mp4,.webm,.mov,video/*';
    return '*/*';
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1C192E]">
            Transformation Dashboard
          </h1>
          <p className="text-sm text-[#534D72] mt-1">
            Assemble your source bundle, configure global controls once, and generate all selected
            communication formats in a single validated run.
          </p>
        </div>
        {!apiKeyConfigured && (
          <div className="bg-white border border-[#DC2626] rounded-md px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-[#DC2626]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>GEMINI_API_KEY is not set on the server. Configure it before running.</span>
          </div>
        )}
      </div>

      {/* STEP 1: SOURCE INTAKE */}
      <section className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E2F7] pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#1C192E]">
              1. Source Bundle Intake
            </h2>
            <p className="text-xs text-[#534D72] mt-0.5">
              Add one or more sources into a bundle. You can preview, edit, reorder, or remove any
              source before running.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSampleSource}
            className="px-3.5 py-2 text-xs font-semibold text-[#5E60CE] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] transition-colors whitespace-nowrap"
          >
            Load Sample Operational Report
          </button>
        </div>

        {/* Segmented Source Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F8F6FF] border border-[#E8E2F7] rounded-lg">
          {[
            { id: 'text', label: 'Pasted Text', icon: FileText },
            { id: 'prompt', label: 'Direct Prompt', icon: Sparkles },
            { id: 'document', label: 'Documents (PDF/DOCX/TXT)', icon: Upload },
            { id: 'image', label: 'Images (PNG/JPG/WEBP)', icon: ImageIcon },
            { id: 'audio', label: 'Audio', icon: Mic },
            { id: 'video', label: 'Video', icon: Film },
            { id: 'url', label: 'Web Link (URL)', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SourceInputType)}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#5E60CE] text-white'
                    : 'text-[#534D72] hover:text-[#1C192E] hover:bg-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active Tab Intake UI */}
        {activeTab === 'text' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#1C192E] mb-1">
                Source Title (optional)
              </label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="e.g. Q3 Security Advisory, Policy Announcement, Research Paper"
                className="w-full px-3.5 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E] focus:bg-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#1C192E]">
                  Paste Source Text
                </label>
                <span className="text-xs font-mono text-[#534D72]">
                  {textInput.length} chars · {wordCount(textInput)} words
                </span>
              </div>
              <textarea
                rows={7}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your article, report, advisory, announcement, or briefing text here..."
                className="w-full p-3.5 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E] focus:bg-white leading-relaxed"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddTextSource}
                disabled={!textInput.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Text to Source Bundle
              </button>
            </div>
          </div>
        )}

        {activeTab === 'prompt' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1C192E]">
                Direct Free-Form Prompt (treated as primary source)
              </label>
              <span className="text-xs font-mono text-[#534D72]">
                {promptInput.length} chars · {wordCount(promptInput)} words
              </span>
            </div>
            <textarea
              rows={5}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Describe the announcement, facts, metrics, and message you want transformed across formats..."
              className="w-full p-3.5 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E] focus:bg-white leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddPromptSource}
                disabled={!promptInput.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Prompt to Source Bundle
              </button>
            </div>
          </div>
        )}

        {(activeTab === 'document' ||
          activeTab === 'image' ||
          activeTab === 'audio' ||
          activeTab === 'video') && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFilesSelected(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-[#5E60CE] bg-[#E0AAFF]/20'
                : 'border-[#E8E2F7] bg-[#F8F6FF]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={getFileAcceptForTab()}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-[#5E60CE] mx-auto mb-3" />
            <p className="text-sm font-bold text-[#1C192E]">
              Drag and drop your {activeTab} file(s) here, or click to browse
            </p>
            <p className="text-xs text-[#534D72] mt-1 max-w-lg mx-auto">
              {activeTab === 'document' &&
                'Supports PDF, DOCX, and TXT up to 25 MB. Scanned or empty PDFs automatically fall back to Gemini OCR reading.'}
              {activeTab === 'image' &&
                'Supports PNG, JPG, and WEBP up to 25 MB. Gemini vision extracts all visible text and a factual description.'}
              {activeTab === 'audio' &&
                'Supports MP3, WAV, M4A, and OGG up to 25 MB. Gemini returns an accurate spoken transcript.'}
              {activeTab === 'video' &&
                'Supports MP4, WEBM, and MOV up to 25 MB. Gemini returns a full transcript plus a scene-by-scene summary.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors"
            >
              Choose File(s)
            </button>
          </div>
        )}

        {activeTab === 'url' && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[#1C192E]">
              Public Web Link (URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.org/news/advisory-report"
                className="flex-1 px-3.5 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E] focus:bg-white"
              />
              <button
                type="button"
                onClick={handleExtractUrl}
                disabled={!urlInput.trim() || urlExtracting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {urlExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Fetch & Extract Article
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-[#534D72]">
              Protected against SSRF (blocks localhost, loopback, link-local, and private IP ranges).
              If a page requires client-side JavaScript to render, paste its text directly.
            </p>
            {urlError && (
              <p className="text-xs text-[#DC2626] font-medium">{urlError}</p>
            )}
          </div>
        )}

        {/* Current Source Bundle List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1C192E]">
              Current Source Bundle ({sources.length} item{sources.length === 1 ? '' : 's'} ·{' '}
              {totalWords} total words)
            </h3>
            {sources.length > 0 && (
              <button
                type="button"
                onClick={() => setSources([])}
                className="text-xs font-semibold text-[#DC2626] hover:underline"
              >
                Clear bundle
              </button>
            )}
          </div>

          {sources.length === 0 ? (
            <div className="p-4 bg-[#F8F6FF] border border-[#E8E2F7] rounded-lg text-xs text-[#534D72]">
              No sources in bundle yet. Add pasted text, a prompt, a document, media file, or URL
              above, or click &quot;Load Sample Operational Report&quot; to test immediately.
            </div>
          ) : (
            <div className="divide-y divide-[#E8E2F7] border border-[#E8E2F7] rounded-lg">
              {sources.map((src, idx) => {
                const isExpanded = expandedSourceId === src.id;
                return (
                  <div key={src.id} className="p-4 space-y-3 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-[#5E60CE]">
                            #{idx + 1} [{src.type.toUpperCase()}]
                          </span>
                          <span className="text-sm font-bold text-[#1C192E]">
                            {src.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#534D72]">
                          {src.fileSize !== undefined && (
                            <>
                              <span className="font-mono">
                                {(src.fileSize / 1024).toFixed(1)} KB
                              </span>
                              <span>·</span>
                            </>
                          )}
                          {src.extractionMethod && (
                            <>
                              <span>{src.extractionMethod}</span>
                              <span>·</span>
                            </>
                          )}
                          {src.extractionStatus === 'extracting' && (
                            <span className="text-[#5E60CE] font-semibold inline-flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Extracting text...
                            </span>
                          )}
                          {src.extractionStatus === 'ready' && (
                            <span className="text-[#16A34A] font-semibold">
                              Ready ({src.rawText.length} chars · {wordCount(src.rawText)} words)
                            </span>
                          )}
                          {src.extractionStatus === 'error' && (
                            <span className="text-[#DC2626] font-semibold">
                              Extraction failed: {src.extractionError} (You can paste text manually
                              below)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSourceId(isExpanded ? null : src.id)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF]"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              Hide Text
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              Preview / Edit
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSource(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Move source up"
                          className="p-1.5 text-[#534D72] hover:text-[#1C192E] disabled:opacity-30 border border-[#E8E2F7] rounded-md"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSource(idx, 1)}
                          disabled={idx === sources.length - 1}
                          aria-label="Move source down"
                          className="p-1.5 text-[#534D72] hover:text-[#1C192E] disabled:opacity-30 border border-[#E8E2F7] rounded-md"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSource(src.id)}
                          aria-label="Remove source"
                          className="p-1.5 text-[#DC2626] hover:bg-[#F8F6FF] border border-[#E8E2F7] rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {(isExpanded || src.extractionStatus === 'error') && (
                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-[#1C192E] mb-1">
                          Extracted Source Text (Editable before running)
                        </label>
                        <textarea
                          rows={6}
                          value={src.rawText}
                          onChange={(e) => updateSourceText(src.id, e.target.value)}
                          placeholder="Paste or edit the source text here..."
                          className="w-full p-3 text-xs font-mono bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E] focus:bg-white leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Optional Additional Context */}
        <div className="border-t border-[#E8E2F7] pt-4 space-y-3">
          <h3 className="text-sm font-bold text-[#1C192E]">
            Additional Operator Context (Optional)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#534D72] mb-1">
                Organisation Name
              </label>
              <input
                type="text"
                value={controls.additionalContext.organisation}
                onChange={(e) =>
                  setControls((prev) => ({
                    ...prev,
                    additionalContext: {
                      ...prev.additionalContext,
                      organisation: e.target.value,
                    },
                  }))
                }
                placeholder="e.g. Maritime Resilience Directorate"
                className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#534D72] mb-1">
                Campaign or Initiative
              </label>
              <input
                type="text"
                value={controls.additionalContext.campaign}
                onChange={(e) =>
                  setControls((prev) => ({
                    ...prev,
                    additionalContext: {
                      ...prev.additionalContext,
                      campaign: e.target.value,
                    },
                  }))
                }
                placeholder="e.g. Q3 Terminal Firmware Upgrade Rollout"
                className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#534D72] mb-1">
                Must-Include Items
              </label>
              <input
                type="text"
                value={controls.additionalContext.mustInclude}
                onChange={(e) =>
                  setControls((prev) => ({
                    ...prev,
                    additionalContext: {
                      ...prev.additionalContext,
                      mustInclude: e.target.value,
                    },
                  }))
                }
                placeholder="Specific facts or deadlines from the source to highlight"
                className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#534D72] mb-1">
                Must-Avoid Items
              </label>
              <input
                type="text"
                value={controls.additionalContext.mustAvoid}
                onChange={(e) =>
                  setControls((prev) => ({
                    ...prev,
                    additionalContext: {
                      ...prev.additionalContext,
                      mustAvoid: e.target.value,
                    },
                  }))
                }
                placeholder="Phrases, jargon, or angles to avoid"
                className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* STEP 2: OUTPUT SELECTION */}
      <section className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2F7] pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#1C192E]">
              2. Output Formats ({controls.selectedOutputs.length} of 7 selected)
            </h2>
            <p className="text-xs text-[#534D72] mt-0.5">
              Select at least one output format. All selected formats are generated from the same
              shared fact base.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setControls((prev) => ({ ...prev, selectedOutputs: [...ALL_OUTPUT_TYPES] }))
              }
              className="px-3 py-1.5 text-xs font-semibold text-[#5E60CE] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF]"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() =>
                setControls((prev) => ({ ...prev, selectedOutputs: [] }))
              }
              className="px-3 py-1.5 text-xs font-semibold text-[#534D72] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF]"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_OUTPUT_TYPES.map((type) => {
            const selected = controls.selectedOutputs.includes(type);
            const meta = OUTPUT_META[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleOutputType(type)}
                className={`text-left p-4 rounded-lg border transition-colors flex items-start gap-3 ${
                  selected
                    ? 'bg-[#E0AAFF]/25 border-[#5E60CE]'
                    : 'bg-white border-[#E8E2F7] hover:border-[#7B6DFF]'
                }`}
              >
                <div className="mt-0.5 text-[#5E60CE] shrink-0">
                  {selected ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4 text-[#534D72]" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-extrabold text-[#1C192E]">{meta.label}</div>
                  <p className="text-xs text-[#534D72] mt-1 leading-relaxed">
                    {meta.shortDesc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* STEP 3: GLOBAL CONTROLS */}
      <section className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-6">
        <div className="border-b border-[#E8E2F7] pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#1C192E]">
              3. Transformation Controls
            </h2>
            <p className="text-xs text-[#534D72] mt-0.5">
              Set these once. They apply to every selected output format in this run.
            </p>
          </div>

          {/* Preset Saver / Loader */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="px-3 py-1.5 text-xs bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
            />
            <button
              type="button"
              onClick={() => {
                if (!presetName.trim()) return;
                onSavePreset(presetName);
                setPresetName('');
              }}
              disabled={!presetName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] disabled:opacity-50 whitespace-nowrap"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#5E60CE]" />
              Save as preset
            </button>
          </div>
        </div>

        {/* Saved Presets Bar */}
        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-[#F8F6FF] border border-[#E8E2F7] rounded-md p-3">
            <span className="text-xs font-semibold text-[#1C192E] mr-1">Saved Presets:</span>
            {presets.map((p) => (
              <div
                key={p.id}
                className="inline-flex items-center gap-1.5 bg-white border border-[#E8E2F7] rounded-md px-2.5 py-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => setControls(JSON.parse(JSON.stringify(p.controls)))}
                  className="font-semibold text-[#5E60CE] hover:underline"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(p.id)}
                  aria-label={`Delete preset ${p.name}`}
                  className="text-[#534D72] hover:text-[#DC2626]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Target Audience */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1C192E]">
              Target Audience
            </label>
            <select
              value={controls.targetAudience}
              onChange={(e) =>
                setControls((prev) => ({ ...prev, targetAudience: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
            >
              {AUDIENCE_PRESETS.map((a) => (
                <option key={a} value={a}>
                  {a === 'custom' ? 'Custom audience...' : a}
                </option>
              ))}
            </select>
            {controls.targetAudience === 'custom' && (
              <input
                type="text"
                value={controls.customAudience || ''}
                onChange={(e) =>
                  setControls((prev) => ({ ...prev, customAudience: e.target.value }))
                }
                placeholder="Specify target audience..."
                className="w-full mt-1.5 px-3 py-2 text-xs bg-white border border-[#E8E2F7] rounded-md"
              />
            )}
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1C192E]">Tone</label>
            <select
              value={controls.tone}
              onChange={(e) => setControls((prev) => ({ ...prev, tone: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
            >
              {TONE_PRESETS.map((t) => (
                <option key={t} value={t}>
                  {t === 'custom' ? 'Custom tone...' : t}
                </option>
              ))}
            </select>
            {controls.tone === 'custom' && (
              <input
                type="text"
                value={controls.customTone || ''}
                onChange={(e) =>
                  setControls((prev) => ({ ...prev, customTone: e.target.value }))
                }
                placeholder="Specify custom tone..."
                className="w-full mt-1.5 px-3 py-2 text-xs bg-white border border-[#E8E2F7] rounded-md"
              />
            )}
          </div>

          {/* Output Language */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1C192E]">
              Output Language
            </label>
            <select
              value={controls.language}
              onChange={(e) =>
                setControls((prev) => ({ ...prev, language: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
            >
              {LANGUAGE_PRESETS.map((l) => (
                <option key={l} value={l}>
                  {l === 'custom' ? 'Other language...' : l}
                </option>
              ))}
            </select>
            {controls.language === 'custom' && (
              <input
                type="text"
                value={controls.customLanguage || ''}
                onChange={(e) =>
                  setControls((prev) => ({ ...prev, customLanguage: e.target.value }))
                }
                placeholder="Enter language name..."
                className="w-full mt-1.5 px-3 py-2 text-xs bg-white border border-[#E8E2F7] rounded-md"
              />
            )}
          </div>

          {/* Communication Objective */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1C192E]">
              Communication Objective
            </label>
            <select
              value={controls.objective}
              onChange={(e) =>
                setControls((prev) => ({ ...prev, objective: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
            >
              {OBJECTIVE_PRESETS.map((o) => (
                <option key={o} value={o}>
                  {o === 'custom' ? 'Custom objective...' : o}
                </option>
              ))}
            </select>
            {controls.objective === 'custom' && (
              <input
                type="text"
                value={controls.customObjective || ''}
                onChange={(e) =>
                  setControls((prev) => ({ ...prev, customObjective: e.target.value }))
                }
                placeholder="Specify communication objective..."
                className="w-full mt-1.5 px-3 py-2 text-xs bg-white border border-[#E8E2F7] rounded-md"
              />
            )}
          </div>

          {/* Content Style */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#1C192E]">
              Content Style
            </label>
            <select
              value={controls.contentStyle}
              onChange={(e) =>
                setControls((prev) => ({ ...prev, contentStyle: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
            >
              {STYLE_PRESETS.map((s) => (
                <option key={s} value={s}>
                  {s === 'custom' ? 'Custom style...' : s}
                </option>
              ))}
            </select>
            {controls.contentStyle === 'custom' && (
              <input
                type="text"
                value={controls.customStyle || ''}
                onChange={(e) =>
                  setControls((prev) => ({ ...prev, customStyle: e.target.value }))
                }
                placeholder="Specify content style..."
                className="w-full mt-1.5 px-3 py-2 text-xs bg-white border border-[#E8E2F7] rounded-md"
              />
            )}
          </div>

          {/* Approval Gate Toggle */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="flex items-start gap-2.5 p-3 bg-[#F8F6FF] border border-[#E8E2F7] rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={controls.requireHumanApproval}
                onChange={(e) =>
                  setControls((prev) => ({
                    ...prev,
                    requireHumanApproval: e.target.checked,
                  }))
                }
                className="mt-0.5 accent-[#5E60CE]"
              />
              <div>
                <span className="block text-xs font-semibold text-[#1C192E]">
                  Require human approval before publishing
                </span>
                <span className="block text-[11px] text-[#534D72]">
                  Dual sign-off gate holds exports until an operator approves each output.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Level of Detail Slider (1 to 5) */}
        <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded-lg p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="detail-level-slider"
              className="text-xs font-semibold text-[#1C192E]"
            >
              Level of Detail: Step {controls.detailLevel} of 5 (
              {DETAIL_STEP_LABELS[controls.detailLevel].label})
            </label>
            <span className="text-xs text-[#5E60CE] font-medium">
              {DETAIL_STEP_LABELS[controls.detailLevel].drives}
            </span>
          </div>
          <input
            id="detail-level-slider"
            type="range"
            min={1}
            max={5}
            step={1}
            value={controls.detailLevel}
            onChange={(e) =>
              setControls((prev) => ({
                ...prev,
                detailLevel: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
              }))
            }
            className="w-full accent-[#5E60CE] cursor-pointer"
          />
          <div className="grid grid-cols-5 text-[11px] text-[#534D72] pt-1">
            <span>1 · Snapshot</span>
            <span className="text-center">2 · Brief</span>
            <span className="text-center">3 · Standard</span>
            <span className="text-center">4 · Detailed</span>
            <span className="text-right">5 · Exhaustive</span>
          </div>
        </div>
      </section>

      {/* STEP 4: PRE-RUN SUMMARY & RUN BUTTON */}
      <section className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
        <h2 className="text-base font-extrabold text-[#1C192E]">
          4. Run Summary & Execution
        </h2>
        <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded-md p-4 text-xs text-[#1C192E] space-y-1.5">
          <p>
            <strong>Sources ready:</strong> {readySources.length} item
            {readySources.length === 1 ? '' : 's'} ({totalWords} words)
          </p>
          <p>
            <strong>Selected formats ({controls.selectedOutputs.length}):</strong>{' '}
            {controls.selectedOutputs.length > 0
              ? controls.selectedOutputs.map((t) => OUTPUT_META[t].label).join(', ')
              : 'None selected'}
          </p>
          <p>
            <strong>Parameters:</strong> Audience: {controls.targetAudience} · Tone:{' '}
            {controls.tone} · Language: {controls.language} · Detail: Level{' '}
            {controls.detailLevel}/5 ({DETAIL_STEP_LABELS[controls.detailLevel].label}) ·
            Objective: {controls.objective} · Style: {controls.contentStyle}
          </p>
          <p>
            <strong>Approval policy:</strong>{' '}
            {controls.requireHumanApproval
              ? 'Dual sign-off enabled (all outputs require explicit operator approval before approved export)'
              : 'Standard gate (outputs scoring 85+ are auto-approved; below 85 require operator sign-off)'}
          </p>
        </div>

        {/* One-time Terms Acceptance Checkbox */}
        {!termsAccepted && (
          <div className="bg-[#F8F6FF] border border-[#B794F4] rounded-md p-3.5 flex items-start gap-2.5 text-xs">
            <input
              id="accept-terms-checkbox"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => onAcceptTermsChange(e.target.checked)}
              className="mt-0.5 accent-[#5E60CE]"
            />
            <label htmlFor="accept-terms-checkbox" className="text-[#1C192E]">
              I have read and accept the{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="text-[#5E60CE] font-semibold underline"
              >
                Terms and Conditions
              </button>
              , including the requirement for human review of AI-generated outputs and the scope of
              the local provenance ledger.
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[#534D72]">
            {readySources.length === 0 && 'Add at least one readable source to enable run.'}
            {readySources.length > 0 &&
              controls.selectedOutputs.length === 0 &&
              'Select at least one output format.'}
            {readySources.length > 0 &&
              controls.selectedOutputs.length > 0 &&
              !termsAccepted &&
              'Accept the Terms and Conditions above to start your first run.'}
            {canRun &&
              'Ready to run moderation, orchestrator, specialist agents, claim validation, and provenance stamping.'}
          </div>

          <button
            type="button"
            onClick={onStartRun}
            disabled={!canRun}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            Run transformation
          </button>
        </div>
      </section>
    </div>
  );
};
