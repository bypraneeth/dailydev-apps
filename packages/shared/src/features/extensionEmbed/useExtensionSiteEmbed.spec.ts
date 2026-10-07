import { act, renderHook } from '@testing-library/react';
import { useExtensionSiteEmbed } from './useExtensionSiteEmbed';
import {
  extensionSiteEmbedParentEvent,
  extensionSiteEmbedParentMessageSource,
  extensionSiteEmbedTargetEvent,
  extensionSiteEmbedTargetMessageSource,
} from './common';

describe('Firefox reader readiness', () => {
  const originalBrowser = process.env.TARGET_BROWSER;
  const originalBrowserApi = Object.getOwnPropertyDescriptor(
    globalThis,
    'browser',
  );
  const originalRandomUUID = Object.getOwnPropertyDescriptor(
    crypto,
    'randomUUID',
  );
  const extensionId = 'reader-test';
  const extensionOrigin = 'moz-extension://reader-test';
  const targetUrl = 'https://example.com/article';
  const redirectedUrl = 'https://redirected.example/article';

  beforeEach(() => {
    process.env.TARGET_BROWSER = 'firefox';
    Object.defineProperty(globalThis, 'browser', {
      configurable: true,
      value: { runtime: { getURL: () => `${extensionOrigin}/` } },
    });
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest
        .fn()
        .mockReturnValueOnce('nonce-1')
        .mockReturnValueOnce('nonce-2')
        .mockReturnValueOnce('nonce-3')
        .mockReturnValueOnce('nonce-4'),
    });
  });

  afterEach(() => {
    if (originalBrowserApi) {
      Object.defineProperty(globalThis, 'browser', originalBrowserApi);
    } else {
      Reflect.deleteProperty(globalThis, 'browser');
    }
    if (originalRandomUUID) {
      Object.defineProperty(crypto, 'randomUUID', originalRandomUUID);
    } else {
      Reflect.deleteProperty(crypto, 'randomUUID');
    }
    if (originalBrowser === undefined) {
      delete process.env.TARGET_BROWSER;
    } else {
      process.env.TARGET_BROWSER = originalBrowser;
    }
  });

  it('challenges a DOM-ready announcement before iframe load and requires its reply', () => {
    const { result } = renderHook(() =>
      useExtensionSiteEmbed({ extensionId, targetUrl }),
    );
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    result.current.targetFrameRef.current = frame;
    const postMessage = jest.spyOn(
      frame.contentWindow as Window,
      'postMessage',
    );
    const announce = (source: MessageEventSource | null, nonce?: string) => {
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: new URL(redirectedUrl).origin,
            source,
            data: {
              source: extensionSiteEmbedTargetMessageSource,
              type: extensionSiteEmbedTargetEvent.DomReady,
              target: redirectedUrl,
              nonce,
            },
          }),
        );
      });
    };

    announce(window);
    expect(postMessage).not.toHaveBeenCalled();
    announce(null);
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: extensionSiteEmbedParentMessageSource,
        type: extensionSiteEmbedParentEvent.RequestDomReady,
        nonce: 'nonce-1',
      },
      '*',
    );
    expect(result.current.isTargetDomReady).toBe(false);
    announce(frame.contentWindow, 'forged-nonce');
    expect(result.current.isTargetDomReady).toBe(false);
    announce(frame.contentWindow, 'nonce-1');
    expect(result.current.isTargetDomReady).toBe(true);
    frame.remove();
  });

  it('replaces pending challenges on navigation and clears them on reset', () => {
    const { result, rerender } = renderHook(
      ({ url }) => useExtensionSiteEmbed({ extensionId, targetUrl: url }),
      { initialProps: { url: targetUrl } },
    );
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    result.current.targetFrameRef.current = frame;
    const postMessage = jest.spyOn(
      frame.contentWindow as Window,
      'postMessage',
    );
    const receive = (nonce?: string, options: MessageEventInit = {}) => {
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: new URL(redirectedUrl).origin,
            source: frame.contentWindow,
            data: {
              source: extensionSiteEmbedTargetMessageSource,
              type: extensionSiteEmbedTargetEvent.DomReady,
              target: redirectedUrl,
              nonce,
            },
            ...options,
          }),
        );
      });
    };

    receive();
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        source: extensionSiteEmbedParentMessageSource,
        type: extensionSiteEmbedParentEvent.RequestDomReady,
        nonce: 'nonce-1',
      },
      '*',
    );
    receive();
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ nonce: 'nonce-2' }),
      '*',
    );
    receive('nonce-1');
    receive('nonce-2', { source: window });
    receive('nonce-2', { origin: 'https://forged.example' });
    expect(result.current.isTargetDomReady).toBe(false);
    receive('nonce-2');
    expect(result.current.isTargetDomReady).toBe(true);

    receive();
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ nonce: 'nonce-3' }),
      '*',
    );
    receive('nonce-2');
    expect(result.current.isTargetDomReady).toBe(false);
    receive('nonce-3', { source: null, origin: extensionOrigin });
    expect(result.current.isTargetDomReady).toBe(true);

    receive();
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ nonce: 'nonce-4' }),
      '*',
    );
    rerender({ url: 'https://another.example/article' });
    receive('nonce-4');
    expect(result.current.isTargetDomReady).toBe(false);
    frame.remove();
  });
});
