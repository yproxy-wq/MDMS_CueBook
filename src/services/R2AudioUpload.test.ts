import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({intent:vi.fn(),finalize:vi.fn()}));
vi.mock('../lib/firebase',()=>({functions:{},auth:{currentUser:{uid:'owner'}}}));
vi.mock('firebase/functions',()=>({httpsCallable:(_functions:unknown,name:string)=>name==='createR2UploadIntent'?mocks.intent:name==='finalizeR2AssetUpload'?mocks.finalize:vi.fn()}));
import { uploadR2Audio } from './R2AssetService';
const assetId='r2-'+ 'a'.repeat(36);
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('VITE_CUEBOOK_TENANT','xtv');
  mocks.intent.mockResolvedValue({data:{assetId,uploadUrl:'https://storage.example/upload'}});
  mocks.finalize.mockResolvedValue({data:{assetId}});
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true})));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('R2 audio upload protocol',()=>{
  it('uploads bytes then finalizes before returning a permanent asset identifier',async()=>{
    const file=new File(['audio'],'rain.wav',{type:'audio/x-wav'});
    const result=await uploadR2Audio('scenario',file);
    expect(mocks.intent).toHaveBeenCalledWith({scenarioId:'scenario',name:'rain.wav',contentType:'audio/wav',sizeBytes:5});
    expect(fetch).toHaveBeenCalledWith('https://storage.example/upload',{method:'PUT',headers:{'Content-Type':'audio/wav'},body:file});
    expect(mocks.finalize.mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(fetch).mock.invocationCallOrder[0]);
    expect(result).toEqual({url:`r2://${assetId}`,storageProvider:'r2',storageAssetId:assetId,sizeBytes:5});
  });
  it('does not finalize a failed PUT or return a source when verification fails',async()=>{
    vi.mocked(fetch).mockResolvedValueOnce({ok:false,status:403} as Response);
    await expect(uploadR2Audio('scenario',new File(['audio'],'a.mp3'))).rejects.toThrow('403');
    expect(mocks.finalize).not.toHaveBeenCalled();
    mocks.finalize.mockRejectedValueOnce(new Error('size mismatch'));
    await expect(uploadR2Audio('scenario',new File(['audio'],'a.mp3'))).rejects.toThrow('size mismatch');
  });
  it.each(['', 'normal'])('rejects non-Biz bundles (%s) before requesting an upload',async tenant=>{
    vi.stubEnv('VITE_CUEBOOK_TENANT',tenant);
    await expect(uploadR2Audio('scenario',new File(['audio'],'a.mp3'))).rejects.toThrow('Biz版専用');
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it('rejects empty or over-limit files before reserving storage',async()=>{
    const file=new File(['audio'],'a.mp3');Object.defineProperty(file,'size',{value:100*1024*1024+1});
    for(const invalid of [new File([],'a.mp3'),file]) await expect(uploadR2Audio('scenario',invalid)).rejects.toThrow('100MB');
    expect(mocks.intent).not.toHaveBeenCalled();
  });
});
