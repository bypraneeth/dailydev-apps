import {
  extensionSiteEmbedParentEvent,
  extensionSiteEmbedParentMessageSource,
} from '@dailydotdev/shared/src/features/extensionEmbed/common';
import {
  isDisableFrameMessage,
  resolveFrameParentOrigin,
} from './parentMessaging';

jest.mock('webextension-polyfill', () => ({
  runtime: { getURL: (path: string) => `moz-extension://daily-local/${path}` },
}));

const ownOrigin = 'moz-extension://daily-local';
const data = {
  source: extensionSiteEmbedParentMessageSource,
  type: extensionSiteEmbedParentEvent.Disable,
};

it('resolves the own Firefox extension origin without using opaque URL.origin', () => {
  expect(resolveFrameParentOrigin(ownOrigin)).toBe(ownOrigin);
  expect(resolveFrameParentOrigin(`${ownOrigin}/index.html`)).toBe(ownOrigin);
  expect(resolveFrameParentOrigin('moz-extension://other')).toBeNull();
  expect(resolveFrameParentOrigin('chrome-extension://daily-local')).toBeNull();
  expect(resolveFrameParentOrigin('https://app.daily.dev/')).toBe(
    'https://app.daily.dev',
  );
  expect(resolveFrameParentOrigin('moz-extension://app.daily.dev')).toBeNull();
});

it('accepts an opaque message source only from the own extension origin', () => {
  expect(
    isDisableFrameMessage(
      new MessageEvent('message', { origin: ownOrigin, source: null, data }),
      ownOrigin,
    ),
  ).toBe(true);
  expect(
    isDisableFrameMessage(
      new MessageEvent('message', {
        origin: 'https://app.daily.dev',
        source: null,
        data,
      }),
      'https://app.daily.dev',
    ),
  ).toBe(false);
});

it('requires a non-null source to be the parent window', () => {
  expect(
    isDisableFrameMessage(
      new MessageEvent('message', {
        origin: ownOrigin,
        source: window,
        data,
      }),
      ownOrigin,
    ),
  ).toBe(true);
  const sibling = document.createElement('iframe');
  document.body.appendChild(sibling);
  expect(
    isDisableFrameMessage(
      new MessageEvent('message', {
        origin: ownOrigin,
        source: sibling.contentWindow,
        data,
      }),
      ownOrigin,
    ),
  ).toBe(false);
  sibling.remove();
});
