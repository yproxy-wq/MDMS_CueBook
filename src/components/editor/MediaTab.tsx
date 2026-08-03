
import React, { useState, useCallback, useMemo } from 'react';
import { Scenario, MediaResource } from '../../types';
import { Upload, Trash2, Edit2, Check, X, Search, Image as ImageIcon, Copy, Link as LinkIcon, Plus, Video, FileText, ChevronUp, ChevronDown, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { transformDropboxUrl } from '../../utils/mediaHelper';

interface MediaTabProps {
  scenario: Scenario;
  onUpdate: (updated: Partial<Scenario>) => void;
}

export const MediaTab: React.FC<MediaTabProps> = ({ scenario, onUpdate }) => {
  const [activeSubTab, setActiveSubTab] = useState<'images' | 'playerImages'>('images');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempId, setTempId] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSequential, setIsSequential] = useState(false);
  
  const resources = useMemo(() => {
    if (activeSubTab === 'playerImages') {
      return scenario.playerImages || [];
    }
    return scenario.images || [];
  }, [scenario.images, scenario.playerImages, activeSubTab]);

  const filteredResources = useMemo(() => resources.filter(img => 
    img.id.toLowerCase().includes(search.toLowerCase()) || 
    img.name.toLowerCase().includes(search.toLowerCase())
  ), [resources, search]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === filteredResources.length && filteredResources.length > 0) {
        return new Set();
      } else {
        return new Set(filteredResources.map(r => r.id));
      }
    });
  }, [filteredResources]);

  const deleteResources = useCallback((idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    
    const isAll = idsToDelete.length === resources.length;
    const msg = isAll ? 'すべてのリソースを削除しますか？' : `${idsToDelete.length} 件のリソースを削除しますか？`;
    
    if (!confirm(msg)) return;
    
    // Create new images list by filtering out matched IDs
    const nextImages = resources.filter(img => !idsToDelete.includes(img.id));
    
    console.log('Deleting IDs from tab:', activeSubTab, idsToDelete);
    console.log('Original count:', resources.length, 'New count:', nextImages.length);

    // 1. Notify parent first to update master state
    const fieldName = activeSubTab === 'playerImages' ? 'playerImages' : 'images';
    onUpdate({
      [fieldName]: nextImages
    });
    
    // 2. Clear selected IDs that no longer exist
    setSelectedIds(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.delete(id));
      return next;
    });
  }, [resources, onUpdate, activeSubTab]);

  const deleteSelected = () => deleteResources(Array.from(selectedIds));

  const deleteAll = () => deleteResources(resources.map(img => img.id));

  const moveResource = useCallback((index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= resources.length) return;
    
    const next = [...resources];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    const fieldName = activeSubTab === 'playerImages' ? 'playerImages' : 'images';
    onUpdate({
      [fieldName]: next
    });
  }, [resources, activeSubTab, onUpdate]);

  const compressImage = (dataUrl: string, maxWidth: number = 1920): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Downscale if too large
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Target: 700KB binary equivalent. Base64 is ~1.33x binary size.
        const TARGET_SIZE = 700 * 1024;
        const TARGET_BASE64_LENGTH = TARGET_SIZE * 1.33;
        
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        // Iteratively reduce quality if still too large
        if (result.length > TARGET_BASE64_LENGTH) {
          while (result.length > TARGET_BASE64_LENGTH && quality > 0.1) {
            quality -= 0.15;
            result = canvas.toDataURL('image/jpeg', quality);
          }
        }

        // If still too large, downscale further
        if (result.length > TARGET_BASE64_LENGTH) {
          let scale = 0.7;
          while (result.length > TARGET_BASE64_LENGTH && scale > 0.2) {
            const sWidth = width * scale;
            const sHeight = height * scale;
            const sCanvas = document.createElement('canvas');
            sCanvas.width = sWidth;
            sCanvas.height = sHeight;
            const sCtx = sCanvas.getContext('2d');
            sCtx?.drawImage(img, 0, 0, sWidth, sHeight);
            result = sCanvas.toDataURL('image/jpeg', 0.4);
            scale -= 0.15;
          }
        }

        console.log(`[Image] Compressed: ${Math.round(result.length / 1024 / 1.33)}kb (Quality: ${quality.toFixed(1)})`);
        resolve(result);
      };
      img.src = dataUrl;
    });
  };

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const files = Array.from(fileList).slice(0, 10);

    const promises = files.map(async (file, index) => {
      let dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (re) => resolve(re.target?.result as string);
        reader.readAsDataURL(file);
      });

      const isVideo = file.type.startsWith('video/');
      const isPdf = file.type === 'application/pdf';

      if (!isVideo && !isPdf && file.size > 700 * 1024) {
        // ALWAYS compress if over 700kb to ensure sync stability
        dataUrl = await compressImage(dataUrl);
      }

      const prefix = isSequential ? `${String(index + 1).padStart(2, '0')}_` : '';
      return {
        id: isVideo ? `vid-${Math.random().toString(36).substring(2, 7)}` : isPdf ? `pdf-${Math.random().toString(36).substring(2, 7)}` : `img-${Math.random().toString(36).substring(2, 7)}`,
        name: prefix + file.name,
        url: dataUrl,
        type: isVideo ? 'video' : isPdf ? 'pdf' : 'image' as const,
        updatedAt: Date.now()
      };
    });

    try {
      const newResources = await Promise.all(promises);
      const fieldName = activeSubTab === 'playerImages' ? 'playerImages' : 'images';
      const existing = activeSubTab === 'playerImages' ? (scenario.playerImages || []) : (scenario.images || []);
      onUpdate({
        [fieldName]: [...existing, ...newResources]
      });
    } catch (err) {
      console.error('Failed to upload files', err);
    }
    
    // Reset input
    e.target.value = '';
  }, [scenario.images, scenario.playerImages, onUpdate, isSequential, activeSubTab]);

  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return;

    const urls = newLinkUrl.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // We update local state in sequence
    const fieldName = activeSubTab === 'playerImages' ? 'playerImages' : 'images';
    let currentImages = [...(activeSubTab === 'playerImages' ? (scenario.playerImages || []) : (scenario.images || []))];
    
    for (let i = 0; i < urls.length; i++) {
        const transformedUrl = transformDropboxUrl(urls[i]);
        const isVideo = /\.(mp4|webm|ogg|mov|m4v|mkv)(\?.*)?$/i.test(transformedUrl);
        const isPdf = /\.pdf(\?.*)?$/i.test(transformedUrl);
        
        const idPrefix = isVideo ? 'vid' : isPdf ? 'pdf' : 'img';
        
        const newResource: MediaResource = {
            id: `${idPrefix}-${Math.random().toString(36).substring(2, 7)}`,
            name: newLinkName.trim() || (isVideo ? 'Remote Video' : isPdf ? 'Remote PDF' : 'Remote Image'),
            url: transformedUrl,
            type: isVideo ? 'video' : isPdf ? 'pdf' : 'image',
            updatedAt: Date.now()
        };
        
        currentImages = [...currentImages, newResource];
        onUpdate({
            [fieldName]: currentImages
        });

        if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    setNewLinkUrl('');
    setNewLinkName('');
  };

  const startEditing = (img: MediaResource) => {
    setEditingId(img.id);
    setTempId(img.id);
  };

  const saveId = (oldId: string) => {
    if (!tempId.trim()) return;
    if (tempId !== oldId && resources.some(img => img.id === tempId)) {
      alert('このIDは既に使用されています。');
      return;
    }
    
    const fieldName = activeSubTab === 'playerImages' ? 'playerImages' : 'images';
    onUpdate({
      [fieldName]: resources.map(img => img.id === oldId ? { ...img, id: tempId } : img)
    });
    setEditingId(null);
  };

  const copyTag = (id: string) => {
    const tag = `[[${id}]]`;
    navigator.clipboard.writeText(tag);
  };

  const getResourceSizeInfo = useCallback((url: string) => {
    if (!url) return { size: 0, isLocal: false, label: '0 KB', percentage: 0 };
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return { size: 0, isLocal: false, label: '外部リンク (URL分のみ)', percentage: 0 };
    }
    const bytes = Math.round(url.length * 0.75);
    const kb = bytes / 1024;
    return { 
      size: bytes, 
      isLocal: true, 
      label: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`,
      percentage: Math.min(100, (bytes / (1024 * 1024)) * 100)
    };
  }, []);

  const totalLocalSize = useMemo(() => {
    return resources.reduce((acc, img) => {
      if (img.url && !img.url.startsWith('http')) {
        return acc + Math.round(img.url.length * 0.75);
      }
      return acc;
    }, 0);
  }, [resources]);

  const localPdfs = useMemo(() => {
    return resources.filter(img => img.type === 'pdf' && img.url && !img.url.startsWith('http'));
  }, [resources]);

  const totalLocalPdfSize = useMemo(() => {
    return localPdfs.reduce((acc, img) => acc + Math.round(img.url.length * 0.75), 0);
  }, [localPdfs]);



  return (
    <div className="space-y-8 pb-20">
      {/* Sub tabs: GM台本 vs プレイヤー共有 */}
      <div className="flex border border-white/10 bg-black/40 backdrop-blur-md z-40 rounded-xl overflow-hidden p-1 gap-1">
        <button 
          onClick={() => { setActiveSubTab('images'); setSelectedIds(new Set()); }}
          className={`flex-1 px-4 py-2.5 transition-all rounded-lg flex flex-col text-left relative group min-w-0 border
            ${activeSubTab === 'images' ? 'bg-purple-500/10 border-purple-500/40' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}
          `}
        >
          <span className={`text-[7px] font-bold font-cinzel uppercase tracking-[0.2em] mb-1 leading-none ${activeSubTab === 'images' ? 'text-purple-400' : 'text-white/30'}`}>GM-ONLY REFERENCE</span>
          <div className="flex items-center gap-2">
            <FileText size={12} className={activeSubTab === 'images' ? 'text-purple-400' : 'text-white/40'} />
            <span className="text-xs font-extrabold text-white tracking-wide">GM台本マテリアル ({(scenario.images || []).length})</span>
          </div>
        </button>
        <button 
          onClick={() => { setActiveSubTab('playerImages'); setSelectedIds(new Set()); }}
          className={`flex-1 px-4 py-2.5 transition-all rounded-lg flex flex-col text-left relative group min-w-0 border
            ${activeSubTab === 'playerImages' ? 'bg-sky-500/10 border-sky-500/40' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}
          `}
        >
          <span className={`text-[7px] font-bold font-cinzel uppercase tracking-[0.2em] mb-1 leading-none ${activeSubTab === 'playerImages' ? 'text-sky-400' : 'text-white/30'}`}>PLAYER-SHARED SCENE</span>
          <div className="flex items-center gap-2">
            <ImageIcon size={12} className={activeSubTab === 'playerImages' ? 'text-sky-400' : 'text-white/40'} />
            <span className="text-xs font-extrabold text-white tracking-wide">プレイヤー共有画像 ({(scenario.playerImages || []).length})</span>
          </div>
        </button>
      </div>

      {/* Info Boxes */}
      {activeSubTab === 'images' ? (
        <div className="p-4 rounded-xl border border-purple-500/15 bg-purple-500/5 text-purple-200/80 text-[10.5px] leading-relaxed font-sans">
          <strong className="text-purple-300 block mb-1 text-xs">GM台本専用マテリアル保存領域:</strong>
          台本用のPDFや、シーン内でGMのみがこっそり参照したい資料、[[リソースID]] タグを使って台本中に挿入する画像を登録する領域です。
          ローカルの IndexedDB にのみ保存されるため、<span className="text-purple-400 font-extrabold">Firestoreの1MB同期制限を一切気にする必要がなく、高画質な大容量PDFも無制限に追加できます。</span>
          （※ プレイヤーの画面には直接同期されません。）
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-sky-500/15 bg-sky-500/5 text-sky-200/80 text-[10.5px] leading-relaxed font-sans">
          <strong className="text-sky-300 block mb-1 text-xs">プレイヤー共有画像保存領域:</strong>
          同期ウィンドウ（SYNC）や子ウィンドウから、プレイヤーの共有画面へ映し出したい立ち絵、背景画、状況ビジュアルなどを登録する領域です。
          子ウィンドウへリアルタイムに同期をかけるためにFirestoreを仲介するため、<span className="text-sky-400 font-extrabold">重い画像は自動的に高圧縮されてWeb最適化の上で安全に保存され、通信や同期のバグを極小に抑えます。</span>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6 pb-6">
        <div>
          <h2 className="text-2xl font-cinzel font-bold text-white flex items-center gap-3">
            <ImageIcon className="text-purple-500" /> リソース
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {resources.length > 0 && (
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={selectedIds.size === filteredResources.length && filteredResources.length > 0}
                  onChange={toggleSelectAll}
                  className="accent-purple-500 w-4 h-4" 
                />
                <span className="text-[10px] font-bold text-white/40 group-hover:text-white/60 uppercase tracking-widest whitespace-nowrap">すべて選択</span>
              </label>

              <div className="w-px h-4 bg-white/10" />

              <button 
                onClick={deleteAll}
                className="flex items-center gap-2 text-white/40 hover:text-red-400 transition-colors"
                title="すべてのリソースを削除"
              >
                <Trash2 size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">All Clear</span>
              </button>
            </div>
          )}

          {selectedIds.size > 0 && (
            <button 
              onClick={deleteSelected}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold transition-all shadow-lg shadow-red-900/40 animate-in fade-in zoom-in duration-200"
            >
              <Trash2 size={16} />
              <span>選択削除 ({selectedIds.size})</span>
            </button>
          )}

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-8 h-4 rounded-full relative transition-colors ${isSequential ? 'bg-purple-600' : 'bg-white/10'}`}>
                <div className={`absolute top-1 left-1 w-2 h-2 rounded-full bg-white transition-transform ${isSequential ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-[10px] font-bold text-white/40 group-hover:text-white/60 uppercase tracking-widest whitespace-nowrap">連番付与</span>
              <input 
                type="checkbox" 
                checked={isSequential} 
                onChange={e => setIsSequential(e.target.checked)} 
                className="hidden" 
              />
            </label>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-purple-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="ID または 名前で検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500/50 w-full md:w-48 transition-all"
            />
          </div>
          
        </div>
      </header>

      {/* Dropbox-first resource registration */}
      <section className="relative overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/15 via-blue-500/[0.07] to-black p-5 md:p-6 shadow-xl shadow-sky-950/20">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <LinkIcon size={19} className="text-sky-300" /> Dropboxから追加（推奨）
            </h3>
          </div>
          <label className="flex cursor-pointer items-center gap-2 self-start text-[10px] font-bold text-white/35 transition-colors hover:text-white/65 sm:self-auto">
            <Upload size={13} />
            <span>端末から直接追加（小容量向け）</span>
            <input type="file" accept="image/*,application/pdf,video/*" multiple onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <div className="relative mt-4 grid gap-3 border-t border-sky-300/15 pt-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-300">
              <LinkIcon size={12} /> 共有URLを貼り付けるだけ。表示用リンクへ自動変換します。
            </label>
            <textarea
              rows={2}
              placeholder="Dropboxの共有URL（1行に1つ）"
              value={newLinkUrl}
              onChange={e => setNewLinkUrl(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-sky-400/60 focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-300">
              <Edit2 size={12} /> 名前（任意）
            </label>
            <input
              type="text"
              placeholder="シーン画像、台本PDF など"
              value={newLinkName}
              onChange={e => setNewLinkName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm focus:border-sky-400/60 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleAddLink}
            disabled={!newLinkUrl.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-black text-slate-950 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus size={16} /> 追加
          </button>
        </div>
      </section>

      {/* Capacity & Size Optimization Advisor */}
      <div className="bg-zinc-950/60 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <FileText size={16} />
            </span>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-cinzel">容量最適化アドバイザー</h3>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-white/60">
              現在の総消費量: <span className="font-mono text-xs text-sky-400">{(totalLocalSize / 1024).toFixed(0)} KB</span> / 950 KB
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
            <div 
              style={{ width: `${Math.min(100, (totalLocalSize / (950 * 1024)) * 100)}%` }}
              className={`h-full transition-all duration-500 rounded-full ${
                totalLocalSize > 800 * 1024 ? 'bg-red-500' : totalLocalSize > 500 * 1024 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </div>
          <div className="flex items-center justify-between text-[8px] text-white/30 uppercase tracking-widest font-bold">
            <span>0 KB</span>
            <span>推奨安全値 (500 KB)</span>
            <span>Firestore 書込上限 (950 KB)</span>
          </div>
        </div>

        {/* Actionable Advice Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Section 1: PDF Optimization & Estimations */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2.5">
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
              <FileText size={12} /> PDF & 各種画像 解像度圧縮の見積もり
            </h4>
            <p className="text-[10px] text-white/60 leading-relaxed">
              PDFやイラストのファイルサイズが大きくなる主な原因は **埋め込まれている高画質な画像データ** です。タブレット閲覧（200-300dpi相当）の十分な解像度を維持しつつ圧縮することで劇的に改善されます。
            </p>
            {localPdfs.length > 0 ? (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2.5 space-y-1">
                <div className="text-[10px] font-bold text-white flex items-center justify-between">
                  <span>ローカルPDF ({localPdfs.length}件):</span>
                  <span className="font-mono text-purple-300">{(totalLocalPdfSize / 1024).toFixed(0)} KB</span>
                </div>
                <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-between border-t border-white/5 pt-1.5">
                  <span>タブレット向け最適化圧縮後 (見積もり-75%):</span>
                  <span className="font-mono">約 {((totalLocalPdfSize * 0.25) / 1024).toFixed(0)} KB</span>
                </div>
                <p className="text-[9px] text-white/40 leading-normal pt-1 bg-black/20 p-2 rounded mt-1">
                  【方法】PDFを再エクスポートする際、画質設定を「中」または「Web表示/タブレット表示（150dpi以下）」に指定して書き出してください。
                </p>
              </div>
            ) : (
              <div className="text-[10px] text-white/30 italic py-2">
                ※現在、容量を圧迫しているローカルPDFリソースはありません
              </div>
            )}
          </div>

          {/* Section 2: Over limit counter-measures */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2.5">
            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
              <LinkIcon size={12} /> 軽量運用の推奨方法
            </h4>
            <div className="space-y-2 text-[10px] leading-relaxed text-white/70">
              <div className="flex gap-2">
                <span className="text-amber-500 shrink-0 font-bold">1.</span>
                <div>
                  <strong className="text-white block">第一候補はDropboxリンク</strong>
                  PDFや動画、イラストなどの実ファイルをDropboxに置き、共有リンクを登録します。実ファイルをデータベースへ埋め込まないため、消費量をほぼURL情報分だけに抑えられます。
                  <span className="text-[9px] text-sky-400/90 block mt-0.5">※Dropbox共有URLは表示用の直リンクへ自動変換します。</span>
                </div>
              </div>
              <div className="flex gap-2 border-t border-white/5 pt-2">
                <span className="text-amber-500 shrink-0 font-bold">2.</span>
                <div>
                  <strong className="text-white block">PDFファイルを必要ページごとに分割する</strong>
                  多すぎる台本PDFは、自分がGM（ゲームマスター）として閲覧する対象のセクション(例: 1~5ページ)のみにあらかじめ分割して別々に登録したり切り分けることが有効です。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredResources.map((img, index) => {
            const rawIndex = resources.findIndex(r => r.id === img.id);
            const actualIndex = rawIndex !== -1 ? rawIndex : index;
            return (
              <motion.div 
                key={img.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="product__media group bg-neutral-900/40 border border-white/5 rounded-xl overflow-hidden hover:border-white/20 hover:scale-[1.02] transition-all duration-300 flex flex-col relative"
              >
                {/* Index Badge */}
                <div className="absolute top-0 left-0 z-20 bg-black/80 backdrop-blur-md text-amber-300 border-r border-b border-white/15 px-2.5 py-1 rounded-br-xl flex items-center gap-1 font-mono text-xs font-black shadow-lg">
                  <Hash size={12} className="text-amber-400" />
                  <span>{actualIndex + 1}</span>
                </div>

                {/* Up/Down Reorder Controls */}
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/10 rounded-lg p-0.5 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={actualIndex === 0}
                    onClick={() => moveResource(actualIndex, 'up')}
                    className={`p-1 rounded hover:bg-white/20 text-white/80 transition-colors ${actualIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:text-amber-300 cursor-pointer'}`}
                    title="前へ移動 (番号繰り上げ)"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    disabled={actualIndex === resources.length - 1}
                    onClick={() => moveResource(actualIndex, 'down')}
                    className={`p-1 rounded hover:bg-white/20 text-white/80 transition-colors ${actualIndex === resources.length - 1 ? 'opacity-20 cursor-not-allowed' : 'hover:text-amber-300 cursor-pointer'}`}
                    title="次へ移動 (番号繰り下げ)"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className="aspect-video bg-black/40 relative overflow-hidden flex items-center justify-center">
                  {img.type === 'video' ? (
                    <video 
                      src={img.url} 
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" 
                      muted 
                      preload="metadata"
                    />
                  ) : img.url ? (
                    <img 
                      src={img.url} 
                      alt={img.name} 
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <ImageIcon size={32} className="text-white/10" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                    <button 
                      onClick={() => copyTag(img.id)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md"
                      title="タグ [[ID]] をコピー"
                    >
                      <Copy size={18} />
                    </button>
                    <button 
                      onClick={() => deleteResources([img.id])}
                      className="p-2 bg-red-900/40 hover:bg-red-600 rounded-full text-white transition-all backdrop-blur-md"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              
              <div className="p-4 flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingId === img.id ? (
                      <div className="flex flex-col gap-2">
                        <input 
                          autoFocus
                          type="text"
                          value={tempId}
                          onChange={e => setTempId(e.target.value)}
                          className="bg-black/60 border border-purple-500/50 rounded px-2 py-1 text-sm text-white w-full focus:outline-none"
                        />
                        <input 
                          type="text"
                          value={img.name}
                          onChange={e => onUpdate({ images: resources.map(i => i.id === img.id ? { ...i, name: e.target.value } : i) })}
                          className="bg-black/60 border border-purple-500/50 rounded px-2 py-1 text-sm text-white w-full focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => saveId(img.id)} className="text-green-500 hover:text-green-400 p-1"><Check size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="text-white/20 hover:text-white/40 p-1"><X size={16} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer group/cb">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(img.id)}
                            onChange={() => toggleSelection(img.id)}
                            className="accent-purple-500 w-4 h-4 cursor-pointer" 
                          />
                          <span className="font-mono font-bold text-sm truncate text-purple-400 group-hover/cb:text-purple-300 transition-colors">[[{img.id}]]</span>
                        </label>
                        <button onClick={() => startEditing(img)} className="text-white/10 hover:text-white/40 opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={12} /></button>
                      </div>
                    )}
                    {editingId !== img.id && <div className="text-[10px] text-white/40 truncate mt-1">{img.name}</div>}
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-white/30 uppercase tracking-widest font-bold">
                     <div className="flex items-center gap-2">
                       {img.type === 'video' ? (
                         <>
                           <Video size={10} className="text-red-500" />
                           <span className="text-red-400">VIDEO</span>
                         </>
                       ) : img.type === 'pdf' ? (
                         <>
                           <FileText size={10} className="text-blue-500" />
                           <span className="text-blue-400 text-blue-400/90">PDF</span>
                         </>
                       ) : (
                         <>
                           <ImageIcon size={10} className="text-purple-500" />
                           <span className="text-purple-400">IMAGE</span>
                         </>
                       )}
                     </div>
                     <span>{new Date(img.updatedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] border-t border-white/[0.03] pt-1.5">
                    <span className="text-white/20 uppercase tracking-wider font-semibold font-mono">データサイズ:</span>
                    <span className={`font-mono font-bold ${
                      img.url?.startsWith('http') 
                        ? 'text-sky-400' 
                        : getResourceSizeInfo(img.url).size > 700 * 1024 
                          ? 'text-red-400' 
                          : 'text-white/60'
                    }`}>
                      {getResourceSizeInfo(img.url).label}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>

        {resources.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl text-white/10">
            <ImageIcon size={48} className="mb-4" />
            <p className="font-cinzel tracking-widest">No Media Uploaded</p>
            <p className="text-xs mt-2 uppercase">上の「Dropbox URLを追加」からの登録を推奨します</p>
          </div>
        )}
      </section>

      <footer className="bg-purple-900/10 border border-purple-500/20 p-6 rounded-xl space-y-2">
        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-[0.2em]">How to use</h3>
        <p className="text-xs text-white/60 leading-relaxed">
          追加したメディアの <span className="text-purple-400 font-mono font-bold">[[ID]]</span> タグを台本のテキスト（Markdown）内に記述してください。<br />
          PDFについては、フェーズの「PDFブロック」にID（例: <span className="text-red-400 font-mono">pdf-a1b2c</span>）を指定することも可能です。<br />
          Dropbox共有URLは表示用の直リンクへ自動変換されます。直接追加は小容量素材向けです。
        </p>
      </footer>
    </div>
  );
};
