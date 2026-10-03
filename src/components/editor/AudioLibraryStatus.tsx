import type { AudioLibrarySyncStatus } from '../../services/AudioLibrarySession';

const labels: Record<AudioLibrarySyncStatus, string> = {
  local: '端末のみ', loading: '同期を確認中', syncing: '同期中', synced: '一覧同期済', retrying: '再試行中', unavailable: '同期できません', offline: 'オフライン',
};
export function AudioLibraryStatus({ status = 'local' }: { status?: AudioLibrarySyncStatus }) {
  return <span role="status" aria-label="音源一覧の同期状態" className={`shrink-0 text-xs ${status === 'synced' ? 'text-emerald-200/80' : status === 'retrying' || status === 'unavailable' ? 'text-amber-200' : 'text-white/60'}`} title="音源一覧の同期状態です。音声ファイルの保存先は各音源で確認できます。">{labels[status]}</span>;
}
