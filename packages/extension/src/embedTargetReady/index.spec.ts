import {
  extensionSiteEmbedParentEvent,
  extensionSiteEmbedParentMessageSource,
  extensionSiteEmbedTargetEvent,
  extensionSiteEmbedTargetMessageSource,
} from '@dailydotdev/shared/src/features/extensionEmbed/common';

jest.mock('webextension-polyfill', () => ({
  runtime: { getURL: () => 'moz-extension://reader-test/' },
}));

describe('Firefox embedded target readiness', () => {
  const originalBrowser = process.env.TARGET_BROWSER;
  const extensionOrigin = 'moz-extension://reader-test';
  let onMessage: (event: MessageEvent) => void;
  const onDomReady: Array<() => void> = [];
  const postMessage = jest.fn();
  const parent = { postMessage };

  beforeEach(() => {
    process.env.TARGET_BROWSER = 'firefox';
    jest.clearAllMocks();
    onDomReady.length = 0;
    jest
      .spyOn(window, 'parent', 'get')
      .mockReturnValue(parent as unknown as Window);
    jest
      .spyOn(window, 'top', 'get')
      .mockReturnValue(parent as unknown as Window);
    jest.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    jest.spyOn(document, 'referrer', 'get').mockReturnValue('');
    jest
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener) => {
        if (type === 'message') {
          onMessage = listener as (event: MessageEvent) => void;
        }
      });
    jest
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, listener) => {
        if (type === 'DOMContentLoaded') {
          onDomReady.push(listener as () => void);
        }
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBrowser === undefined) {
      delete process.env.TARGET_BROWSER;
    } else {
      process.env.TARGET_BROWSER = originalBrowser;
    }
  });

  it('requires its own extension request and waits for DOM ready without a referrer', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('./index');
    });
    const request = (options: MessageEventInit = {}) =>
      onMessage(
        new MessageEvent('message', {
          origin: extensionOrigin,
          source: parent as unknown as Window,
          data: {
            source: extensionSiteEmbedParentMessageSource,
            type: extensionSiteEmbedParentEvent.RequestDomReady,
            nonce: 'navigation-nonce',
          },
          ...options,
        }),
      );

    request({ origin: 'https://forged.example' });
    request({ source: window });
    expect(onDomReady).toHaveLength(1);
    request();
    expect(postMessage).not.toHaveBeenCalled();
    onDomReady.forEach((listener) => listener());
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: extensionSiteEmbedTargetMessageSource,
        type: extensionSiteEmbedTargetEvent.DomReady,
        target: window.location.href,
        nonce: 'navigation-nonce',
      },
      extensionOrigin,
    );

    jest.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    request({ source: null });
    expect(postMessage).toHaveBeenCalledTimes(3);
  });
});
