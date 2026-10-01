const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm',
};
export const AUDIO_UPLOAD_ACCEPT = '.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm';
export function getAudioUploadContentType(file: Pick<File, 'name' | 'type'>): string {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  const expected = AUDIO_TYPES[extension];
  const mime = file.type.toLowerCase().split(';')[0].trim();
  const aliases: Record<string, string> = { 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/x-m4a': 'audio/mp4', 'audio/x-flac': 'audio/flac' };
  if (!expected || (mime && mime !== 'application/octet-stream' && (aliases[mime] || mime) !== expected)) {
    throw new Error('MP3 / WAV / OGG / M4A / AAC / FLAC / WebM の音声ファイルを選択してください。');
  }
  return expected;
}
