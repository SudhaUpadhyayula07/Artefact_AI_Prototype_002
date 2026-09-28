import React, { useRef, useState } from 'react';
import { Download, FileCode, Image as ImageIcon } from 'lucide-react';
import type { InfographicOutput } from '../types/artefact';

interface InfographicCanvasProps {
  data: InfographicOutput;
  watermarkId: string;
  sha256: string;
}

export const InfographicCanvas: React.FC<InfographicCanvasProps> = ({
  data,
  watermarkId,
  sha256,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [exportingPng, setExportingPng] = useState(false);

  const stats = (data.statistics || []).slice(0, 6);
  const sections = (data.sections || []).slice(0, 6);
  const statRows = Math.ceil(Math.max(1, stats.length) / 3);
  const sectionsStartY = 225 + statRows * 135;
  const ctaY = sectionsStartY + sections.length * 120 + 16;
  const totalHeight = 320 + statRows * 140 + sections.length * 125 + 160;

  const serializeSvg = (): string => {
    if (!svgRef.current) return '';
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgRef.current);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n${source}`;
  };

  const handleDownloadSvg = () => {
    const svgString = serializeSvg();
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artefact-infographic-${watermarkId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const svgString = serializeSvg();
    if (!svgString) return;
    setExportingPng(true);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // High-DPI PNG export
      canvas.width = 1200 * scale;
      canvas.height = totalHeight * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.fillStyle = '#F8F6FF';
        ctx.fillRect(0, 0, 1200, totalHeight);
        ctx.drawImage(img, 0, 0, 1200, totalHeight);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `artefact-infographic-${watermarkId}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);
          }
          setExportingPng(false);
        }, 'image/png');
      } else {
        setExportingPng(false);
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setExportingPng(false);
    };
    img.src = url;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E8E2F7] rounded-lg p-4">
        <div>
          <p className="text-sm font-semibold text-[#1C192E]">
            Rendered Infographic Canvas
          </p>
          <p className="text-xs text-[#534D72]">
            Layout recommendation: {data.layoutRecommendation || 'Structured multi-section grid'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] transition-colors whitespace-nowrap"
          >
            <FileCode className="w-4 h-4 text-[#5E60CE]" />
            Download SVG
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={exportingPng}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors whitespace-nowrap disabled:opacity-60"
          >
            <ImageIcon className="w-4 h-4" />
            {exportingPng ? 'Rendering PNG...' : 'Download PNG'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#E8E2F7] rounded-lg p-4 overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 1200 ${totalHeight}`}
          className="w-full h-auto max-w-[1200px] mx-auto block rounded-lg border border-[#E8E2F7]"
          fill="none"
          role="img"
          aria-label={`Infographic: ${data.headline}`}
        >
          <rect width="1200" height={totalHeight} fill="#F8F6FF" />

          {/* Flat Header Banner */}
          <rect x="48" y="36" width="1104" height="148" rx="8" fill="#5E60CE" />
          <rect x="1108" y="52" width="24" height="24" rx="4" fill="#E0AAFF" />
          <text
            x="80"
            y="96"
            fontFamily="Poppins, Inter, sans-serif"
            fontWeight="800"
            fontSize="26"
            fill="#FFFFFF"
          >
            {(data.headline || '').slice(0, 72)}
          </text>
          <text
            x="80"
            y="130"
            fontFamily="Inter, sans-serif"
            fontWeight="500"
            fontSize="15"
            fill="#E0AAFF"
          >
            {(data.subtitle || '').slice(0, 110)}
          </text>
          <text
            x="80"
            y="162"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="400"
            fontSize="11"
            fill="#FFFFFF"
          >
            WATERMARK ID: {watermarkId}
          </text>

          {/* Statistics Grid */}
          {stats.map((stat, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const x = 48 + col * 372;
            const y = 210 + row * 135;
            return (
              <g key={idx} transform={`translate(${x}, ${y})`}>
                <rect
                  width="348"
                  height="115"
                  rx="8"
                  fill="#FFFFFF"
                  stroke="#E8E2F7"
                  strokeWidth="1.5"
                />
                <rect x="0" y="0" width="6" height="115" rx="3" fill="#5E60CE" />
                <text
                  x="24"
                  y="46"
                  fontFamily="Poppins, Inter, sans-serif"
                  fontWeight="800"
                  fontSize="24"
                  fill="#5E60CE"
                >
                  {(stat.value || '').slice(0, 22)}
                </text>
                <text
                  x="24"
                  y="74"
                  fontFamily="Inter, sans-serif"
                  fontWeight="600"
                  fontSize="14"
                  fill="#1C192E"
                >
                  {(stat.label || '').slice(0, 42)}
                </text>
                <text
                  x="24"
                  y="96"
                  fontFamily="Inter, sans-serif"
                  fontWeight="400"
                  fontSize="12"
                  fill="#534D72"
                >
                  {(stat.context || '').slice(0, 52)}
                </text>
              </g>
            );
          })}

          {/* Structured Sections */}
          {sections.map((sec, idx) => {
            const y = sectionsStartY + idx * 120;
            const line1 = (sec.summary || '').slice(0, 115);
            const line2 = (sec.summary || '').slice(115, 230);
            return (
              <g key={idx} transform={`translate(48, ${y})`}>
                <rect
                  width="1104"
                  height="104"
                  rx="8"
                  fill="#FFFFFF"
                  stroke="#E8E2F7"
                  strokeWidth="1.5"
                />
                <rect
                  x="20"
                  y="22"
                  width="44"
                  height="44"
                  rx="8"
                  fill="#F8F6FF"
                  stroke="#B794F4"
                  strokeWidth="1.5"
                />
                <text
                  x="42"
                  y="50"
                  textAnchor="middle"
                  fontFamily="Poppins, sans-serif"
                  fontWeight="800"
                  fontSize="16"
                  fill="#5E60CE"
                >
                  0{idx + 1}
                </text>
                <text
                  x="84"
                  y="40"
                  fontFamily="Poppins, Inter, sans-serif"
                  fontWeight="800"
                  fontSize="17"
                  fill="#1C192E"
                >
                  {(sec.title || '').slice(0, 82)}
                </text>
                <text
                  x="84"
                  y="66"
                  fontFamily="Inter, sans-serif"
                  fontWeight="400"
                  fontSize="13"
                  fill="#534D72"
                >
                  {line1}
                </text>
                {line2 && (
                  <text
                    x="84"
                    y="86"
                    fontFamily="Inter, sans-serif"
                    fontWeight="400"
                    fontSize="13"
                    fill="#534D72"
                  >
                    {line2}
                  </text>
                )}
              </g>
            );
          })}

          {/* Call to Action Box */}
          <g transform={`translate(48, ${ctaY})`}>
            <rect width="1104" height="76" rx="8" fill="#1C192E" />
            <text
              x="28"
              y="32"
              fontFamily="Poppins, Inter, sans-serif"
              fontWeight="800"
              fontSize="14"
              fill="#E0AAFF"
            >
              RECOMMENDED NEXT STEP
            </text>
            <text
              x="28"
              y="55"
              fontFamily="Inter, sans-serif"
              fontWeight="400"
              fontSize="13"
              fill="#FFFFFF"
            >
              {(data.callToAction || '').slice(0, 125)}
            </text>
          </g>

          {/* Provenance Footer */}
          <text
            x="48"
            y={totalHeight - 22}
            fontFamily="JetBrains Mono, monospace"
            fontSize="11"
            fill="#534D72"
          >
            PROVENANCE WATERMARK: {watermarkId} | SHA-256: {sha256}
          </text>
        </svg>
      </div>

      {/* Key Messages & Accessible Text Version */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E8E2F7] rounded-lg p-4">
          <h4 className="text-sm font-bold text-[#1C192E] mb-2">Key Messages</h4>
          <ul className="space-y-1.5 text-sm text-[#534D72] list-disc pl-5">
            {(data.keyMessages || []).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-[#E8E2F7] rounded-lg p-4">
          <h4 className="text-sm font-bold text-[#1C192E] mb-2">
            Readable Text Version (Accessibility)
          </h4>
          <p className="text-sm text-[#534D72] whitespace-pre-line leading-relaxed">
            {data.readableTextVersion}
          </p>
        </div>
      </div>
    </div>
  );
};
