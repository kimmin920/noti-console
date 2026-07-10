export function createSdkInitScript({ denyContacts = false } = {}) {
  return `(${installSdkFixture.toString()})(${JSON.stringify({ denyContacts })});`;
}

function installSdkFixture({ denyContacts }) {
    const readCounter = (key) => Number(sessionStorage.getItem(`vizuo:e2e:${key}`) ?? 0);
    const writeCounter = (key, value) => {
      sessionStorage.setItem(`vizuo:e2e:${key}`, String(value));
    };
    const incrementCounter = (key) => {
      const nextValue = readCounter(key) + 1;
      writeCounter(key, nextValue);
      return nextValue;
    };
    const state = {
      denyContacts,
      exchangeCount: readCounter('exchangeCount'),
      ready: true,
      refreshCount: readCounter('refreshCount'),
      requestCount: readCounter('requestCount'),
    };

    const encodeBase64Url = (value) => btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/u, '');

    const makeToken = (sessionId) => [
      'e2e',
      encodeBase64Url({
        consumerId: 'consumer-e2e',
        sessionId,
        userId: 'publ-user-e2e',
      }),
      'signature',
    ].join('.');

    window.__VIZUO_PUBL_E2E__ = state;
    window.__VIZUO_PUBL_SDK_ADAPTER__ = {
      async authorize(permissionIds = []) {
        if (
          state.denyContacts &&
          Array.isArray(permissionIds) &&
          permissionIds.includes('PM_19177_READ_MEMBER_CONTACTS')
        ) {
          return { status: 'DENIED' };
        }
        return { status: 'OK' };
      },
      async exchangeToken() {
        state.exchangeCount = incrementCounter('exchangeCount');
        return {
          data: {
            accessToken: makeToken(`session-${state.exchangeCount}`),
            refreshToken: `refresh-${state.exchangeCount}`,
          },
        };
      },
      async mount() {
        return { status: 'OK' };
      },
      async refreshToken() {
        state.refreshCount = incrementCounter('refreshCount');
        return {
          data: {
            accessToken: makeToken(`session-${state.exchangeCount}`),
          },
        };
      },
      async request(permissionId) {
        state.requestCount = incrementCounter('requestCount');
        if (state.denyContacts && permissionId === 'PM_19177_READ_MEMBER_CONTACTS') {
          return { status: 'DENIED' };
        }
        return {
          data: {
            members: [
              {
                distinctId: 'member-one',
                nickname: 'Publ recipient',
                profileAddInfoContactMobileNumber: '01000000000',
              },
            ],
          },
          status: 'OK',
        };
      },
    };
}
