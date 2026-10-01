"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2_AUDIO_TYPES = void 0;
exports.canUploadR2Audio = canUploadR2Audio;
exports.R2_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/webm'];
function canUploadR2Audio(projectId, plan) {
    return projectId === 'cuebook-biz-xtv' && plan === 'biz';
}
