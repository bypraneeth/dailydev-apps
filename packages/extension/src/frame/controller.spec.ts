import { extensionSiteEmbedFrameEvent } from '@dailydotdev/shared/src/features/extensionEmbed/common';
import browser from 'webextension-polyfill';
import { initializeFrame } from './controller';
import {
  enableFrameEmbeddingViaBackground,
  hasFrameEmbeddingPermissions,
  requestFrameEmbeddingPermissions,
} from '../lib/frameEmbedding';
import { renderMessage, renderPermissionPrompt } from './render';

jest.mock('../lib/frameEmbedding', () => ({
  enableFrameEmbeddingViaBackground: jest.fn(),
  hasFrameEmbeddingPermissions: jest.fn(),
  requestFrameEmbeddingPermissions: jest.fn(),
}));

jest.mock('webextension-polyfill', () => ({
  runtime: {
    reload: jest.fn(),
  },
}));

jest.mock('./render', () => ({
  renderMessage: jest.fn(),
  renderPermissionPrompt: jest.fn(),
}));

describe('initializeFrame', () => {
  const root = document.createElement('div');
  const target = new URL('https://example.com/article');
  const sendParentMessage = jest.fn();
  const onEmbeddingEnabled = jest.fn();
  const originalBrowser = process.env.TARGET_BROWSER;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    process.env.TARGET_BROWSER = 'chrome';
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalBrowser === undefined) {
      delete process.env.TARGET_BROWSER;
    } else {
      process.env.TARGET_BROWSER = originalBrowser;
    }
  });

  it('requests an extension reload after permission is granted', async () => {
    (hasFrameEmbeddingPermissions as jest.Mock).mockResolvedValue(false);
    (requestFrameEmbeddingPermissions as jest.Mock).mockResolvedValue(true);

    let requestPermission:
      | (() => Promise<'granted' | 'dismissed' | 'failed'>)
      | undefined;
    (renderPermissionPrompt as jest.Mock).mockImplementation(
      ({
        onRequestPermission,
      }: {
        onRequestPermission: () => Promise<'granted' | 'dismissed' | 'failed'>;
      }) => {
        requestPermission = onRequestPermission;
      },
    );

    await initializeFrame({
      root,
      target,
      sendParentMessage,
      onEmbeddingEnabled,
    });

    expect(requestPermission).toBeDefined();
    await expect(requestPermission?.()).resolves.toBe('granted');

    expect(sendParentMessage).toHaveBeenCalledWith(
      extensionSiteEmbedFrameEvent.Error,
      {
        reason: 'missing-permission',
        target: target.href,
      },
    );
    expect(sendParentMessage).toHaveBeenCalledWith(
      extensionSiteEmbedFrameEvent.ReloadRequested,
      {
        target: target.href,
      },
    );
    expect(enableFrameEmbeddingViaBackground).not.toHaveBeenCalled();
    expect(onEmbeddingEnabled).not.toHaveBeenCalled();
    expect(renderMessage).not.toHaveBeenCalled();
    expect(browser.runtime.reload).toHaveBeenCalledTimes(0);
    jest.runOnlyPendingTimers();
    expect(browser.runtime.reload).toHaveBeenCalledTimes(1);
  });

  it('enables Firefox embedding after granting permission without reloading', async () => {
    process.env.TARGET_BROWSER = 'firefox';
    (hasFrameEmbeddingPermissions as jest.Mock).mockResolvedValue(false);
    (requestFrameEmbeddingPermissions as jest.Mock).mockResolvedValue(true);
    (enableFrameEmbeddingViaBackground as jest.Mock).mockResolvedValue({
      enabled: true,
      tabId: 17,
    });

    await initializeFrame({
      root,
      target,
      sendParentMessage,
      onEmbeddingEnabled,
    });

    const { onRequestPermission } = (renderPermissionPrompt as jest.Mock).mock
      .calls[0][0];
    await expect(onRequestPermission()).resolves.toBe('granted');

    expect(enableFrameEmbeddingViaBackground).toHaveBeenCalledWith();
    expect(onEmbeddingEnabled).toHaveBeenCalled();
    expect(sendParentMessage).toHaveBeenCalledWith(
      extensionSiteEmbedFrameEvent.EmbeddingReady,
      { target: target.href },
    );
    expect(sendParentMessage).not.toHaveBeenCalledWith(
      extensionSiteEmbedFrameEvent.ReloadRequested,
      expect.anything(),
    );
    jest.runOnlyPendingTimers();
    expect(browser.runtime.reload).not.toHaveBeenCalled();
  });

  it('does not enable embedding when Firefox permission is denied', async () => {
    process.env.TARGET_BROWSER = 'firefox';
    (hasFrameEmbeddingPermissions as jest.Mock).mockResolvedValue(false);
    (requestFrameEmbeddingPermissions as jest.Mock).mockResolvedValue(false);

    await initializeFrame({
      root,
      target,
      sendParentMessage,
      onEmbeddingEnabled,
    });

    const { onRequestPermission } = (renderPermissionPrompt as jest.Mock).mock
      .calls[0][0];
    await expect(onRequestPermission()).resolves.toBe('dismissed');
    expect(enableFrameEmbeddingViaBackground).not.toHaveBeenCalled();
    expect(browser.runtime.reload).not.toHaveBeenCalled();
  });
});
