import {
  pagePermissionBridgeRequestEvent,
  pagePermissionBridgeResultEvent,
  requestFrameEmbeddingPermissionFromPage,
} from './pagePermissionBridge';
import type { PagePermissionBridgeResult } from './pagePermissionBridge';

const dispatchResult = (detail: PagePermissionBridgeResult): void => {
  window.dispatchEvent(
    new CustomEvent<PagePermissionBridgeResult>(
      pagePermissionBridgeResultEvent,
      { detail },
    ),
  );
};

describe('requestFrameEmbeddingPermissionFromPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'browser');
  });

  it.each([true, false])(
    'requests optional Firefox origins synchronously and returns grant %s without the page bridge',
    async (granted) => {
      jest.replaceProperty(process, 'env', {
        ...process.env,
        TARGET_BROWSER: 'firefox',
      });
      const request = jest.fn().mockResolvedValue(granted);
      Object.defineProperty(globalThis, 'browser', {
        configurable: true,
        value: { permissions: { request } },
      });
      const dispatch = jest.spyOn(window, 'dispatchEvent');

      const result = requestFrameEmbeddingPermissionFromPage();

      expect(request).toHaveBeenCalledWith({
        origins: ['*://*/*'],
      });
      expect(dispatch).not.toHaveBeenCalled();
      await expect(result).resolves.toEqual({ granted });
    },
  );

  it('reports a failed Firefox permission request without enabling the reader', async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      TARGET_BROWSER: 'firefox',
    });
    Object.defineProperty(globalThis, 'browser', {
      configurable: true,
      value: {
        permissions: {
          request: jest
            .fn()
            .mockRejectedValue(new Error('Missing user gesture')),
        },
      },
    });

    await expect(requestFrameEmbeddingPermissionFromPage()).resolves.toEqual({
      granted: false,
      error: 'Missing user gesture',
    });
  });

  it('dispatches the request event synchronously to preserve user activation', () => {
    const onRequest = jest.fn();
    window.addEventListener(pagePermissionBridgeRequestEvent, onRequest);

    requestFrameEmbeddingPermissionFromPage();

    expect(onRequest).toHaveBeenCalledTimes(1);
    window.removeEventListener(pagePermissionBridgeRequestEvent, onRequest);
  });

  it('resolves with the granted result from the content script', async () => {
    const promise = requestFrameEmbeddingPermissionFromPage();

    dispatchResult({ granted: true });

    await expect(promise).resolves.toEqual({
      granted: true,
      error: undefined,
    });
  });

  it('resolves with a timeout error when no content script answers', async () => {
    const promise = requestFrameEmbeddingPermissionFromPage();

    jest.runAllTimers();

    await expect(promise).resolves.toEqual({
      granted: false,
      error: 'timeout',
    });
  });

  it('ignores late results after the timeout already settled the promise', async () => {
    const promise = requestFrameEmbeddingPermissionFromPage();

    jest.runAllTimers();
    dispatchResult({ granted: true });

    await expect(promise).resolves.toEqual({
      granted: false,
      error: 'timeout',
    });
  });
});
