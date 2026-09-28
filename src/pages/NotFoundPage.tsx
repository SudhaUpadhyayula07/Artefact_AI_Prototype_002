import React from 'react';
import { ArrowLeft, FileQuestion } from 'lucide-react';

interface NotFoundPageProps {
  onNavigate: (route: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-xl mx-auto py-16">
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-8 text-center space-y-4">
        <div className="w-12 h-12 bg-[#F8F6FF] border border-[#B794F4] rounded-md flex items-center justify-center mx-auto">
          <FileQuestion className="w-6 h-6 text-[#5E60CE]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#1C192E]">Page Not Found</h1>
        <p className="text-sm text-[#534D72]">
          The requested route does not exist in Artefact.AI. Return to the operator dashboard or
          home page.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="px-4 py-2 bg-[#7B6DFF] hover:bg-[#5E60CE] text-white text-xs font-semibold rounded-md flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Open Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-4 py-2 bg-[#F8F6FF] border border-[#B794F4] text-xs font-semibold text-[#1C192E] rounded-md"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
};
