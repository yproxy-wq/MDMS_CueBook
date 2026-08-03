
import React, { useState } from 'react';
import { Scenario } from '../../types';
import { Fingerprint, Eye, EyeOff, Calendar, FileCode, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';

interface IdentityTabProps {
  scenario: Scenario;
  user: User | null;
  onUpdate: (updates: Partial<Scenario>) => void;
}

export const IdentityTab: React.FC<IdentityTabProps> = React.memo(({ scenario, user, onUpdate }) => {
  const [showUid, setShowUid] = useState(false);

  const updateBranchId = (val: string) => {
    // IDとして安全な文字列のみ許可 (英数、ハイフン、アンダースコア)
    const sanitized = val.replace(/[^a-zA-Z0-9_-]/g, '');
    onUpdate({ branchId: sanitized });
  };

  const formatDate = (ts?: number) => {
    if (!ts) return 'Unknown';
    return new Date(ts).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
      <h3 className="text-xl font-cinzel font-bold text-white/40 uppercase tracking-[0.3em] flex items-center gap-3">
        <Fingerprint size={24} /> プロジェクト・アイデンティティ
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* GM Identity Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <UserIcon size={14} className="text-sky-500" />
            <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest font-cinzel">GM Identity (Google Account)</span>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest block">Logged in as</label>
              <div className="text-[10px] text-white/40 font-mono">{user?.email || 'No email associated'}</div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest block">Unique User ID (UID)</label>
              <div className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl p-3">
                <span className="text-[11px] font-mono text-white/60 truncate flex-1 leading-none">
                  {showUid ? user?.uid : '••••••••••••••••••••••••••••••••'}
                </span>
                <button 
                  onClick={() => setShowUid(!showUid)}
                  className="p-1.5 text-white/20 hover:text-white transition-colors"
                  title={showUid ? "Hide ID" : "Show ID"}
                >
                  {showUid ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[8px] text-white/20 mt-1">※このIDはあなたのGoogleアカウント固有のもので、Syncタイマー等のセッション識別に使用されます。</p>
            </div>
          </div>
        </div>

        {/* Scenario Identity Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <FileCode size={14} className="text-purple-500" />
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest font-cinzel">Scenario Identity</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest block">Display Name</label>
              <div className="text-white font-bold">{scenario.title || 'Untitled Scenario'}</div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest block">Scenario ID</label>
              <div className="bg-black/40 border border-white/5 rounded-xl p-3">
                <span className="text-[11px] font-mono text-white/60 truncate block leading-none">
                  {scenario.id}
                </span>
              </div>
              <p className="text-[8px] text-white/20 mt-1">※このIDはエクスポートされるJSONファイル内に保持され、シナリオを識別します。</p>
            </div>

            <div className="pt-4 flex items-center gap-2 border-t border-white/5">
              <Calendar size={12} className="text-white/20" />
              <div className="space-y-0.5">
                <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest block">Last Updated</label>
                <div className="text-[10px] text-white/40 font-mono">{formatDate(scenario.lastUpdated)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Session ID Preview */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-cinzel">Sync Session Identity</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block font-cinzel">Current Scenario ID</label>
                <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                  <span className="text-xs font-mono text-white/60">{scenario.id}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block font-cinzel">Branch ID / Suffix (枝番)</label>
                <input 
                  type="text"
                  value={scenario.branchId || ''}
                  onChange={(e) => updateBranchId(e.target.value)}
                  placeholder="e.g. table-A, unit-02"
                  className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 text-xs font-mono text-emerald-400 placeholder:text-emerald-900 focus:border-emerald-500/40 outline-none transition-all"
                />
                <p className="text-[9px] text-white/20">※複数卓を同時に回す場合などに設定すると、卓ごとに同期データを分離できます。</p>
              </div>
            </div>

            <div className="p-6 bg-black/60 rounded-2xl border border-white/5 space-y-4">
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block font-cinzel text-center">Generated Session ID (Internal)</label>
              <div className="flex items-center justify-center gap-2">
                <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-mono text-white/20 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title="User UID">
                  {user?.uid ? (showUid ? user.uid : 'UID••••••••') : 'GUEST'}
                </div>
                <span className="text-white/10">+</span>
                <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-mono text-white/40">
                  {scenario.id}
                </div>
                {scenario.branchId && (
                  <>
                    <span className="text-emerald-500/40">+</span>
                    <div className="px-3 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 text-[10px] font-mono text-emerald-400 animate-in zoom-in duration-300">
                      _{scenario.branchId}
                    </div>
                  </>
                )}
              </div>
              <p className="text-[9px] text-white/10 text-center italic">このSession IDがFirestore上のドキュメントパスとして使用されます。</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
        <p className="text-[10px] text-amber-500/60 leading-relaxed">
          <span className="font-bold">Tips:</span> Syncタイマーや個別メッセージの送信先URLは、上記の「UID」と「Scenario ID」の組み合わせによって生成されます。同じシナリオIDであっても、GMが異なれば（UIDが異なれば）URLも異なるため、データが混ざることはありません。
        </p>
      </div>
    </div>
  );
});
