import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({doc:vi.fn(),get:vi.fn(),set:vi.fn(),remove:vi.fn()}));
vi.mock('firebase-admin/app',()=>({getApps:()=>[{}],initializeApp:vi.fn()}));
vi.mock('firebase-admin/firestore',()=>({
  getFirestore:()=>({doc:mocks.doc,runTransaction:async(callback:(transaction:unknown)=>Promise<unknown>)=>callback({get:mocks.get,set:mocks.set,delete:mocks.remove})}),
  FieldValue:{serverTimestamp:()=> 'timestamp'},Timestamp:{fromMillis:(value:number)=>value},
}));
vi.mock('firebase-functions/params',()=>({defineSecret:(name:string)=>({value:()=>name}),defineString:(name:string)=>({value:()=>name==='R2_ACCOUNT_ID'?'test-account':'test-bucket'})}));
vi.mock('firebase-functions/v2/https',()=>({
  onCall:(_options:unknown,handler:unknown)=>handler,
  HttpsError:class extends Error { constructor(public code:string,message:string){super(message);} },
}));
vi.mock('firebase-functions/v2/scheduler',()=>({onSchedule:(_options:unknown,handler:unknown)=>handler}));
import { createR2UploadIntent, finalizeR2AssetUpload } from '../src/r2Storage';
type Request={auth?:{uid:string;token:{cuebookPlan?:string}};data:Record<string,unknown>};
const upload=createR2UploadIntent as unknown as (request:Request)=>Promise<{assetId:string;uploadUrl:string}>;
const finalize=finalizeR2AssetUpload as unknown as (request:Request)=>Promise<unknown>;
const request:Request={auth:{uid:'owner',token:{cuebookPlan:'biz'}},data:{scenarioId:'scenario',name:'rain.mp3',contentType:'audio/mpeg',sizeBytes:5}};
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('GCLOUD_PROJECT','cuebook-biz-xtv');
  mocks.doc.mockImplementation((path:string)=>{
    if(path.split('/').length%2!==0) throw new Error('Invalid Firestore document path');
    return {path,get:async()=>({data:()=>({assetId:'asset',ownerUid:'owner',scenarioId:'scenario',objectKey:'object',sizeBytes:5,contentType:'audio/mpeg',status:'pending'})})};
  });
  mocks.get.mockResolvedValue({get:()=>0,data:()=>({status:'pending'})});
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,headers:new Headers({'content-length':'5','content-type':'audio/mpeg'})})));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Biz R2 server boundary',()=>{
  it('reserves usage through valid document paths and signs an audio PUT',async()=>{
    const result=await upload(request);
    expect(result.assetId).toMatch(/^r2-[a-f0-9]{36}$/);
    expect(new URL(result.uploadUrl).searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(mocks.doc).toHaveBeenCalledWith('users/owner/storageScenarioUsage/scenario');
    expect(mocks.set).toHaveBeenCalledTimes(3);
  });
  it.each(['cuebook-dev','cuebook-stable'])('denies audio intents on %s even with a Biz claim',async project=>{
    vi.stubEnv('GCLOUD_PROJECT',project);
    await expect(upload(request)).rejects.toMatchObject({code:'permission-denied'});
    expect(mocks.doc).not.toHaveBeenCalled();
  });
  it('denies missing authentication, a non-Biz claim, and unsupported MIME',async()=>{
    await expect(upload({...request,auth:undefined})).rejects.toMatchObject({code:'unauthenticated'});
    await expect(upload({...request,auth:{uid:'owner',token:{cuebookPlan:'free'}}})).rejects.toMatchObject({code:'permission-denied'});
    await expect(upload({...request,data:{...request.data,contentType:'text/html'}})).rejects.toMatchObject({code:'invalid-argument'});
    expect(mocks.doc).not.toHaveBeenCalled();
  });
  it('enforces aggregate and scenario quotas before reserving bytes',async()=>{
    mocks.get.mockResolvedValueOnce({get:(field:string)=>field==='storedBytes'?1024*1024*1024:0});
    await expect(upload(request)).rejects.toMatchObject({code:'resource-exhausted'});expect(mocks.set).not.toHaveBeenCalled();
    mocks.get.mockResolvedValueOnce({get:()=>0}).mockResolvedValueOnce({get:(field:string)=>field==='reservedBytes'?250*1024*1024:0});
    await expect(upload(request)).rejects.toMatchObject({code:'resource-exhausted'});
  });
  it('rejects a mismatched upload and releases reserved scenario capacity',async()=>{
    vi.mocked(fetch).mockResolvedValueOnce({ok:true,headers:new Headers({'content-length':'6','content-type':'audio/mpeg'})} as Response);
    await expect(finalize({auth:request.auth,data:{assetId:'asset'}})).rejects.toMatchObject({code:'invalid-argument'});
    expect(fetch).toHaveBeenCalledTimes(2); // HEAD verification followed by DELETE.
    expect(mocks.doc).toHaveBeenCalledWith('users/owner/storageScenarioUsage/scenario');
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
