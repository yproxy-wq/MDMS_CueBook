export const R2_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/webm'];
export function canUploadR2Audio(projectId: string | undefined, plan: unknown): boolean {
  return projectId === 'cuebook-biz-xtv' && plan === 'biz';
}
