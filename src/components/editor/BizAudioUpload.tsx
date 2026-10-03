import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { SoundConfig } from '../../types';
import { AUDIO_UPLOAD_ACCEPT } from '../../utils/audioUpload';
import { getR2StorageErrorMessage, uploadR2Audio } from '../../services/R2AssetService';

interface Props {
  user: User | null;
  scenarioId: string;
  onSaved: (updates: Partial<SoundConfig>) => void;
}
export function BizAudioUpload(props: Props) {
  if (import.meta.env.VITE_CUEBOOK_TENANT !== 'xtv') return null;
  return <AuthorizedAudioUpload {...props} />;
}

function AuthorizedAudioUpload({ user, scenarioId, onSaved }: Props) {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const latestSaved = useRef(onSaved);
  const currentUser = useRef(user?.uid);
  useEffect(() => { currentUser.current = user?.uid; }, [user?.uid]);
  useEffect(() => { latestSaved.current = onSaved; }, [onSaved]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setAccess('checking');
    if (!user) { setAccess('denied'); return; }
    void user.getIdTokenResult().then(result => {
      if (active) setAccess(result.claims.cuebookPlan === 'biz' ? 'allowed' : 'denied');
    }).catch(() => { if (active) setAccess('denied'); });
    return () => { active = false; };
  }, [user]);
  return <div className="mt-2 space-y-2">
    <label className={`flex min-h-[44px] items-center justify-center rounded-lg border px-3 text-sm focus-within:ring-2 focus-within:ring-emerald-300 ${access === 'allowed' && !uploading ? 'cursor-pointer border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-white/40'}`}>
      {uploading ? 'Cloudflareへ保存中…' : '音声をCloudflareに保存'}
      <input aria-label="音声をCloudflareに保存" type="file" accept={AUDIO_UPLOAD_ACCEPT} className="sr-only" disabled={access !== 'allowed' || uploading}
        onChange={async event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!file || access !== 'allowed' || busy.current) return;
          const uid = user?.uid;
          busy.current = true; setUploading(true); setMessage(null);
          try {
            const updates = await uploadR2Audio(scenarioId, file);
            if (mounted.current && currentUser.current === uid) {
              latestSaved.current(updates);
              setMessage({ error: false, text: '音声ファイルをCloudflareに保存しました。別端末への反映は音源一覧の同期状態をご確認ください。' });
            }
          } catch (error) {
            if (mounted.current) setMessage({ error: true, text: getR2StorageErrorMessage(error) });
          } finally {
            busy.current = false;
            if (mounted.current) setUploading(false);
          }
        }} />
    </label>
    <p className="text-xs text-white/50">{access === 'checking' ? 'Biz権限を確認中…' : access === 'denied' ? 'Biz権限のあるアカウントでログインしてください。' : '1ファイル100MBまで。同じアカウント・シナリオの別端末へ音源一覧を同期します。端末から読み込んだファイルは、この端末だけで利用できます。'}</p>
    {message && <p role={message.error ? 'alert' : 'status'} className={`text-xs ${message.error ? 'text-red-300' : 'text-emerald-300'}`}>{message.text}</p>}
  </div>;
}
