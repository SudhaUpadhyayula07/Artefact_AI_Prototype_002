import React from 'react';

interface TermsPageProps {
  contactEmail: string;
}

export const TermsPage: React.FC<TermsPageProps> = ({ contactEmail }) => {
  const sections = [
    { id: 'acceptance', title: '1. Acceptance of Terms' },
    { id: 'description', title: '2. Description of the Service' },
    { id: 'operator-responsibilities', title: '3. Operator Responsibilities' },
    { id: 'acceptable-use', title: '4. Acceptable Use Policy' },
    { id: 'source-content', title: '5. Source Content and Third-Party Rights' },
    { id: 'human-review', title: '6. AI-Generated Output and Human Review' },
    { id: 'accuracy-limits', title: '7. Accuracy and Validation Limits' },
    { id: 'moderation', title: '8. Safety and Content Moderation' },
    { id: 'provenance', title: '9. Provenance, Watermarking, and Local Hash Ledger' },
    { id: 'privacy', title: '10. Data Handling and Privacy' },
    { id: 'api-key-security', title: '11. API Key Security' },
    { id: 'availability', title: '12. Availability and Rate Limits' },
    { id: 'intellectual-property', title: '13. Intellectual Property' },
    { id: 'disclaimers', title: '14. Disclaimers' },
    { id: 'liability', title: '15. Limitation of Liability' },
    { id: 'changes', title: '16. Changes to These Terms' },
    { id: 'governing-law', title: '17. Governing Law and Contact' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 md:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#534D72]">
          <span>LEGAL DOCUMENTATION</span>
          <span>Last updated: September 28, 2026</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1C192E]">
          Terms and Conditions of Use
        </h1>
        <div className="bg-[#F8F6FF] border border-[#B794F4] rounded-md p-4 text-xs text-[#1C192E] leading-relaxed">
          <strong>Legal Draft Notice:</strong> This document is a starting draft prepared for
          deployments of Artefact.AI and should be reviewed and adapted by qualified legal counsel
          before commercial or institutional publication. Bracketed items such as{' '}
          <code className="font-mono">[OWNER_ENTITY_NAME]</code> and{' '}
          <code className="font-mono">[GOVERNING_JURISDICTION]</code> are placeholders for the
          deploying organisation to replace.
        </div>
      </div>

      {/* Table of Contents */}
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6">
        <h2 className="text-base font-extrabold text-[#1C192E] mb-3">Table of Contents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-[#5E60CE] hover:text-[#7B6DFF] hover:underline transition-colors"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 md:p-8 space-y-8 text-sm text-[#1C192E] leading-relaxed">
        <section id="acceptance" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">1. Acceptance of Terms</h2>
          <p className="text-[#534D72]">
            By accessing or running transformations within Artefact.AI (operated by{' '}
            <code className="font-mono text-[#1C192E]">[OWNER_ENTITY_NAME]</code>), you agree to be
            bound by these Terms and Conditions. Before initiating your first transformation run in
            the dashboard, you must explicitly confirm acceptance of these terms. If you do not
            agree, do not use the application.
          </p>
        </section>

        <section id="description" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">2. Description of the Service</h2>
          <p className="text-[#534D72]">
            Artefact.AI is a multi-format content transformation and verification web application. It
            accepts operator-provided source material (text, prompts, documents, images, audio,
            video, and web links), builds a structured fact base, generates selected communication
            outputs, validates claims against the provided source, and records cryptographic SHA-256
            hashes in a local ledger.
          </p>
        </section>

        <section id="operator-responsibilities" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">3. Operator Responsibilities</h2>
          <p className="text-[#534D72]">
            As the operator, you are responsible for verifying that your source bundle is complete,
            accurate, and lawful to process. You are responsible for reviewing all generated outputs,
            validation scores, claim tables, and consistency alerts before distributing or publishing
            any exported file.
          </p>
        </section>

        <section id="acceptable-use" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">4. Acceptable Use Policy</h2>
          <p className="text-[#534D72]">
            You may not use Artefact.AI to generate, amplify, or distribute content that is unlawful,
            defamatory, harassing, hateful, sexually explicit, deceptive, or designed to facilitate
            cyberattacks, fraud, or physical harm. You may not attempt to bypass server-side rate
            limits, SSRF network protections, or safety moderation checks.
          </p>
        </section>

        <section id="source-content" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">
            5. Source Content and Third-Party Rights
          </h2>
          <p className="text-[#534D72]">
            You represent and warrant that you hold all necessary rights, licences, or permissions to
            submit the text, documents, media files, and URLs you provide to Artefact.AI, and that
            transforming such material does not infringe any copyright, trade secret, privacy right,
            or confidentiality obligation owed to a third party.
          </p>
        </section>

        <section id="human-review" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">
            6. AI-Generated Output and the Need for Human Review
          </h2>
          <p className="text-[#534D72]">
            Every communication artefact is generated by automated language models from your source
            material. Automated outputs can omit context, misinterpret nuance, or phrase statements
            imprecisely. Human review and sign-off are mandatory before relying on any output for
            medical, legal, financial, regulatory, security, or public safety decisions.
          </p>
        </section>

        <section id="accuracy-limits" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">
            7. Accuracy and Validation Limits
          </h2>
          <p className="text-[#534D72]">
            The Validator Agent checks generated outputs against the submitted source text, not
            against external world knowledge. If the source material itself contains errors, the
            generated outputs will reflect those errors. A high validation score indicates alignment
            with the submitted source bundle, not independent factual truth.
          </p>
        </section>

        <section id="moderation" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">
            8. Safety and Content Moderation
          </h2>
          <p className="text-[#534D72]">
            Artefact.AI runs automated moderation checks on both input sources and generated outputs
            across six categories: hate, harassment, dangerous content, sexual content,
            misinformation risk, and personal data. High-severity violations are blocked
            automatically. If the moderation service is temporarily unreachable, the operator must
            explicitly confirm before continuing.
          </p>
        </section>

        <section id="provenance" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">
            9. Provenance, Watermarking, and Local Hash Ledger Explained
          </h2>
          <p className="text-[#534D72]">
            Artefact.AI stamps every generated output with a unique Watermark ID formatted as{' '}
            <code className="font-mono text-[#1C192E]">ARTF-XXXX-XXXX-XXXX</code> and computes a
            SHA-256 hash of the normalised content.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#534D72]">
            <li>
              <strong>Visible Footer and Metadata:</strong> Exported DOCX, PPTX, PDF, SVG, PNG,
              Markdown, and TXT files include the Watermark ID and SHA-256 fingerprint in their
              visible footer and file properties/metadata.
            </li>
            <li>
              <strong>Invisible Zero-Width Marker:</strong> Plain-text and Markdown exports also
              embed an invisible sequence of zero-width Unicode characters (<code className="font-mono">U+200B</code> and{' '}
              <code className="font-mono">U+200C</code>) encoding the binary bits of the Watermark ID
              so that copied text can still be matched to its run on the Verify page even if the
              visible footer is removed.
            </li>
            <li>
              <strong>Local Hash Chain Scope:</strong> Each run appends a block containing the run
              ID, timestamp, source hash, output hashes, batch hash, and previous block hash to{' '}
              <code className="font-mono">data/ledger.json</code> on the server. This ledger is a
              tamper-evident local hash chain stored on the application server. It is{' '}
              <strong>not</strong> a decentralised or public blockchain.
            </li>
          </ul>
        </section>

        <section id="privacy" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">10. Data Handling and Privacy</h2>
          <p className="text-[#534D72]">
            When you extract media or run a transformation, your source content is sent from the
            Artefact.AI server to Google&apos;s Gemini API for processing. Full run history,
            generated drafts, and control presets are stored locally in your browser&apos;s{' '}
            <code className="font-mono">localStorage</code> and can be exported or cleared at any
            time from the History or Settings screens. The server-side ledger (
            <code className="font-mono">data/ledger.json</code>) stores cryptographic SHA-256 hashes,
            watermark IDs, run titles, timestamps, and short verification tokens rather than your
            full source documents.
          </p>
        </section>

        <section id="api-key-security" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">11. API Key Security</h2>
          <p className="text-[#534D72]">
            The Gemini API key (<code className="font-mono">GEMINI_API_KEY</code>) is read
            exclusively on the server and is never transmitted to the client browser, included in
            client bundles, or written to exported files.
          </p>
        </section>

        <section id="availability" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">12. Availability and Rate Limits</h2>
          <p className="text-[#534D72]">
            To maintain service stability and respect upstream model quotas, Artefact.AI enforces
            per-IP API rate limits, a 25 MB maximum upload size, a 4 MB URL fetch cap, and a
            concurrency cap of 3 parallel specialist calls per run.
          </p>
        </section>

        <section id="intellectual-property" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">13. Intellectual Property</h2>
          <p className="text-[#534D72]">
            As between you and <code className="font-mono text-[#1C192E]">[OWNER_ENTITY_NAME]</code>,
            you retain all rights to the source content you submit. Subject to applicable law and
            third-party rights in the underlying source material, you may use the generated outputs
            for your internal or external communications once reviewed and approved.
          </p>
        </section>

        <section id="disclaimers" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">14. Disclaimers</h2>
          <p className="text-[#534D72]">
            ARTEFACT.AI IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
            OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT.
          </p>
        </section>

        <section id="liability" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">15. Limitation of Liability</h2>
          <p className="text-[#534D72]">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW,{' '}
            <code className="font-mono text-[#1C192E]">[OWNER_ENTITY_NAME]</code> SHALL NOT BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, OR FOR ANY
            LOSS OF DATA, REPUTATION, OR REVENUE ARISING FROM YOUR USE OF ARTEFACT.AI OR ANY
            GENERATED OUTPUT.
          </p>
        </section>

        <section id="changes" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">16. Changes to These Terms</h2>
          <p className="text-[#534D72]">
            We may update these Terms from time to time by updating the &quot;Last updated&quot; date
            at the top of this page. Continued use of the service after changes take effect
            constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section id="governing-law" className="space-y-2">
          <h2 className="text-lg font-extrabold text-[#1C192E]">17. Governing Law and Contact</h2>
          <p className="text-[#534D72]">
            These Terms are governed by the laws of{' '}
            <code className="font-mono text-[#1C192E]">[GOVERNING_JURISDICTION]</code>, without
            regard to conflict of law principles. For questions regarding these Terms or provenance
            verification, contact{' '}
            <a
              href={`mailto:${contactEmail}`}
              className="text-[#5E60CE] hover:underline font-mono"
            >
              {contactEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
};
