/** Partner Center → the app → "Product identity" (store/identity.json). */
export interface StoreIdentity {
  identityName: string;
  publisher: string;
  publisherDisplayName: string;
}
export interface ManifestInput extends StoreIdentity {
  version: string;
  executable?: string;
  displayName?: string;
  description?: string;
}
export const ASSETS: string[];
export const MIN_WINDOWS: string;
export const MAX_TESTED: string;
export function msixVersion(version: string): string;
export function xml(text: string): string;
export function checkIdentity(id: Partial<StoreIdentity>): string[];
export function buildManifest(input: ManifestInput): string;
