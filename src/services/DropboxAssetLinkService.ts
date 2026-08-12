import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

type TemporaryLinkResult = { url: string; expiresInSeconds: number };

const getTemporaryLink = httpsCallable<{ ownerUid: string; shareId: string; assetId: string; pageNumber: number }, TemporaryLinkResult>(
  functions,
  'getPdfPageTemporaryLink',
);

/** Exchanges a timer-session capability for one temporary image URL; no Dropbox credential reaches the child view. */
export async function getPdfPageTemporaryUrl(
  ownerUid: string,
  shareId: string,
  assetId: string,
  pageNumber: number,
): Promise<TemporaryLinkResult> {
  const { data } = await getTemporaryLink({ ownerUid, shareId, assetId, pageNumber });
  return data;
}
