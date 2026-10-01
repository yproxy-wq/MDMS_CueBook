import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundType, type SoundConfig } from '../types';

const mocks = vi.hoisted(() => ({ auth: { currentUser: { uid: 'owner' } as {uid:string} | null }, link: vi.fn(), playing: vi.fn(), paused: vi.fn() }));
vi.mock('../lib/firebase', () => ({ auth: mocks.auth }));
vi.mock('./R2AssetService', () => ({
  getR2AssetIdFromUrl: (url:string) => url.startsWith('r2://') ? url.slice(5) : null,
  getR2OwnerTemporaryUrl: mocks.link,
}));
vi.mock('./AudioService', () => ({ audioService: { isPlaying: mocks.playing, isPaused: mocks.paused } }));
let resolveSound: typeof import('./R2AudioPlayback').resolveR2Sound;
const sound:SoundConfig = { id:'bgm', name:'BGM', type:SoundType.BGM, url:'r2://asset', volume:0.5, loopEnabled:true, loopStart:3 };
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); mocks.auth.currentUser = { uid:'owner' };
  mocks.link.mockResolvedValue({ url:'https://storage.example/temporary', expiresInSeconds:300 });
  mocks.playing.mockReturnValue(false); mocks.paused.mockReturnValue(false);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok:true, blob:async () => new Blob(['audio'], {type:'audio/mpeg'}) })));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-audio');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  resolveSound = (await import('./R2AudioPlayback')).resolveR2Sound;
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('R2 playback sources', () => {
  it('passes regular audio URLs through without a network request', async () => {
    const regular = {...sound, url:'https://example.com/rain.mp3'};
    expect(await resolveSound(regular)).toBe(regular); expect(fetch).not.toHaveBeenCalled();
  });
  it('deduplicates downloads and retains a local source after signed URL expiry', async () => {
    const [a,b] = await Promise.all([resolveSound(sound), resolveSound({...sound,id:'second'})]);
    expect(a.url).toBe('blob:local-audio'); expect(b.url).toBe(a.url);
    expect(a.loopStart).toBe(3); expect(sound.url).toBe('r2://asset');
    expect(fetch).toHaveBeenCalledOnce();
    await resolveSound(sound); expect(mocks.link).toHaveBeenCalledOnce();
  });
  it('rejects failed reads and allows a fresh retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ok:false,status:403} as Response);
    await expect(resolveSound(sound)).rejects.toThrow('403');
    expect((await resolveSound(sound)).url).toBe('blob:local-audio'); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects non-audio content and empty downloads', async () => {
    for (const blob of [new Blob(['html'],{type:'text/html'}),new Blob([],{type:'audio/mpeg'})]) {
      vi.mocked(fetch).mockResolvedValueOnce({ok:true,blob:async()=>blob} as Response);
      await expect(resolveSound(sound)).rejects.toThrow('形式またはサイズ');
    }
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('rejects logout during download and scopes playback caches by user', async () => {
    vi.mocked(fetch).mockImplementationOnce(async()=>{mocks.auth.currentUser=null;return {ok:true,blob:async()=>new Blob(['audio'],{type:'audio/mpeg'})} as Response;});
    await expect(resolveSound(sound)).rejects.toThrow('ログイン状態');
    mocks.auth.currentUser={uid:'owner'}; await resolveSound(sound);
    mocks.auth.currentUser={uid:'other'}; await resolveSound(sound); expect(mocks.link).toHaveBeenCalledTimes(3);
  });
  it('evicts idle sources but protects playing and paused sounds', async () => {
    let now=Date.now();vi.spyOn(Date,'now').mockImplementation(()=>now);
    mocks.playing.mockImplementation(id=>id==='playing'); mocks.paused.mockImplementation(id=>id==='paused');
    await resolveSound({...sound,id:'playing',url:'r2://playing'});
    await resolveSound({...sound,id:'paused',url:'r2://paused'});
    for(let i=0;i<8;i++) { now+=60_001; await resolveSound({...sound,id:`idle${i}`,url:`r2://idle${i}`}); }
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    await resolveSound({...sound,id:'playing',url:'r2://playing'}); await resolveSound({...sound,id:'paused',url:'r2://paused'});
    expect(fetch).toHaveBeenCalledTimes(10);
  });
});
