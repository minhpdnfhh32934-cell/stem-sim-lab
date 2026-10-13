/**
 * The MSIX package manifest (AppxManifest.xml) for the Microsoft Store copy of SimLab.
 *
 * Tauri builds one executable; the Store needs it wrapped in an MSIX package, which Microsoft
 * signs after certification (no code-signing certificate of our own). The package identity
 * (name, publisher) comes from Partner Center → the app → "Product identity"
 * (`store/identity.json`). Tested in tests/store-manifest.test.ts.
 */

/** Logos copied from src-tauri/icons into the package's Assets folder. */
export const ASSETS = [
  'StoreLogo.png',
  'Square44x44Logo.png',
  'Square71x71Logo.png',
  'Square150x150Logo.png',
];

/** Windows 10 1809: the oldest version with the WebView2 runtime the app needs. */
export const MIN_WINDOWS = '10.0.17763.0';
export const MAX_TESTED = '10.0.26100.0';

/** "0.5.1" → "0.5.1.0". The Store requires the fourth part to be 0. */
export function msixVersion(version) {
  const parts = String(version).split('.');
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p) && Number(p) <= 65535)) {
    throw new Error(`version must look like 1.2.3, got "${String(version)}"`);
  }
  return `${parts.map(Number).join('.')}.0`;
}

/** Escapes text for an XML attribute or element. */
export function xml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Checks the Partner Center identity before it goes into a package. */
export function checkIdentity(id) {
  const problems = [];
  if (!/^[A-Za-z0-9.-]{3,50}$/.test(id.identityName ?? '')) {
    problems.push(
      'identityName: 3–50 letters, digits, "." or "-" (Partner Center → Product identity)',
    );
  }
  if (!/^CN=.+/.test(id.publisher ?? '')) {
    problems.push('publisher: must start with "CN=" (Partner Center → Product identity)');
  }
  if (!String(id.publisherDisplayName ?? '').trim()) {
    problems.push('publisherDisplayName: empty');
  }
  return problems;
}

/**
 * The manifest text. `executable` is the file name inside the package. Capabilities: Internet
 * (AI providers, Gemma download, Wikipedia — all opt-in in the app), the camera ("Chụp đề bài"),
 * and runFullTrust, which every desktop (Win32) app in the Store declares.
 */
export function buildManifest({
  identityName,
  publisher,
  publisherDisplayName,
  version,
  executable = 'stem-sim-lab.exe',
  displayName = 'SimLab',
  description = 'Mô phỏng Vật lý · Hóa học · Sinh học',
}) {
  const v = msixVersion(version);
  return `<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity Name="${xml(identityName)}" Publisher="${xml(publisher)}" Version="${v}" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>${xml(displayName)}</DisplayName>
    <PublisherDisplayName>${xml(publisherDisplayName)}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="${MIN_WINDOWS}" MaxVersionTested="${MAX_TESTED}" />
  </Dependencies>
  <Resources>
    <Resource Language="vi-VN" />
    <Resource Language="en-US" />
  </Resources>
  <Applications>
    <Application Id="SimLab" Executable="${xml(executable)}" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="${xml(displayName)}"
        Description="${xml(description)}"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\\Square150x150Logo.png"
        Square44x44Logo="Assets\\Square44x44Logo.png">
        <uap:DefaultTile Square71x71Logo="Assets\\Square71x71Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>
  <Capabilities>
    <Capability Name="internetClient" />
    <rescap:Capability Name="runFullTrust" />
    <DeviceCapability Name="webcam" />
  </Capabilities>
</Package>
`;
}
