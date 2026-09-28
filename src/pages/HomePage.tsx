import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Layers,
  Lock,
  Mic,
  Presentation,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { ALL_OUTPUT_TYPES, OUTPUT_META } from '../utils/clientProvenance';

interface HomePageProps {
  onNavigate: (route: string) => void;
  contactEmail: string;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, contactEmail }) => {
  const inputTypes = [
    {
      title: 'Pasted text',
      desc: 'Articles, announcements, briefings, or raw notes pasted directly with live word and character counts.',
      icon: FileText,
    },
    {
      title: 'Direct prompt',
      desc: 'A free-form instruction or communication brief treated as the primary source.',
      icon: Sparkles,
    },
    {
      title: 'Documents (PDF, DOCX, TXT)',
      desc: 'Full text extraction on the server, with automatic OCR reading for scanned or image-only PDFs.',
      icon: FileCheck,
    },
    {
      title: 'Images (PNG, JPG, WEBP)',
      desc: 'Vision reading returns all visible text, chart values, and a strictly factual description.',
      icon: ImageIcon,
    },
    {
      title: 'Audio recordings',
      desc: 'Server-side speech transcription turns recorded briefings, interviews, and voice notes into text.',
      icon: Mic,
    },
    {
      title: 'Video files',
      desc: 'Extracts the spoken transcript together with a timestamped scene-by-scene factual summary.',
      icon: Video,
    },
    {
      title: 'Web links (URL)',
      desc: 'Fetches the public web page with SSRF protection and extracts the main readable article text.',
      icon: Globe,
    },
    {
      title: 'Additional operator context',
      desc: 'Optional organisation name, campaign details, must-include facts, and must-avoid phrases.',
      icon: Layers,
    },
  ];

  const pipelineSteps = [
    {
      step: '01. Source extraction',
      desc: 'Reads uploaded documents, scanned PDFs, images, audio, video, and web links into clean, editable text.',
    },
    {
      step: '02. Input moderation',
      desc: 'Checks the combined source bundle for hate, harassment, dangerous content, sexual content, misinformation risk, and personal data.',
    },
    {
      step: '03. Shared fact base',
      desc: 'The orchestrator reads the full source and controls to build one structured fact base containing verbatim quotes, key numbers, entities, and caveats.',
    },
    {
      step: '04. Specialist generation',
      desc: 'Dedicated format agents run in parallel (up to 3 at a time) using the exact same fact base and controls.',
    },
    {
      step: '05. Claim-by-claim validation',
      desc: 'The validator inspects every generated format against the source, marking each claim as supported, unsupported, or contradicted with a 0 to 100 score.',
    },
    {
      step: '06. Automatic retry on low scores',
      desc: 'If any format scores below 70 or contains a contradicted claim, it is regenerated once with the validator findings passed back as corrective feedback.',
    },
    {
      step: '07. Cross-output consistency check',
      desc: 'Compares numbers, dates, and factual claims across all generated formats in the run and flags any mismatch.',
    },
    {
      step: '08. Output moderation and approval gate',
      desc: 'Checks generated text for safety and holds any output scoring below 85 (or when dual sign-off is enabled) until the operator approves it.',
    },
    {
      step: '09. Cryptographic provenance and ledger stamp',
      desc: 'Computes SHA-256 hashes, assigns a unique watermark ID, and appends the run to the local tamper-evident hash chain.',
    },
  ];

  const trustCards = [
    {
      title: 'Claim-level validation',
      desc: 'Every factual claim, number, name, and date in an output is cross-checked against your source text with supporting quotes.',
    },
    {
      title: 'Automatic corrective retry',
      desc: 'Outputs that fall below a 70/100 score or contradict the source are rewritten once automatically using the validator report.',
    },
    {
      title: 'Input and output safety checks',
      desc: 'Both incoming source material and outgoing drafts are checked for harmful content and personal data exposure.',
    },
    {
      title: 'Tamper-evident local hash chain',
      desc: 'Each run appends source hashes, output hashes, and batch hashes to a local SHA-256 ledger that can be audited at any time.',
    },
    {
      title: 'Public verification page',
      desc: 'Anyone can paste text or upload an exported file on the Verify page to confirm whether it is VERIFIED, MODIFIED, or NOT FOUND.',
    },
    {
      title: 'Human approval gate',
      desc: 'Enable dual sign-off or rely on automatic holds when a validation score is below 85 before exporting approved packages.',
    },
  ];

  const userGroups = [
    {
      group: 'Communications teams',
      desc: 'Turn press releases, quarterly updates, and leadership notes into coordinated social posts, executive briefings, and slide decks.',
    },
    {
      group: 'Security and IT operations',
      desc: 'Convert threat intelligence, incident timelines, and patch notes into formal advisories, executive summaries, and operator updates without inventing CVEs.',
    },
    {
      group: 'Government offices',
      desc: 'Translate policy documents and public notices into plain-language summaries, multilingual posts, and structured visual briefings.',
    },
    {
      group: 'Researchers and educators',
      desc: 'Distil papers, lecture recordings, and technical findings into slide presentations, infographics, and video scripts grounded in source numbers.',
    },
    {
      group: 'Non-governmental organisations (NGOs)',
      desc: 'Transform field reports and programme evaluations into stakeholder briefings, multilingual outreach threads, and visual summaries.',
    },
  ];

  const openLimits = [
    {
      title: 'Single-operator workspace',
      desc: 'Designed for an operator working from a browser dashboard. Run history and presets are stored in your browser localStorage.',
    },
    {
      title: 'Local hash chain, not a public blockchain',
      desc: 'Provenance records are appended to a tamper-evident local JSON ledger (data/ledger.json) on the server, not broadcast to an external distributed ledger.',
    },
    {
      title: 'No direct social publishing yet',
      desc: 'Artefact.AI produces validated, watermarked files and copy-ready formats, rather than posting directly to social media accounts.',
    },
    {
      title: 'JavaScript-heavy web pages',
      desc: 'The URL extractor reads static and server-rendered HTML. Pages that require client-side JavaScript to render text should be pasted directly or uploaded as PDF.',
    },
  ];

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="bg-white border border-[#E8E2F7] rounded-lg p-8 md:p-12">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#5E60CE]">
            <span>MULTI-FORMAT CONTENT TRANSFORMATION ENGINE</span>
            <span aria-hidden="true">·</span>
            <span>PROVENANCE VERIFIED</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1C192E] leading-tight">
            One source in. Every format out.
          </h1>
          <p className="text-base sm:text-lg text-[#534D72] leading-relaxed">
            Give Artefact.AI an article, report, advisory or prompt. Choose the formats you need.
            It writes them all from the same facts, checks each one against your source, and stamps
            it with a verifiable fingerprint.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors whitespace-nowrap"
            >
              Open dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/verify')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 text-[#5E60CE]" />
              Verify content
            </button>
          </div>
        </div>
      </section>

      {/* Section 1: What goes in */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1C192E]">01. What goes in</h2>
          <p className="text-sm text-[#534D72] mt-1">
            Combine one or several inputs into a single source bundle before running a transformation.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {inputTypes.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-2"
              >
                <div className="w-9 h-9 rounded-md bg-[#F8F6FF] border border-[#E8E2F7] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#5E60CE]" />
                </div>
                <h3 className="text-base font-extrabold text-[#1C192E]">{item.title}</h3>
                <p className="text-sm text-[#534D72] leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: What comes out */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1C192E]">02. What comes out</h2>
          <p className="text-sm text-[#534D72] mt-1">
            Select any combination of the seven formats below. Every selected format is generated in
            the same run from the same extracted fact base.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALL_OUTPUT_TYPES.map((type, idx) => {
            const meta = OUTPUT_META[type];
            return (
              <div
                key={type}
                className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-2"
              >
                <div className="text-xs font-mono font-semibold text-[#5E60CE]">
                  FORMAT 0{idx + 1}
                </div>
                <h3 className="text-base font-extrabold text-[#1C192E]">{meta.label}</h3>
                <p className="text-sm text-[#534D72] leading-relaxed">{meta.sentence}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: How a run works */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1C192E]">03. How a run works</h2>
          <p className="text-sm text-[#534D72] mt-1">
            Each run executes a sequential and parallel multi-agent pipeline on the server and streams
            real progress events to your browser.
          </p>
        </div>
        <div className="bg-white border border-[#E8E2F7] rounded-lg divide-y divide-[#E8E2F7]">
          {pipelineSteps.map((s) => (
            <div
              key={s.step}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6"
            >
              <h3 className="text-sm font-extrabold text-[#5E60CE] sm:w-64 shrink-0">
                {s.step}
              </h3>
              <p className="text-sm text-[#534D72] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: The trust layer */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1C192E]">04. The trust layer</h2>
          <p className="text-sm text-[#534D72] mt-1">
            Verification, moderation, human sign-off, and cryptographic provenance built into every
            artefact.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trustCards.map((card) => (
            <div
              key={card.title}
              className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-2"
            >
              <h3 className="text-base font-extrabold text-[#1C192E]">{card.title}</h3>
              <p className="text-sm text-[#534D72] leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 5: Who it is for */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1C192E]">05. Who it is for</h2>
          <p className="text-sm text-[#534D72] mt-1">
            Built for operators who need high-consistency multi-format publishing from authoritative
            sources.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userGroups.map((u) => (
            <div
              key={u.group}
              className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[#5E60CE]">
                <Users className="w-4 h-4" />
                <span>OPERATOR GROUP</span>
              </div>
              <h3 className="text-base font-extrabold text-[#1C192E]">{u.group}</h3>
              <p className="text-sm text-[#534D72] leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 6: Limits we state openly */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1C192E]">
            06. Limits we state openly
          </h2>
          <p className="text-sm text-[#534D72] mt-1">
            Clear architectural boundaries so you know exactly what Artefact.AI does and does not do.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openLimits.map((lim) => (
            <div
              key={lim.title}
              className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-1.5"
            >
              <h3 className="text-base font-extrabold text-[#1C192E]">{lim.title}</h3>
              <p className="text-sm text-[#534D72] leading-relaxed">{lim.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E8E2F7] pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[#534D72]">
        <div className="font-display font-extrabold text-[#1C192E] text-base">
          Artefact.AI
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="hover:text-[#5E60CE] transition-colors"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/verify')}
            className="hover:text-[#5E60CE] transition-colors"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/terms')}
            className="hover:text-[#5E60CE] transition-colors"
          >
            Terms and Conditions
          </button>
          <a
            href={`mailto:${contactEmail}`}
            className="hover:text-[#5E60CE] transition-colors font-mono text-xs"
          >
            {contactEmail}
          </a>
        </div>
      </footer>
    </div>
  );
};
