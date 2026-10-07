import {
  buildExtensionSiteEmbedFrameSrc,
  getExtensionOrigin,
  getExtensionSiteEmbedErrorMessage,
  isDailyDevEmbedAncestor,
  isEmbeddableSiteTarget,
} from './common';
import { getBrowserExtensionInstallId } from './getBrowserExtensionInstallId';

describe('extension embed helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'browser');
    delete document.documentElement.dataset.dailyExtensionId;
  });

  it('uses the Firefox resource UUID instead of the add-on ID or page marker', () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      TARGET_BROWSER: 'firefox',
    });
    Object.defineProperty(globalThis, 'browser', {
      configurable: true,
      value: {
        runtime: {
          id: 'daily-local@example.test',
          getURL: () => 'moz-extension://firefox-resource-uuid/',
        },
      },
    });
    document.documentElement.dataset.dailyExtensionId = 'stale-chrome-id';

    expect(getBrowserExtensionInstallId()).toBe('firefox-resource-uuid');
    expect(getExtensionOrigin('daily-local@example.test')).toBe(
      'moz-extension://firefox-resource-uuid',
    );
    expect(
      buildExtensionSiteEmbedFrameSrc({
        extensionId: 'daily-local@example.test',
        targetUrl: 'https://example.com/article',
        parentOrigin: 'moz-extension://firefox-resource-uuid',
      }),
    ).toBe(
      'moz-extension://firefox-resource-uuid/frame.html?target=https%3A%2F%2Fexample.com%2Farticle&parentOrigin=moz-extension%3A%2F%2Ffirefox-resource-uuid',
    );
  });

  it('builds the extension frame URL with the parent origin', () => {
    expect(
      buildExtensionSiteEmbedFrameSrc({
        extensionId: 'abc123',
        targetUrl: 'https://daily.dev',
        parentOrigin: 'https://app.daily.dev',
      }),
    ).toBe(
      'chrome-extension://abc123/frame.html?target=https%3A%2F%2Fdaily.dev&parentOrigin=https%3A%2F%2Fapp.daily.dev',
    );
  });

  it('only allows http and https targets', () => {
    expect(isEmbeddableSiteTarget('https://daily.dev')).toBe(true);
    expect(isEmbeddableSiteTarget('http://localhost:5002')).toBe(true);
    expect(isEmbeddableSiteTarget('chrome-extension://abc123/frame.html')).toBe(
      false,
    );
    expect(isEmbeddableSiteTarget('ftp://example.com')).toBe(false);
  });

  it('recognizes daily.dev surfaces as embed ancestors', () => {
    expect(isDailyDevEmbedAncestor('https://daily.dev')).toBe(true);
    expect(isDailyDevEmbedAncestor('https://app.daily.dev')).toBe(true);
    expect(isDailyDevEmbedAncestor('https://staging.daily.dev')).toBe(true);
    expect(isDailyDevEmbedAncestor('https://preview-1.local.fylla.dev')).toBe(
      true,
    );
    expect(
      isDailyDevEmbedAncestor('https://preview-1.local.fylla.dev:5002'),
    ).toBe(true);
    expect(isDailyDevEmbedAncestor('http://localhost:5002')).toBe(true);
    expect(isDailyDevEmbedAncestor('https://localhost:5002')).toBe(true);
    expect(isDailyDevEmbedAncestor('chrome-extension://daily.dev')).toBe(false);
    expect(isDailyDevEmbedAncestor('chrome-extension://localhost')).toBe(false);
    expect(isDailyDevEmbedAncestor('https://daily.dev.evil.com')).toBe(false);
    expect(isDailyDevEmbedAncestor('https://www.php.net')).toBe(false);
    expect(isDailyDevEmbedAncestor('')).toBe(false);
  });

  it('prefers explicit error text when formatting failures', () => {
    expect(
      getExtensionSiteEmbedErrorMessage({
        reason: 'enable-frame-embedding-failed',
        error: 'updateSessionRules failed',
      }),
    ).toBe('updateSessionRules failed');
  });
});
