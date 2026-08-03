
import { SoundConfig, SoundType } from '../types';
import { networkMonitor } from './NetworkMonitor';

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private silentAudio: HTMLAudioElement | null = null;
  private silentNoiseNode: AudioWorkletNode | ScriptProcessorNode | AudioBufferSourceNode | null = null;
  private isSilentAudioStarted: boolean = false;
  private onStatusChange: ((active: boolean) => void) | null = null;
  
  // Cache for decoded AudioBuffers (for low-latency effects)
  private bufferPool: Map<string, AudioBuffer> = new Map();
  private loadingBuffers: Map<string, Promise<AudioBuffer | null>> = new Map();
  
  // Cache for preloaded/reusable audio elements and their Web Audio nodes
  private audioPool: Map<string, {
    element: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    gain: GainNode;
  }> = new Map();
  
  private activeNodes: Map<string, { 
    element?: HTMLAudioElement;
    bufferSource?: AudioBufferSourceNode;
    gain: GainNode; 
    chokeGroup?: string;
    isLoop: boolean;
    fadeOutDuration?: number;
    config: SoundConfig;
  }> = new Map();

  constructor() {
    // 100ms周期のタイマーは、バックグラウンドでの遅延やCPU無駄消費の原因になるため完全廃止し、ontimeupdate イベントで代替
    if (typeof window !== 'undefined') {
      const handleRestore = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch((e) => console.warn('[AudioService] Auto resume failed on focus/restore:', e));
        }
      };
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') handleRestore();
      });
      window.addEventListener('focus', handleRestore);
    }
  }

  private init() {
    if (this.ctx) return;
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      throw new Error('DERR_01: Web Audio API is unavailable in this browser.');
    }
    this.ctx = new AudioContextConstructor();
    this.masterGain = this.ctx.createGain();
    this.bgmGain = this.ctx.createGain();
    this.seGain = this.ctx.createGain();

    this.bgmGain.connect(this.masterGain);
    this.seGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  private async fetchAndDecode(url: string): Promise<AudioBuffer | null> {
    if (this.bufferPool.has(url)) return this.bufferPool.get(url)!;
    if (this.loadingBuffers.has(url)) return this.loadingBuffers.get(url)!;

    const promise = (async () => {
      try {
        const targetUrl = url.startsWith('data:') ? url : this.transformUrl(url);
        const response = await networkMonitor.safeFetch(targetUrl);
        
        if (!response.ok) {
          throw new Error(`FERR_${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && (contentType.includes('text/html') || contentType.includes('application/json'))) {
          throw new Error('FERR_TYPE');
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error("FERR_EMPTY");
        }

        // Memory safety: Clear entries if pool is getting large
        if (this.bufferPool.size > 100) {
          const keys = Array.from(this.bufferPool.keys());
          for (let i = 0; i < 20; i++) {
            this.bufferPool.delete(keys[i]);
          }
        }

        if (arrayBuffer.byteLength > 40 * 1024 * 1024) {
          console.warn(`[AudioService] Large file (${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB). Decoding may lag.`);
        }

        try {
          const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
          this.bufferPool.set(url, audioBuffer);
          return audioBuffer;
        } catch {
          throw new Error(`DERR_01`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AudioService][${msg}] Failed: ${url.substring(0, 50)}...`);
        return null;
      } finally {
        this.loadingBuffers.delete(url);
      }
    })();

    this.loadingBuffers.set(url, promise);
    return promise;
  }

  /**
   * ユーザーの初回操作時に呼び出し、バックグラウンド再生を維持するための
   * 無音または極小音量の信号を開始します。
   */
  public async activateAudio(scenarioTitle: string = "CueBook Session", mode: 'silent-wav' | 'white-noise' = 'silent-wav') {
    this.init();
    if (this.ctx!.state === 'suspended') {
      await this.ctx!.resume();
    }

    if (this.isSilentAudioStarted) {
      return;
    }

    // iOS/Android のサイレントスイッチ対策として、少量のノイズ信号を発生させる
    if (mode === 'white-noise') { 
      try {
        const bufferSize = 2 * this.ctx!.sampleRate;
        const noiseBuffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * 0.005; // 極小
        }

        const whiteNoise = this.ctx!.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseGain = this.ctx!.createGain();
        noiseGain.gain.value = 1.0; 

        whiteNoise.connect(noiseGain);
        noiseGain.connect(this.masterGain!);
        
        whiteNoise.start();
        this.silentNoiseNode = whiteNoise;
        this.isSilentAudioStarted = true;
        this.updateMediaSession(scenarioTitle);
        if (this.onStatusChange) this.onStatusChange(true);
      } catch (err) {
        console.warn("Silent node generation failed:", err);
      }
    }
    
    // HTMLAudioElement 側も並行して動かしておく（メディアセッション維持のため）
    const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
    this.silentAudio = new Audio(silentWav);
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.01;
    try {
      await this.silentAudio.play();
    } catch (err) {
      console.warn("Silent audio element failed:", err);
    }
  }

  public setStatusCallback(callback: (active: boolean) => void) {
    this.onStatusChange = callback;
    callback(this.isSilentAudioStarted);
  }

  public get isBTActive(): boolean {
    return this.isSilentAudioStarted;
  }

  private updateMediaSession(title: string) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'CueBook GM Engine',
        album: 'Scenario Master Dashboard',
        artwork: [
          { src: 'https://github.com/yproxy-wq/MDMS_CueBook/blob/main/CueBookIcon.png?raw=true', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        this.ctx?.resume();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.ctx?.suspend();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        this.stopAll();
      });
    }
  }



  public transformUrl(url: string): string {
    if (!url) return url;
    const targetUrl = url.trim();

    // GitHub raw conversion
    if (targetUrl.includes('github.com') && targetUrl.includes('/raw/')) {
      return targetUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/raw/', '/');
    }

    const driveRegex = /(?:https?:\/\/)?(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i;
    const driveMatch = targetUrl.match(driveRegex);
    if (driveMatch && driveMatch[1]) {
      return `https://docs.google.com/uc?id=${driveMatch[1]}&export=download`;
    }

    if (targetUrl.includes('dropbox.com') || targetUrl.includes('db.tt')) {
      let directUrl = targetUrl
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('db.tt', 'dl.dropboxusercontent.com');
      if (directUrl.includes('dl=0')) {
        directUrl = directUrl.replace('dl=0', 'raw=1');
      } else if (!directUrl.includes('raw=1')) {
        const separator = directUrl.includes('?') ? '&' : '?';
        directUrl = `${directUrl}${separator}raw=1`;
      }
      return directUrl;
    }
    return targetUrl;
  }

  setVolume(value: number) {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(value, this.ctx!.currentTime, 0.1);
  }

  setDucking(active: boolean) {
    if (!this.bgmGain) return;
    const target = active ? 0.2 : 1.0;
    this.bgmGain.gain.setTargetAtTime(target, this.ctx!.currentTime, 0.2);
  }

  stopAll() {
    this.activeNodes.forEach((node) => {
      if (node.element) node.element.pause();
      if (node.bufferSource) try { node.bufferSource.stop(); } catch (e) { console.warn(e); }
      if (this.ctx) {
        node.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        node.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
    });
    this.activeNodes.clear();
  }

  getPlaybackStats(id: string) {
    const node = this.activeNodes.get(id);
    if (!node) return null;
    if (node.element) {
      return {
        current: node.element.currentTime,
        duration: node.element.duration || 0,
        isLoading: node.element.readyState < 2
      };
    }
    // For AudioBufferSourceNode, we don't directly have currentTime. 
    // We'd need to track it manually if needed, but usually SEs don't need seekbars in the board.
    return null; 
  }

  seek(id: string, time: number) {
    const node = this.activeNodes.get(id);
    if (node && node.element) {
      node.element.currentTime = time;
    }
  }

  public resetToStart(id: string) {
    const node = this.activeNodes.get(id);
    if (node && node.element) {
      node.element.currentTime = node.config.startTime || 0;
    }
  }

  public pause(id: string) {
    const node = this.activeNodes.get(id);
    if (node && node.element) {
      node.element.pause();
    }
  }

  public updateVolume(id: string, volume: number) {
    const node = this.activeNodes.get(id);
    if (node && node.gain && this.ctx) {
      try {
        node.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        node.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
      } catch (err) {
        console.warn(`Failed to update volume for ${id}:`, err);
      }
    }
  }

  /**
   * 必要な音源を事前に読み込み、キャッシュに配置します。
   */
  public preload(sounds: (SoundConfig | string)[]) {
    sounds.forEach(item => {
      const url = typeof item === 'string' ? item : item.url;
      const type = typeof item === 'string' ? null : item.type;
      
      this.getOrBufferSource(url);
      
      // SEの場合はメモリにデコード（低レイテンシ用）
      // 型情報がない場合(紐付けのみ)は一律デコードを試みるが、巨大なBGMを避けるため型判別を優先
      if (type === SoundType.SE || type === null) {
        if (!url.startsWith('data:')) {
          this.fetchAndDecode(url);
        }
      }
    });
  }

  private getOrBufferSource(url: string): { element: HTMLAudioElement, source: MediaElementAudioSourceNode, gain: GainNode } | null {
    this.init();
    const streamUrl = this.transformUrl(url);
    if (!streamUrl) return null;

    let cached = this.audioPool.get(streamUrl);
    if (!cached) {
      // iOS / Chrome limit total connected MediaElementAudioSourceNodes (~20-25 nodes).
      // If we are reaching the threshold of 20 elements, release oldest unused safely.
      if (this.audioPool.size >= 20) {
        const firstKey = this.audioPool.keys().next().value;
        if (firstKey) {
          const first = this.audioPool.get(firstKey);
          if (first) {
            try {
              first.element.pause();
              first.element.removeAttribute('src');
              first.element.load();
              first.source.disconnect();
              first.gain.disconnect();
            } catch (err) {
              console.warn("[AudioService] Failed cleaning old raw element node:", err);
            }
            this.audioPool.delete(firstKey);
          }
        }
      }

      const element = new Audio();
      element.src = streamUrl;
      element.preload = "auto";
      if (!streamUrl.startsWith('data:')) {
        element.crossOrigin = "anonymous";
      }

      // Safe, loop boundary observer triggered directly by the browser audio thread
      element.ontimeupdate = () => {
        this.activeNodes.forEach((node) => {
          if (node.element === element) {
            const { config } = node;
            if (config.loopEnabled && config.loopEnd && config.loopEnd > 0) {
              if (element.currentTime >= config.loopEnd) {
                element.currentTime = config.loopStart || 0;
              }
            } else if (config.endTime && config.endTime > 0) {
              if (element.currentTime >= config.endTime) {
                element.pause();
                element.currentTime = config.startTime || 0;
              }
            }
          }
        });
      };
      
      const source = this.ctx!.createMediaElementSource(element);
      const gain = this.ctx!.createGain();
      source.connect(gain);
      
      cached = { element, source, gain };
      this.audioPool.set(streamUrl, cached);
    }
    return cached;
  }

  public isPlaying(id: string): boolean {
    const node = this.activeNodes.get(id);
    if (!node) return false;
    return !!(node.element && !node.element.paused) || !!node.bufferSource;
  }

  public isPaused(id: string): boolean {
    const node = this.activeNodes.get(id);
    return !!node && !!(node.element && node.element.paused);
  }

  async play(sound: SoundConfig, onEnded?: () => void): Promise<void> {
    this.init();
    if (this.ctx!.state === 'suspended') {
      await this.ctx!.resume();
    }

    if (!sound.url) return;

    const isSE = sound.type === SoundType.SE && !sound.loopEnabled;

    // Toggle logic for BGM / looping sounds
    if (!isSE) {
      const existing = this.activeNodes.get(sound.id);
      if (existing && existing.element) {
        if (existing.element.paused) {
          await existing.element.play();
        } else {
          existing.element.pause();
        }
        return;
      }
    }

    if (sound.chokeGroup) {
      this.activeNodes.forEach((node, activeKey) => {
        if (node.chokeGroup === sound.chokeGroup) {
          this.stop(activeKey);
        }
      });
    }

    const fadeIn = sound.fadeInEnabled ? (sound.fadeInDuration ?? 3.0) : 0;
    const targetVolume = sound.volume !== undefined ? sound.volume : 1.0;
    const instanceKey = isSE ? `${sound.id}_se_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` : sound.id;

    // SE optimization: AudioBuffer usage for parallel processing and low latency
    if (isSE) {
       try {
         const buffer = await this.fetchAndDecode(sound.url);
         if (buffer) {
           const source = this.ctx!.createBufferSource();
           source.buffer = buffer;
           const gain = this.ctx!.createGain();
           source.connect(gain);
           gain.connect(this.seGain!);

           gain.gain.setValueAtTime(0, this.ctx!.currentTime);
           gain.gain.linearRampToValueAtTime(targetVolume, this.ctx!.currentTime + fadeIn);

           source.start(0, sound.startTime || 0);
           this.activeNodes.set(instanceKey, {
             bufferSource: source,
             gain,
             chokeGroup: sound.chokeGroup,
             isLoop: false,
             config: sound
           });
           source.onended = () => {
             this.activeNodes.delete(instanceKey);
             if (onEnded) onEnded();
           };
           return;
         }
       } catch (err) {
         console.warn(`[AudioService] decodeAudioData failed for SE ${sound.id}, falling back to streaming:`, err);
       }
    }

    // Default to streaming (BGM) or fallback
    const cached = this.getOrBufferSource(sound.url);
    if (!cached) return;
    const { element, gain } = cached;
    if (!element.paused && !isSE) element.pause();
    
    element.loop = !!sound.loopEnabled && (!sound.loopEnd || sound.loopEnd === 0);
    
    gain.disconnect(); 
    if (sound.type === SoundType.BGM) gain.connect(this.bgmGain!);
    else gain.connect(this.seGain!);

    gain.gain.cancelScheduledValues(this.ctx!.currentTime);
    gain.gain.setValueAtTime(0, this.ctx!.currentTime);
    gain.gain.linearRampToValueAtTime(targetVolume, this.ctx!.currentTime + fadeIn);

    this.activeNodes.set(instanceKey, { 
      element,
      gain, 
      chokeGroup: sound.chokeGroup,
      isLoop: !!sound.loopEnabled,
      fadeOutDuration: sound.fadeOutDuration,
      config: sound
    });

    element.onended = () => {
      if (!sound.loopEnabled) {
        this.activeNodes.delete(instanceKey);
        if (onEnded) onEnded();
      }
    };

    try {
      if (sound.startTime !== undefined && (element.currentTime < 0.1 || element.currentTime < sound.startTime)) {
        element.currentTime = sound.startTime;
      }
      await element.play();
    } catch (err) {
      console.warn("Audio play failed:", err);
      this.activeNodes.delete(instanceKey);
    }
  }

  stop(id: string) {
    const keysToStop: string[] = [];
    this.activeNodes.forEach((node, key) => {
      if (key === id || node.config.id === id) {
        keysToStop.push(key);
      }
    });

    if (keysToStop.length === 0) return;

    keysToStop.forEach((key) => {
      const node = this.activeNodes.get(key);
      if (!node) return;

      const { element, gain, config, bufferSource } = node;
      const fadeOut = config.fadeOutEnabled ? (config.fadeOutDuration ?? 3.0) : 0;
      
      try {
        gain.gain.cancelScheduledValues(this.ctx!.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx!.currentTime + fadeOut);
        
        setTimeout(() => {
          const currentNode = this.activeNodes.get(key);
          if (currentNode) {
            if (currentNode.element === element && element) element.pause();
            if (currentNode.bufferSource === bufferSource && bufferSource) {
              try { currentNode.bufferSource.stop(); } catch (err) { console.warn(err); }
            }
            this.activeNodes.delete(key);
          }
        }, (fadeOut + 0.1) * 1000);
      } catch (err) {
        console.warn(err);
        this.activeNodes.delete(key);
      }
    });
  }

  playLapChime() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch((e) => console.warn('[AudioService] failed to resume ctx:', e));
      }

      const now = this.ctx.currentTime;
      
      // Beautiful synthesized double-tone crystal chime
      const tones = [
        { freq: 880, start: 0, duration: 0.8 },
        { freq: 1318.51, start: 0.1, duration: 1.2 }
      ];

      tones.forEach((t) => {
        const osc = this.ctx!.createOscillator();
        const gainNode = this.ctx!.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.freq, now + t.start);
        
        gainNode.gain.setValueAtTime(0, now + t.start);
        gainNode.gain.linearRampToValueAtTime(0.2, now + t.start + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.duration);
        
        osc.connect(gainNode);
        if (this.masterGain) {
          gainNode.connect(this.masterGain);
        } else {
          gainNode.connect(this.ctx!.destination);
        }
        
        osc.start(now + t.start);
        osc.stop(now + t.start + t.duration);
      });
    } catch (e) {
      console.warn('[AudioService] playLapChime failed:', e);
    }
  }
}

export const audioService = new AudioService();
