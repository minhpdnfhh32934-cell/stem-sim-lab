import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  buildManifest,
  checkIdentity,
  msixVersion,
  xml,
} from '../scripts/store/manifest.mjs';

const identity = {
  identityName: '12345Simlab.SimLab',
  publisher: 'CN=1A2B3C4D-0000-1111-2222-333344445555',
  publisherDisplayName: 'Nhà phát triển "SimLab" & bạn bè',
};

const parse = (text: string) => new DOMParser().parseFromString(text, 'application/xml');

describe('Microsoft Store package manifest (scripts/store)', () => {
  it('uses the Store version format (fourth part 0) and refuses odd versions', () => {
    expect(msixVersion('0.5.1')).toBe('0.5.1.0');
    expect(msixVersion('1.02.3')).toBe('1.2.3.0');
    expect(() => msixVersion('0.5')).toThrow();
    expect(() => msixVersion('0.5.1-beta')).toThrow();
    expect(() => msixVersion('0.5.70000')).toThrow();
  });

  it('escapes text so a name with quotes or & keeps the XML valid', () => {
    expect(xml(`a & "b" <c>`)).toBe('a &amp; &quot;b&quot; &lt;c&gt;');
    const doc = parse(buildManifest({ ...identity, version: '0.5.1' }));
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.getElementsByTagName('PublisherDisplayName')[0]?.textContent).toBe(
      identity.publisherDisplayName,
    );
  });

  it('declares the identity, a desktop app, Internet and the camera — nothing more', () => {
    const doc = parse(buildManifest({ ...identity, version: '0.5.1' }));
    const id = doc.getElementsByTagName('Identity')[0];
    expect(id?.getAttribute('Name')).toBe(identity.identityName);
    expect(id?.getAttribute('Publisher')).toBe(identity.publisher);
    expect(id?.getAttribute('Version')).toBe('0.5.1.0');
    const app = doc.getElementsByTagName('Application')[0];
    expect(app?.getAttribute('EntryPoint')).toBe('Windows.FullTrustApplication');
    expect(app?.getAttribute('Executable')).toBe('stem-sim-lab.exe');
    const caps = [...doc.getElementsByTagName('Capabilities')[0]!.children].map((c) =>
      c.getAttribute('Name'),
    );
    expect(caps).toEqual(['internetClient', 'runFullTrust', 'webcam']);
  });

  it('every logo the manifest names exists in src-tauri/icons', () => {
    const text = buildManifest({ ...identity, version: '0.5.1' });
    for (const ref of text.match(/Assets\\[\w.]+\.png/g) ?? []) {
      expect(ASSETS).toContain(ref.slice('Assets\\'.length));
    }
    for (const asset of ASSETS) expect(existsSync(`src-tauri/icons/${asset}`)).toBe(true);
  });

  it('checks the Partner Center identity before packaging', () => {
    expect(checkIdentity(identity)).toEqual([]);
    expect(
      checkIdentity({ identityName: '', publisher: 'SimLab', publisherDisplayName: '' }),
    ).toHaveLength(3);
    const stored = JSON.parse(readFileSync('store/identity.json', 'utf8')) as Record<
      string,
      string
    >;
    expect(Object.keys(stored).sort()).toEqual([
      'identityName',
      'productId',
      'publisher',
      'publisherDisplayName',
    ]);
  });
});
