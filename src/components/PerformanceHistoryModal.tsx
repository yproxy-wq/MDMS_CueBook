
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, MapPin, History, Trash2, Download } from 'lucide-react';
import { Performance } from '../types';

interface PerformanceHistoryModalProps {
  history: Performance[];
  onRemove: (id: string) => void;
  onClose: () => void;
  themeColor: string;
}

const PerformanceHistoryModal: React.FC<PerformanceHistoryModalProps> = ({ history, onRemove, onClose, themeColor }) => {
  const downloadReport = (entry: Performance) => {
    const hasTimeline = entry.phases && entry.phases.length > 0 && entry.phaseResults;
    
    let totalSeconds = 0;
    if (hasTimeline && entry.phases && entry.phaseResults) {
      totalSeconds = entry.phases.reduce((sum, p) => sum + (entry.phaseResults?.[p.id] || 0), 0);
    }
    const sessionStartTimeMs = entry.timestamp - totalSeconds * 1000;

    const formatSeconds = (totalSecs: number) => {
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = Math.round(totalSecs % 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatDate = (ts: number) => {
      try {
        return new Date(ts).toLocaleString('ja-JP', { timeZoneName: 'short' });
      } catch {
        return new Date(ts).toISOString();
      }
    };

    const reportLines = [
      `================================================================================`,
      ` CUEBOOK - PERFORMANCE SESSION REPORT`,
      `================================================================================`,
      `Scenario:       ${entry.scenarioTitle}`,
      `Date:           ${entry.date}`,
      `Venue:          ${entry.venue || 'No venue configured'}`,
      `Logged At:      ${formatDate(entry.timestamp)}`,
      `================================================================================`,
      ``,
      `--------------------------------------------------------------------------------`,
      ` CAST & PLAYERS`,
      `--------------------------------------------------------------------------------`,
      ...entry.cast.map(c => `${c.characterName.padEnd(20)} : ${c.playerName || '---'}`),
      ``,
    ];

    if (hasTimeline && entry.phases && entry.phaseResults) {
      reportLines.push(
        `--------------------------------------------------------------------------------`,
        ` PHASE PROGRESSION TIMELINE`,
        `--------------------------------------------------------------------------------`,
        `Total Session Duration: ${formatSeconds(totalSeconds)}`,
        `Session Started At:     ${new Date(sessionStartTimeMs).toLocaleTimeString('ja-JP')}`,
        ``
      );

      let currentOffset = 0;
      entry.phases.forEach((p, idx) => {
        const actualSeconds = entry.phaseResults?.[p.id] || 0;
        const expectedSeconds = (p.targetDurationMinutes || 0) * 60;
        
        const startAbs = new Date(sessionStartTimeMs + currentOffset * 1000).toLocaleTimeString('ja-JP');
        const endAbs = new Date(sessionStartTimeMs + (currentOffset + actualSeconds) * 1000).toLocaleTimeString('ja-JP');
        
        const relativeStart = formatSeconds(currentOffset);
        const relativeEnd = formatSeconds(currentOffset + actualSeconds);
        const actualDurationStr = formatSeconds(actualSeconds);
        const expectedDurationStr = expectedSeconds > 0 ? formatSeconds(expectedSeconds) : '---';

        let statusStr = 'COMPLETED';
        if (expectedSeconds > 0) {
          const diff = actualSeconds - expectedSeconds;
          if (diff > 0) {
            statusStr = `OVERTIME (+${formatSeconds(diff)})`;
          } else if (diff < 0) {
            statusStr = `UNDERTIME (-${formatSeconds(Math.abs(diff))})`;
          } else {
            statusStr = `ON TIME`;
          }
        }

        reportLines.push(
          `PHASE ${idx + 1}: ${p.name}`,
          `  - Start Time (Relative): ${relativeStart} (Elapsed)`,
          `  - Start Time (Absolute): ${startAbs}`,
          `  - End Time (Relative):   ${relativeEnd}`,
          `  - End Time (Absolute):   ${endAbs}`,
          `  - Expected Duration:     ${expectedDurationStr}`,
          `  - Actual Duration:       ${actualDurationStr}`,
          `  - Status:                ${statusStr}`,
          ``
        );

        currentOffset += actualSeconds;
      });
    } else {
      reportLines.push(
        `--------------------------------------------------------------------------------`,
        ` TIMELINE DIAGNOSTICS`,
        `--------------------------------------------------------------------------------`,
        `Note: Detailed phase timelines are not available for this record.`,
        `Either the session was completed prior to updating, or no phase results were saved.`,
        ``
      );
    }

    reportLines.push(
      `================================================================================`,
      ` Generated by CueBook — Elegant TRPG/Production Audio Sync Engine`,
      `================================================================================`
    );

    const report = reportLines.join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${entry.scenarioTitle.replace(/\s+/g, '_')}_${entry.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <History size={20} style={{ color: themeColor }} />
            <h3 className="font-cinzel font-bold text-lg tracking-widest text-white">セッション履歴の一覧</h3>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-1">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <History size={48} className="mb-4" />
              <p className="font-cinzel font-bold tracking-widest uppercase">セッション履歴がまだ記録されていません</p>
            </div>
          ) : (
            history.sort((a,b) => b.timestamp - a.timestamp).map((entry) => (
              <div key={entry.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden group">
                <div className="p-4 bg-white/5 flex items-center justify-between border-b border-white/5">
                  <div className="min-w-0">
                    <h4 className="font-cinzel font-bold text-white tracking-wider truncate">{entry.scenarioTitle}</h4>
                    <div className="flex items-center gap-3 mt-1 opacity-40">
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <Calendar size={10} /> {entry.date}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <MapPin size={10} /> {entry.venue || '未設定の会場'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadReport(entry)}
                      className="p-2 text-white/20 hover:text-white transition-colors"
                      title="レポートをダウンロード"
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      onClick={() => {
                          if(window.confirm('この記録を削除しますか？')) onRemove(entry.id);
                      }}
                      className="p-2 text-white/10 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {entry.cast.map((c, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="text-[9px] font-bold text-white/20 uppercase font-cinzel leading-none">{c.characterName}</div>
                      <div className="text-[11px] font-cinzel text-white/60 truncate">{c.playerName || '---'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-white/[0.02] text-center shrink-0">
          <p className="text-[9px] font-cinzel text-white/10 tracking-[0.2em] uppercase">セッション履歴データ — ローカル保存＆クラウド同期済み</p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

export default PerformanceHistoryModal;
