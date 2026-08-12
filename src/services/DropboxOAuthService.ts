import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const beginDropboxAuthorization = httpsCallable<undefined, { authorizationUrl: string }>(functions, 'beginDropboxAuthorization');
const getDropboxConnectionStatus = httpsCallable<undefined, { connected: boolean }>(functions, 'getDropboxConnectionStatus');

/** Opens OAuth in a short-lived popup so the GM workspace remains intact. */
export async function connectDropbox(): Promise<void> {
  const popup = window.open('', 'cuebook-dropbox-oauth', 'popup=yes,width=560,height=760');
  if (!popup) throw new Error('DROPBOX_POPUP_BLOCKED');
  try {
    const { data } = await beginDropboxAuthorization();
    popup.location.replace(data.authorizationUrl);
    popup.focus();
  } catch (error) {
    popup.close();
    throw error;
  }
}

export async function isDropboxConnected(): Promise<boolean> {
  const { data } = await getDropboxConnectionStatus();
  return data.connected;
}
