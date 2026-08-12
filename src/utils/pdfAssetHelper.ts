import { ImageResource } from '../types';

/** A durable page-state key that never exposes a Dropbox URL for rendered PDF assets. */
export function getPdfPageStateKey(resource: Pick<ImageResource, 'assetId' | 'url'>): string {
  return resource.assetId ? `asset:${resource.assetId}` : resource.url;
}
