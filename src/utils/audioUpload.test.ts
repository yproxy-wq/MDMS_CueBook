import { describe, expect, it } from 'vitest';
import { getAudioUploadContentType } from './audioUpload';
import { canUploadR2Audio } from '../../functions/src/r2AudioPolicy';

describe('Biz audio policy', () => {
  it.each(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'])('accepts %s with an absent browser MIME', extension => {
    expect(getAudioUploadContentType({ name: `sound.${extension}`, type: '' })).toMatch(/^audio\//);
  });
  it('normalizes browser aliases and codec parameters', () => {
    expect(getAudioUploadContentType({ name: 'RAIN.WAV', type: 'audio/x-wav' })).toBe('audio/wav');
    expect(getAudioUploadContentType({ name: 'sound.ogg', type: 'audio/ogg; codecs=opus' })).toBe('audio/ogg');
  });
  it.each([{ name: 'bad.mp3', type: 'text/html' }, { name: 'image.png', type: 'audio/wav' }, { name: 'bad.wav', type: 'audio/mpeg' }])('rejects misleading file types', file => {
    expect(() => getAudioUploadContentType(file)).toThrow();
  });
  it('requires both the Biz project and the trusted Biz claim', () => {
    expect(canUploadR2Audio('cuebook-biz-xtv', 'biz')).toBe(true);
    for (const project of ['cuebook-dev', 'cuebook-stable', undefined]) expect(canUploadR2Audio(project, 'biz')).toBe(false);
    for (const plan of ['free', undefined, true]) expect(canUploadR2Audio('cuebook-biz-xtv', plan)).toBe(false);
  });
});
