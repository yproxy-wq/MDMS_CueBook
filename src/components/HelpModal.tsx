
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Music, Users, Settings2, ShieldCheck, Sparkles, Layout, ClipboardList, HelpCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { INITIAL_SCENARIO } from '../constants';
import { APP_VERSION } from '../config/version';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
}

const ManualPhaseSection: React.FC<{ phaseIds: string[], themeColor: string }> = ({ phaseIds, themeColor }) => {
  const phases = INITIAL_SCENARIO.phases.filter(p => phaseIds.includes(p.id));
  
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {phases.map((phase) => (
        <section key={phase.id} className="space-y-6">
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0" style={{ color: themeColor }}>
              <span className="text-[10px] font-mono font-bold">{phase.id.split('-')[1]}</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-white">{phase.name}</h4>
              <p className="text-xs text-white/40">{phase.description}</p>
            </div>
          </div>

          <div className="prose prose-invert prose-sm max-w-none">
            {phase.scriptBlocks.map((block, idx) => (
              <div key={idx} className="mb-8 last:mb-0">
                {block.type === 'markdown' ? (
                  <div className="markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        img: (props) => (
                          <span className="block my-6 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-1 shadow-2xl">
                            <img 
                              src={props.src}
                              alt={props.alt}
                              className="w-full max-w-full h-auto rounded-lg mx-auto"
                              referrerPolicy="no-referrer"
                            />
                          </span>
                        ),
                        a: (props) => (
                          <a 
                            href={props.href} 
                            title={props.title}
                            className="text-sky-400 hover:text-sky-300 underline transition-colors" 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            {props.children}
                          </a>
                        )
                      }}
                    >
                      {block.content}
                    </ReactMarkdown>
                  </div>
                ) : block.type === 'outline' ? (
                  <div className="p-6 bg-white/[0.02] border border-white/10 rounded-2xl markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        img: (props) => (
                          <span className="block my-6 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-1 shadow-2xl">
                            <img 
                              src={props.src}
                              alt={props.alt}
                              className="w-full max-w-full h-auto rounded-lg mx-auto"
                              referrerPolicy="no-referrer"
                            />
                          </span>
                        ),
                        a: (props) => (
                          <a 
                            href={props.href} 
                            title={props.title}
                            className="text-sky-400 hover:text-sky-300 underline transition-colors" 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            {props.children}
                          </a>
                        )
                      }}
                    >
                      {block.content}
                    </ReactMarkdown>
                  </div>
                ) : block.type === 'pdf' ? (
                  <div className="p-4 bg-sky-500/5 border border-sky-500/20 rounded-xl flex items-center gap-3">
                    <Layout size={16} className="text-sky-400" />
                    <span className="text-[11px] font-bold text-sky-400/80 uppercase tracking-widest">PDF Content Embedded in Script</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, themeColor }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'audio' | 'sync' | 'management' | 'advanced' | 'recovery' | 'faq' | 'updates'>('updates');

  if (!isOpen) return null;

  const tabs = [
    { id: 'updates', label: `更新(${APP_VERSION})`, icon: Sparkles },
    { id: 'basic', label: '基本・台本', icon: BookOpen },
    { id: 'audio', label: '音響演出', icon: Music },
    { id: 'sync', label: '同期・リマインダー', icon: Users },
    { id: 'management', label: '管理・運用', icon: ClipboardList },
    { id: 'recovery', label: '復旧・監視', icon: ShieldCheck },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
    { id: 'advanced', label: '設定・最適化', icon: Settings2 },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case 'updates': return <ManualPhaseSection phaseIds={['t-08-updates']} themeColor={themeColor} />;
      case 'basic': return <ManualPhaseSection phaseIds={['t-01-welcome', 't-02-script-blocks']} themeColor={themeColor} />;
      case 'audio': return <ManualPhaseSection phaseIds={['t-03-audio']} themeColor={themeColor} />;
      case 'sync': return <ManualPhaseSection phaseIds={['t-05-time-sync']} themeColor={themeColor} />;
      case 'management': return <ManualPhaseSection phaseIds={['t-04-characters', 't-06-practical']} themeColor={themeColor} />;
      case 'recovery': return <ManualPhaseSection phaseIds={['t-08-recovery']} themeColor={themeColor} />;
      case 'faq': return <ManualPhaseSection phaseIds={['t-faq']} themeColor={themeColor} />;
      case 'advanced': return <ManualPhaseSection phaseIds={['t-07-settings', 't-09-terms']} themeColor={themeColor} />;
      default: return null;
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] min-h-[600px] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full z-50 bg-black/40 backdrop-blur-sm"
        >
          <X size={24} />
        </button>

        {/* Top Icon Tabs - Navigation and Layout Header */}
        <div className="flex bg-black/50 border-b border-white/5 p-2 gap-2 shrink-0 justify-center pr-16 shadow-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-4 rounded-xl transition-all relative group flex items-center justify-center
                ${activeTab === tab.id ? 'text-white bg-white/5' : 'text-white/20 hover:text-white/40'}
              `}
              title={tab.label}
            >
              <tab.icon size={24} />
              {activeTab === tab.id && (
                <div className="absolute bottom-1 left-4 right-4 h-0.5 rounded-full" style={{ backgroundColor: themeColor }} />
              )}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-10 md:p-14 scrollbar-thin">
          <div className="max-w-4xl mx-auto h-full">
            {renderContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/80 flex items-center justify-between shrink-0">
          <p className="text-[9px] font-cinzel text-white/20 tracking-widest uppercase font-black">The Mastermind Deck / CueBook System {APP_VERSION}</p>
          <div className="flex items-center gap-4">
             <a href="/manual-a.html" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-sky-400/80 hover:text-sky-300 transition-colors uppercase font-cinzel tracking-tighter flex items-center gap-1">
               <BookOpen size={10} />
               <span>Web Manual</span>
             </a>
             <a href="https://twitter.com/BloblobberLover" target="_blank" rel="noopener" className="text-[9px] font-bold text-white/20 hover:text-sky-400 transition-colors uppercase font-cinzel tracking-tighter">Support X</a>
             <a href="https://keikeilab-net.booth.pm/" target="_blank" rel="noopener" className="text-[9px] font-bold text-white/20 hover:text-red-500 transition-colors uppercase font-cinzel tracking-tighter">Donation</a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

export default HelpModal;
