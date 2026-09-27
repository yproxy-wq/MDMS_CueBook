"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPdfPageTemporaryLink = exports.finalizePdfAsset = exports.createPdfPageUploadLink = exports.createPdfAssetManifest = exports.dropboxOAuthCallback = exports.getDropboxConnectionStatus = exports.beginDropboxAuthorization = exports.touchR2AssetReferences = exports.getR2SharedTemporaryLink = exports.getR2OwnerTemporaryLink = exports.finalizeR2AssetUpload = exports.createR2UploadIntent = exports.cleanupUnreferencedR2Assets = void 0;
const node_crypto_1 = require("node:crypto");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
var r2Storage_1 = require("./r2Storage");
Object.defineProperty(exports, "cleanupUnreferencedR2Assets", { enumerable: true, get: function () { return r2Storage_1.cleanupUnreferencedR2Assets; } });
Object.defineProperty(exports, "createR2UploadIntent", { enumerable: true, get: function () { return r2Storage_1.createR2UploadIntent; } });
Object.defineProperty(exports, "finalizeR2AssetUpload", { enumerable: true, get: function () { return r2Storage_1.finalizeR2AssetUpload; } });
Object.defineProperty(exports, "getR2OwnerTemporaryLink", { enumerable: true, get: function () { return r2Storage_1.getR2OwnerTemporaryLink; } });
Object.defineProperty(exports, "getR2SharedTemporaryLink", { enumerable: true, get: function () { return r2Storage_1.getR2SharedTemporaryLink; } });
Object.defineProperty(exports, "touchR2AssetReferences", { enumerable: true, get: function () { return r2Storage_1.touchR2AssetReferences; } });
if ((0, app_1.getApps)().length === 0)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const dropboxAppKey = (0, params_1.defineSecret)('DROPBOX_APP_KEY');
const dropboxAppSecret = (0, params_1.defineSecret)('DROPBOX_APP_SECRET');
const dropboxTokenKey = (0, params_1.defineSecret)('DROPBOX_TOKEN_ENCRYPTION_KEY');
const dropboxRedirectUri = (0, params_1.defineString)('DROPBOX_REDIRECT_URI');
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
function requireUser(uid) {
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Dropbox操作にはログインが必要です。');
    return uid;
}
function requireString(value, field, maxLength = 256) {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
        throw new https_1.HttpsError('invalid-argument', `${field} が不正です。`);
    }
    return value;
}
function assetPath(scenarioId, assetId, pageNumber) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(scenarioId) || !/^pdf-[a-f0-9]{12,64}$/.test(assetId) || pageNumber < 1) {
        throw new https_1.HttpsError('invalid-argument', 'アセット識別子またはページ番号が不正です。');
    }
    return `/CueBook/${scenarioId}/${assetId}/page-${String(pageNumber).padStart(3, '0')}.webp`;
}
function encryptionKey() {
    const key = Buffer.from(dropboxTokenKey.value(), 'base64');
    if (key.length !== 32)
        throw new Error('DROPBOX_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    return key;
}
function encryptToken(token) {
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}
function decryptToken(value) {
    const payload = Buffer.from(value, 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}
async function refreshToken(token) {
    if (token.expires_at > Date.now() + 5 * 60 * 1000)
        return token;
    const basic = Buffer.from(`${dropboxAppKey.value()}:${dropboxAppSecret.value()}`).toString('base64');
    const response = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
    });
    if (!response.ok)
        throw new https_1.HttpsError('unauthenticated', 'Dropbox認証の更新に失敗しました。再接続してください。');
    const result = await response.json();
    return { ...token, access_token: result.access_token, expires_at: Date.now() + result.expires_in * 1000, account_id: result.account_id || token.account_id };
}
async function getAccessToken(uid) {
    const ref = db.doc(`users/${uid}/private/dropbox`);
    const snapshot = await ref.get();
    const encrypted = snapshot.get('encryptedToken');
    if (typeof encrypted !== 'string')
        throw new https_1.HttpsError('failed-precondition', 'Dropboxが接続されていません。');
    const token = await refreshToken(decryptToken(encrypted));
    await ref.set({ encryptedToken: encryptToken(token), updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    return token.access_token;
}
async function dropboxApi(accessToken, endpoint, body) {
    const response = await fetch(`${DROPBOX_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok)
        throw new https_1.HttpsError('internal', `Dropbox APIエラー (${response.status})`);
    return await response.json();
}
exports.beginDropboxAuthorization = (0, https_1.onCall)({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey] }, async (request) => {
    const uid = requireUser(request.auth?.uid);
    const state = (0, node_crypto_1.randomBytes)(32).toString('hex');
    await db.doc(`dropboxOauthStates/${state}`).set({ uid, expiresAt: Date.now() + OAUTH_STATE_TTL_MS, createdAt: firestore_1.FieldValue.serverTimestamp() });
    const params = new URLSearchParams({
        client_id: dropboxAppKey.value(),
        response_type: 'code',
        token_access_type: 'offline',
        redirect_uri: dropboxRedirectUri.value(),
        state,
    });
    return { authorizationUrl: `${DROPBOX_AUTHORIZE_URL}?${params.toString()}` };
});
exports.getDropboxConnectionStatus = (0, https_1.onCall)({ region: 'asia-northeast1', invoker: 'public' }, async (request) => {
    const uid = requireUser(request.auth?.uid);
    const snapshot = await db.doc(`users/${uid}/private/dropbox`).get();
    return { connected: typeof snapshot.get('encryptedToken') === 'string' };
});
exports.dropboxOAuthCallback = (0, https_1.onRequest)({ region: 'asia-northeast1', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request, response) => {
    const state = typeof request.query.state === 'string' ? request.query.state : '';
    const code = typeof request.query.code === 'string' ? request.query.code : '';
    if (!state || !code) {
        response.status(400).send('Dropbox authorization has expired. Return to CueBook and try again.');
        return;
    }
    const stateRef = db.doc(`dropboxOauthStates/${state}`);
    const stateSnapshot = await stateRef.get();
    const uid = stateSnapshot.get('uid');
    const expiresAt = stateSnapshot.get('expiresAt');
    if (typeof uid !== 'string' || typeof expiresAt !== 'number' || expiresAt < Date.now()) {
        response.status(400).send('Dropbox authorization has expired. Return to CueBook and try again.');
        return;
    }
    const basic = Buffer.from(`${dropboxAppKey.value()}:${dropboxAppSecret.value()}`).toString('base64');
    const tokenResponse = await fetch(DROPBOX_TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: dropboxRedirectUri.value() }),
    });
    if (!tokenResponse.ok) {
        // Do not log the authorization code or credentials. Dropbox's error body
        // is needed to distinguish an invalid redirect URI from invalid app
        // credentials when diagnosing a failed OAuth callback.
        const errorBody = (await tokenResponse.text()).slice(0, 512);
        console.error('[Dropbox OAuth] Token exchange failed', {
            status: tokenResponse.status,
            error: errorBody,
        });
        response.status(502).send(`Dropbox token exchange failed (HTTP ${tokenResponse.status}). Return to CueBook and try again.`);
        return;
    }
    const tokenResponseBody = await tokenResponse.json();
    if (!tokenResponseBody.refresh_token) {
        response.status(502).send('Dropbox did not return an offline refresh token.');
        return;
    }
    const token = { ...tokenResponseBody, expires_at: Date.now() + tokenResponseBody.expires_in * 1000 };
    await db.doc(`users/${uid}/private/dropbox`).set({ encryptedToken: encryptToken(token), accountId: token.account_id || null, connectedAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp() });
    await stateRef.delete();
    response.type('html').send('<!doctype html><title>CueBook</title><script>window.close()</script><p>Dropbox connected. You can close this tab.</p>');
});
exports.createPdfAssetManifest = (0, https_1.onCall)({ region: 'asia-northeast1', invoker: 'public' }, async (request) => {
    const uid = requireUser(request.auth?.uid);
    const scenarioId = requireString(request.data?.scenarioId, 'scenarioId');
    const assetId = requireString(request.data?.assetId, 'assetId');
    const sourceHash = requireString(request.data?.sourceHash, 'sourceHash', 128);
    const sourceName = requireString(request.data?.sourceName, 'sourceName', 512);
    const pageCount = request.data?.pageCount;
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 200)
        throw new https_1.HttpsError('invalid-argument', 'pageCount が不正です。');
    const manifest = { scenarioId, sourceHash, sourceName, pageCount, status: 'processing', pagePaths: Array.from({ length: pageCount }, (_, i) => assetPath(scenarioId, assetId, i + 1)) };
    await db.doc(`users/${uid}/pdfAssets/${assetId}`).set({ ...manifest, createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: false });
    return { assetId, pagePaths: manifest.pagePaths };
});
exports.createPdfPageUploadLink = (0, https_1.onCall)({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request) => {
    const uid = requireUser(request.auth?.uid);
    const assetId = requireString(request.data?.assetId, 'assetId');
    const pageNumber = request.data?.pageNumber;
    if (!Number.isInteger(pageNumber) || pageNumber < 1)
        throw new https_1.HttpsError('invalid-argument', 'pageNumber が不正です。');
    const manifest = await db.doc(`users/${uid}/pdfAssets/${assetId}`).get();
    const data = manifest.data();
    if (!data || pageNumber > data.pageCount)
        throw new https_1.HttpsError('not-found', 'PDFアセットまたはページが見つかりません。');
    const accessToken = await getAccessToken(uid);
    const result = await dropboxApi(accessToken, '/files/get_temporary_upload_link', { commit_info: { path: data.pagePaths[pageNumber - 1], mode: 'overwrite', autorename: false, mute: true } });
    await manifest.ref.set({ status: 'uploading', updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    return { uploadUrl: result.link, path: data.pagePaths[pageNumber - 1] };
});
exports.finalizePdfAsset = (0, https_1.onCall)({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request) => {
    const uid = requireUser(request.auth?.uid);
    const assetId = requireString(request.data?.assetId, 'assetId');
    const manifestRef = db.doc(`users/${uid}/pdfAssets/${assetId}`);
    const manifestSnapshot = await manifestRef.get();
    const manifest = manifestSnapshot.data();
    if (!manifest)
        throw new https_1.HttpsError('not-found', 'PDFアセットが見つかりません。');
    const accessToken = await getAccessToken(uid);
    await manifestRef.set({ status: 'verifying', updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    try {
        await Promise.all(manifest.pagePaths.map((path) => dropboxApi(accessToken, '/files/get_metadata', { path })));
        await manifestRef.set({ status: 'ready', updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
        return { assetId, status: 'ready', pageCount: manifest.pageCount };
    }
    catch (error) {
        await manifestRef.set({ status: 'failed', failureCode: 'DROPBOX_VERIFY_FAILED', updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
        throw error;
    }
});
/**
 * Public viewers prove access with the existing timer-session capability. The
 * Dropbox token remains server-side; neither the token nor a permanent file
 * URL is exposed to the shared window.
 */
exports.getPdfPageTemporaryLink = (0, https_1.onCall)({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request) => {
    const ownerUid = requireString(request.data?.ownerUid, 'ownerUid', 128);
    const shareId = requireString(request.data?.shareId, 'shareId', 64);
    const assetId = requireString(request.data?.assetId, 'assetId');
    const pageNumber = request.data?.pageNumber;
    if (!/^[a-f0-9]{64}$/.test(shareId) || !Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new https_1.HttpsError('invalid-argument', '共有情報またはページ番号が不正です。');
    }
    const session = await db.doc(`timerSessions/${ownerUid}/sessions/${shareId}`).get();
    if (!session.exists || session.get('shareId') !== shareId)
        throw new https_1.HttpsError('permission-denied', '共有セッションを確認できません。');
    const manifest = await db.doc(`users/${ownerUid}/pdfAssets/${assetId}`).get();
    const data = manifest.data();
    if (!data || data.status !== 'ready' || pageNumber > data.pageCount)
        throw new https_1.HttpsError('not-found', '指定ページを表示できません。');
    const accessToken = await getAccessToken(ownerUid);
    const result = await dropboxApi(accessToken, '/files/get_temporary_link', { path: data.pagePaths[pageNumber - 1] });
    return { url: result.link, expiresInSeconds: 4 * 60 * 60 };
});
