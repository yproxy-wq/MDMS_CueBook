import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Keyboard, Monitor, Play, FastForward, Layers, Sparkles, Edit3, Image as ImageIcon, Save, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CustomShortcuts } from '../../types';

interface ShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor?: string;
  customShortcuts?: CustomShortcuts;
  isEditorMode?: boolean;
}

export const ShortcutsGuideModal: React.FC<ShortcutsGuideModalProps> = ({
  isOpen,
  onClose,
  themeColor = '#f59e0b',
  customShortcuts,
  isEditorMode = false
}) => {
  const [activeMode, setActiveMode] = useState<'gm' | 'editor'>(isEditorMode ? 'editor' : 'gm');

  if (!isOpen) return null;

  const formatKey = (combo?: string) => {
    if (!combo) return '';
    return combo
      .replace(/ctrl/i, 'Ctrl')
      .replace(/alt/i, 'Alt')
      .replace(/shift/i, 'Shift')
      .replace(/space/i, 'Space');
  };

  const gmSections = [
    {
      title: '画像・メディアの同期投影 (Sync & Image Numbers)',
      icon: ImageIcon,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10 border-sky-500/20',
      items: [
        {
          label: '数字キー・組合せキーで指定画像を投影',
          key: 'Ctrl + Alt + 1〜9  (または 1〜9)',
          description: '#1 〜 #9 の登録画像をワンキーで子ウィンドウに即時投影・ダイレクト送出します'
        },
        {
          label: '表示画像の切り替え (次へ)',
          key: formatKey(customShortcuts?.nextSyncImage) || 'Ctrl + Alt + I',
          description: '子ウィンドウに投影するアクティブ画像を次の画像に進めます'
        },
        {
          label: '表示画像の切り替え (前へ)',
          key: 'Ctrl + Alt + Shift + I',
          description: '子ウィンドウに投影するアクティブ画像を前の画像に戻します'
        },
        {
          label: '同期ウィンドウ (子ウィンドウ) 制御',
          key: formatKey(customShortcuts?.toggleSyncWindow) || 'Ctrl + Alt + W',
          description: 'QRコード、Live Preview、同期画面操作モーダルを開きます'
        },
        {
          label: '動画の同期再生 (Play / Pause)',
          key: 'Ctrl + Alt + V',
          description: '子ウィンドウで再生中の動画を一時停止・再生再開します'
        }
      ]
    },
    {
      title: 'タイマー操作 (Timer Control)',
      icon: Play,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      items: [
        {
          label: 'アクティブタイマーの開始 / 一時停止',
          key: formatKey(customShortcuts?.toggleTimer) || 'Space',
          description: 'グローバルスペースキーで現在進行中のタイマーを操作します'
        },
        {
          label: 'タイマーリセット',
          key: formatKey(customShortcuts?.resetTimer) || 'Ctrl + Alt + R',
          description: 'タイマーのカウントダウンを初期時間に戻します'
        },
        {
          label: 'タイマー時間調整 (+1分)',
          key: 'Ctrl + Alt + A',
          description: 'タイマーに1分を追加して延長します'
        }
      ]
    },
    {
      title: 'BGM / SE / 音響クラスター (Audio & Clusters)',
      icon: Layers,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      items: [
        {
          label: 'BGM 再生 / 一時停止',
          key: formatKey(customShortcuts?.toggleBgm) || 'Ctrl + Alt + B',
          description: '推奨BGMまたは現在のアクティブBGMの再生・停止を行います'
        },
        {
          label: 'SE 再生 (効果音)',
          key: formatKey(customShortcuts?.playSe) || 'Ctrl + Alt + S',
          description: '推奨効果音(SE)をトリガー再生します'
        },
        {
          label: '音響クラスター (Cluster) 実行',
          key: 'Ctrl + Alt + C',
          description: '現在のフェーズに紐づく音響セット(プリセット)を一括発動します'
        }
      ]
    },
    {
      title: 'シナリオ進行 & 検索 (Phase Navigation)',
      icon: FastForward,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
      items: [
        {
          label: '次のフェーズへ進行',
          key: formatKey(customShortcuts?.nextPhase) || 'Ctrl + Alt + N',
          description: 'シナリオの進行状態を次のフェーズへ移行します'
        },
        {
          label: '前のフェーズへ戻る',
          key: formatKey(customShortcuts?.prevPhase) || 'Ctrl + Alt + P',
          description: 'シナリオの進行状態を前のフェーズへ戻します'
        },
        {
          label: 'フェーズ検索コマンドパレット',
          key: 'Ctrl + Shift + P',
          description: '目的のフェーズへジャンプできるパレットを表示します'
        },
        {
          label: 'モーダル・ドロップダウン消去',
          key: 'Esc',
          description: '開いているダイアログやメニューを閉じます'
        }
      ]
    }
  ];

  const editorSections = [
    {
      title: 'シナリオ編集・データ管理 (Scenario Editor & Save)',
      icon: Save,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      items: [
        {
          label: 'シナリオの即時保存',
          key: 'Ctrl + S / Cmd + S',
          description: '現在のシナリオ変更内容を即座にIndexedDBへ手動保存します'
        },
        {
          label: '変更の元に戻す / やり直し',
          key: 'Ctrl + Z / Ctrl + Y',
          description: '直前に行った編集を取り消す、またはやり直します'
        },
        {
          label: 'スクリプトブロック編集の確定',
          key: 'Ctrl + Enter',
          description: 'テキスト・Markdownブロックの編集内容を保存確定します'
        },
        {
          label: 'モーダル・編集のキャンセル',
          key: 'Esc',
          description: 'アクティブな編集ウィンドウやオーバーレイを閉じます'
        }
      ]
    },
    {
      title: '画像順序・ブロックの並び替え (Reordering & Media)',
      icon: ArrowUpDown,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10 border-sky-500/20',
      items: [
        {
          label: '画像・メディアの番号順入れ替え',
          key: '↑ / ↓ ボタン操作',
          description: 'メディアタブで画像の順番(番号 #1, #2)を1クリックで上下に移動します'
        },
        {
          label: '選択中ブロックの上下移動',
          key: 'Alt + Up / Alt + Down',
          description: '台本内のアクティブなスクリプトブロックを前後に移動します'
        },
        {
          label: 'フェーズ順序の変更',
          key: 'アウトラインドラッグ & ドロップ',
          description: '構成編集画面でフェーズの順序をドラッグして並び替えます'
        }
      ]
    },
    {
      title: 'エディタタブ切り替え (Editor Navigation)',
      icon: Edit3,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
      items: [
        {
          label: 'メディア / 画像・資料管理タブ',
          key: 'Ctrl + Alt + M',
          description: '共有画像・PDF・動画の登録と番号管理画面を開きます'
        },
        {
          label: '音響 / BGM・SEライブラリタブ',
          key: 'Ctrl + Alt + S',
          description: '音素材の追加・クラスター作成タブを開きます'
        },
        {
          label: '構成 / フェーズアウトラインタブ',
          key: 'Ctrl + Alt + O',
          description: 'フェーズの追加・削除・進行構成編集を開きます'
        },
        {
          label: 'ハンドアウト配布物タブ',
          key: 'Ctrl + Alt + H',
          description: 'プレイヤーキャラクター別公開情報タブを開きます'
        }
      ]
    }
  ];

  const currentSections = activeMode === 'gm' ? gmSections : editorSections;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-4xl bg-[#0e0e11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="p-4 md:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40">
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 shrink-0"
                style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
              >
                <Keyboard size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-sans flex items-center gap-2 whitespace-nowrap">
                  ショートカットキーガイド <span className="text-[10px] font-mono text-white/40 uppercase font-normal">(Shortcuts Guide)</span>
                </h3>
                <p className="text-xs text-white/50 whitespace-nowrap">各ウィンドウ・モードごとのキーボード操作一覧</p>
              </div>
            </div>

            {/* Mode Selector Switch */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
              <button
                onClick={() => setActiveMode('gm')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeMode === 'gm'
                    ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Monitor size={13} className="shrink-0" />
                <span className="whitespace-nowrap">進行画面 (GM Screen)</span>
              </button>

              <button
                onClick={() => setActiveMode('editor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeMode === 'editor'
                    ? 'bg-purple-600 text-white font-extrabold shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Edit3 size={13} className="shrink-0" />
                <span className="whitespace-nowrap">編集画面 (Editor Mode)</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 ml-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer shrink-0"
                title="閉じる"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
            {currentSections.map((sec, idx) => {
              const IconComp = sec.icon;
              return (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md border ${sec.bgColor}`}>
                      <IconComp size={14} className={sec.color} />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      {sec.title}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {sec.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all flex flex-col justify-between gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-white/90 leading-tight">
                            {item.label}
                          </span>
                          <kbd className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-mono font-bold text-amber-300 shrink-0 shadow-sm whitespace-nowrap">
                            {item.key}
                          </kbd>
                        </div>
                        <p className="text-[10px] text-white/40 leading-normal">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 bg-black/40 text-xs text-white/50">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Sparkles size={12} className="text-amber-400 shrink-0" />
              <span>
                {activeMode === 'gm'
                  ? '進行中に1〜9の数字キーを押すと指定番号の画像を直ちに投影できます'
                  : 'エディタでのキー設定はシナリオデータのカスタマイズもサポートされています'}
              </span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              閉じる
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default ShortcutsGuideModal;
