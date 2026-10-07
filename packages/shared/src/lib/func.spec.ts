import { getDailyClientPlatform, isExtensionCapableBrowser } from './func';

describe('Firefox reader eligibility', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps hosted Firefox pages outside the extension reader', () => {
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Firefox/149.0');
    expect(isExtensionCapableBrowser()).toBe(false);
  });

  it('enables the reader in the local Firefox build', () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      TARGET_BROWSER: 'firefox',
    });
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Firefox/149.0');
    jest.isolateModules(() => {
      const { isExtensionCapableBrowser: isCapable } =
        jest.requireActual('./func');
      expect(isCapable()).toBe(true);
    });
  });
});

// In the test environment `TARGET_BROWSER` is unset, so `isExtension` is false
// and these cases exercise the web (non-extension) branches.
describe('getDailyClientPlatform', () => {
  it('reports the native platform from the app version', () => {
    expect(getDailyClientPlatform('ios')).toBe('ios');
    expect(getDailyClientPlatform('android')).toBe('android');
  });

  it('falls back to webapp for any other or missing version', () => {
    expect(getDailyClientPlatform('pwa')).toBe('webapp');
    expect(getDailyClientPlatform()).toBe('webapp');
  });
});
