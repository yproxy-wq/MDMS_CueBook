import React, { memo } from 'react';
import { DebouncedTextarea } from './DebouncedInput';

interface OutlineEditorProps {
  initialContent: string;
  onChange: (md: string) => void;
}

const OutlineEditor: React.FC<OutlineEditorProps> = ({ initialContent, onChange }) => {
  return (
    <div className="space-y-4">
      <DebouncedTextarea 
        initialValue={initialContent} 
        onChange={onChange} 
        className="w-full h-40 bg-black/40 border border-white/10 rounded-xl p-4 text-[14px] leading-relaxed text-white/80 outline-none focus:border-white/30 transition-all font-mono" 
        placeholder="アウトライン形式で入力 (例: - 項目1)..." 
      />
    </div>
  );
};

export default memo(OutlineEditor);
