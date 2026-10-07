import {
  detectBrowserExtensionInstalled,
  isBrowserExtensionInstalled,
  useIsBrowserExtensionInstalled,
} from './useIsBrowserExtensionInstalled';

describe('detectBrowserExtensionInstalled', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-daily-extension-installed');
    document.head.innerHTML = '';
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'browser');
  });

  it('recognizes the local Firefox extension without a content-script marker or probe', async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      TARGET_BROWSER: 'firefox',
    });
    Object.defineProperty(globalThis, 'browser', {
      configurable: true,
      value: { runtime: { id: 'daily-local@example.test' } },
    });
    const append = jest.spyOn(document.head, 'appendChild');

    expect(isBrowserExtensionInstalled()).toBe(true);
    expect(useIsBrowserExtensionInstalled()).toEqual({
      isInstalled: true,
      isChecking: false,
    });
    await expect(
      detectBrowserExtensionInstalled('firefox-resource-uuid'),
    ).resolves.toBe(true);
    expect(append).not.toHaveBeenCalled();
  });

  it('returns true immediately when the ping marker is present', async () => {
    document.documentElement.dataset.dailyExtensionInstalled = 'true';

    await expect(detectBrowserExtensionInstalled('abc123')).resolves.toBe(true);
  });

  it('cache-busts probe retries for the same extension id', async () => {
    const appendedHrefs: string[] = [];
    const appendChildSpy = jest
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node: Node) => {
        if (node instanceof HTMLLinkElement) {
          appendedHrefs.push(node.href);
          globalThis.setTimeout(() => node.onerror?.(new Event('error')), 0);
        }

        return node;
      });

    await expect(detectBrowserExtensionInstalled('abc123', 50)).resolves.toBe(
      false,
    );
    await expect(detectBrowserExtensionInstalled('abc123', 50)).resolves.toBe(
      false,
    );

    expect(appendChildSpy).toHaveBeenCalledTimes(2);
    expect(appendedHrefs).toHaveLength(2);
    expect(appendedHrefs[0]).not.toBe(appendedHrefs[1]);
    expect(appendedHrefs[0]).toContain(
      'chrome-extension://abc123/js/frame.bundle.js?__daily_probe=',
    );
  });
});
