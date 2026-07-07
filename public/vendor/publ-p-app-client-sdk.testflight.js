const DEBUG_MODE = 'OFF';

const HARDCODED_CREDENTIALS = {
  // for integration
  clientHash: 'sm5URNLarc19/0EZucSFA7H/E7em8hhEjJcf8B+6H3oq4r5+L3nWwLnU/zTFivk9',
  channelCode: 'L2NoYW5ubGVzLzk5OTk5OTk',
  channelId: '9999999',
  channelToken: '3RD_A00001',
  // for mock
  // clientHash: 'CLIENT_HASH_HERE',
  grantedClientHosts: ['', 'localhost:8000'], // change this according to your test client environment.
  // channelCode: 'L2NoYW5ubGVzLzk5OTk5OTk',
  // channelId: '9999999',
  // channelToken: 'MOCK_CHANNEL_TOKEN_9999999_1111111',
  accessToken: 'CLIENT_ACCESS_TOKEN_HERE', // change this to pre-generated client accessToken if you need.
  refreshToken: 'CLIENT_REFRESH_TOKEN_HERE' // change this to pre-generated client refreshToken if you need.
};

const MOCK_DATA = {
  'mount': {
    mountSession: {}
  },
  'authorize': {
    grantedPermissions: [
      {
        id: 1,
        type: "COMMON_TAP",
        distinctId: "DISTINCT_ID_HERE",
        permissionId: "PM_24439_READ_SELLER_BUSINESS_INFORMATION",
        targetTapId: "TAP_COMMON_00001_READ_SELLER_BUSINESS_INFORMATION",
        grantedResources: [
          "businessLicenseType"
        ],
        httpMethod: 'GET'
      },
      {
        id: 99,
        type: "CATALOG_TAP",
        distinctId: "DISTINCT_ID_HERE",
        permissionId: "PM_19177_READ_MEMBER_CONTACTS",
        targetTapId: "TAP_CATALOG_00001_READ_MEMBER_CONTACTS",
        grantedResources: [
          "distinctId",
          "nickname",
          "imageSrc",
          "countryCodeAlpha2",
          "registeredAt",
          "marketingPolicyAgreementStatus",
          "marketingPolicySignedAt",
          "supplementaryEmail",
          "profileAddInfoContactEmail",
          "profileAddInfoContactMobileNumber",
          "profileAddInfoContactPhoneNumber",
          "profileAddInfoShippingMobileNumber",
          "profileAddInfoWorkplaceEmail",
          "profileAddInfoWorkplacePhoneNumber",
          "profileAddInfoBizEmail",
          "profileAddInfoBizContactMobileNumber",
          "profileAddInfoBizContactEmail"
        ],
        httpMethod: 'GET'
      }
    ]
  },
  'proxy-taps': {
    'TAP_PROXY_00001_EXCHANGE_TOKEN': {
      accessToken: HARDCODED_CREDENTIALS.accessToken,
      refreshToken: HARDCODED_CREDENTIALS.refreshToken
    },
    'TAP_PROXY_00002_REFRESH_TOKEN': {
      accessToken: HARDCODED_CREDENTIALS.accessToken
    }
  },
  'common-taps': {
    'COMMON_TAP': {
      'TAP_COMMON_00001_READ_SELLER_BUSINESS_INFORMATION': {
        permissionId: "AUTO_FILLED",
        tapId: "TAP_COMMON_00001_READ_SELLER_BUSINESS_INFORMATION",
        tapName: "READ_SELLER_BUSINESS_INFORMATION",
        requestedDomainNameSingular: "seller_business_information",
        requestedDomainNamePlural: "seller_business_informations",
        lastUpdatedAt: "AUTO_FILLED",
        isSingular: true,
        queryResult: {
          "businessLicenseType": "LEGAL_ENTITY"
        },
        requestedResources: ["AUTO_FILLED"],
        grantedResources: ["businessLicenseType"]
      }
    },
    'CATALOG_TAP': {
      'TAP_CATALOG_00001_READ_MEMBER_CONTACTS': {
        permissionId: "AUTO_FILLED",
        tapId: "TAP_CATALOG_00001_READ_MEMBER_CONTACTS",
        tapName: "MEMBER_CONTACTS",
        requestedDomainNameSingular: "member_contact",
        requestedDomainNamePlural: "member_contacts",
        lastUpdatedAt: "AUTO_FILLED",
        isSingular: false,
        queryResult: [
          {
            "id": 1,
            "distinctId": "SUB9OYKF5J3N38F16R3-4CD6L",
            "nickname": "zoopeter1",
            "imageSrc": "https://ui-avatars.com/api/?name=zoopeter&size=96&color=000000&background=00d781",
            "countryCodeAlpha2": "KR",
            "registeredAt": "2022-07-04 12:18:37.000Z",
            "marketingPolicyAgreementStatus": true,
            "marketingPolicySignedAt": "2023-08-02 22:35:41.000Z",
            "supplementaryEmail": "zoopeter@cclss.net",
            "profileAddInfoContactEmail": "zoopeter@cclss.net",
            "profileAddInfoContactMobileNumber": null,
            "profileAddInfoContactPhoneNumber": null,
            "profileAddInfoShippingMobileNumber": null,
            "profileAddInfo_workplaceEmail": "zoopeter@cclss.net",
            "profileAddInfo_workplacePhoneNumber": null,
            "profileAddInfo_bizEmail": null,
            "profileAddInfo_bizContactMobileNumber": null,
            "profileAddInfo_bizContactEmail": null
          },
          {
            "id": 2,
            "distinctId": "SUB9OYKF5J3N38F16R3-5CD6L",
            "nickname": "zoopeter2",
            "imageSrc": "https://ui-avatars.com/api/?name=zoopeter&size=96&color=000000&background=00d781",
            "countryCodeAlpha2": "KR",
            "registeredAt": "2022-08-04 12:18:37.000Z",
            "marketingPolicyAgreementStatus": false,
            "marketingPolicySignedAt": "2023-08-02 22:35:41.000Z",
            "supplementaryEmail": "zoopeter@cclss.net",
            "profileAddInfoContactEmail": "zoopeter@cclss.net",
            "profileAddInfoContactMobileNumber": null,
            "profileAddInfoContactPhoneNumber": null,
            "profileAddInfoShippingMobileNumber": null,
            "profileAddInfo_workplaceEmail": "zoopeter@cclss.net",
            "profileAddInfo_workplacePhoneNumber": null,
            "profileAddInfo_bizEmail": null,
            "profileAddInfo_bizContactMobileNumber": null,
            "profileAddInfo_bizContactEmail": null
          }
        ],
        requestedResources: ["AUTO_FILLED"],
        grantedResources: ["businessLicenseType"]
      }
    }
  },
  'permissionSets': {
    'PM_24439_READ_SELLER_BUSINESS_INFORMATION': {
        targetTapId: "TAP_COMMON_00001_READ_SELLER_BUSINESS_INFORMATION",
        type: "COMMON_TAP",
        grantedResources: [
          "businessLicenseType"
        ],
        httpMethod: "GET"
    },
    'PM_19177_READ_MEMBER_CONTACTS': {
        targetTapId: "TAP_CATALOG_00001_READ_MEMBER_CONTACTS",
        type: "CATALOG_TAP",
        grantedResources: [
          "distinctId",
          "nickname",
          "imageSrc",
          "countryCodeAlpha2",
          "registeredAt",
          "marketingPolicyAgreementStatus",
          "marketingPolicySignedAt",
          "supplementaryEmail",
          "profileAddInfoContactEmail",
          "profileAddInfoContactMobileNumber",
          "profileAddInfoContactPhoneNumber",
          "profileAddInfoShippingMobileNumber",
          "profileAddInfoWorkplaceEmail",
          "profileAddInfoWorkplacePhoneNumber",
          "profileAddInfoBizEmail",
          "profileAddInfoBizContactMobileNumber",
          "profileAddInfoBizContactEmail"
        ],
        httpMethod: "GET"
    }
  }
};

class ChannelUtils {
  static getChannelCredentials(mode) {
    if (mode === 'MOCK') {
      return HARDCODED_CREDENTIALS;
    }

    const channelCode = location.pathname.split('/')[2];
    const channelId = atob(channelCode);
    const channelToken = localStorage.getItem(`@prod/access_token_${channelCode}`);

    return {
      channelCode,
      channelId,
      channelToken
    }
  }
}

class BackendAdapter {
  constructor({ useMock }) {
    this._useMock = useMock;
  }

  fetch(httpMethod, uri, headers, body) {
    if (this._useMock) {
      return this._mockFetch(httpMethod, uri, headers, body);
    }

    // send a real request
    return window.fetch(uri, {
      method: httpMethod,
      headers,
      body: JSON.stringify(body)
    }).then((res) => res.json()).then((respBody) => { respBody });
  }

  _mockFetch(httpMethod, uri, headers, body) {
    const [isAuthenticated, _parsedClaims] = this._ensureAuthenticated(headers, body)

    if (!isAuthenticated) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ error: 'UNAUTHORIZED' });
        }, 250);
      });
    }

    if (uri.includes('mount')) {
      const { clientHash } = body;

      if (clientHash !== HARDCODED_CREDENTIALS.clientHash) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ error: 'UNAUTHORIZED' });
          }, 250);
        });
      }

      return new Promise((resolve) => {
        setTimeout(() => {
          const data = this._manipulateDataFromMockData(httpMethod, uri, headers, body, 'MOUNT');

          if (!data) {
            resolve({ error: 'BAD_REQUEST' });
          }

          resolve({ responseBody: { data } });
        }, 250);
      });
    }

    if (uri.includes('authorize')) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const data = this._manipulateDataFromMockData(httpMethod, uri, headers, body, 'AUTHORIZE');

          if (!data) {
            resolve({ error: 'BAD_REQUEST' });
          }

          resolve({ responseBody: { data } });
        }, 250);
      });
    }

    if (uri.includes('proxy-taps')) {
      return new Promise((resolve) => {
        setTimeout(() => {
          const data = this._manipulateDataFromMockData(httpMethod, uri, headers, body, 'PROXY');

          if (!data) {
            resolve({ error: 'BAD_REQUEST' });
          }

          resolve({ responseBody: { data } });
        }, 250)
      });
    }

    const isPermissionGranted = this._ensurePermissionGranted(uri, body);

    if (!isPermissionGranted) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ error: 'FORBIDDEN' });
        }, 250);
      });
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const data = this._manipulateDataFromMockData(httpMethod, uri, headers, body, 'COMMON');

        if (!data) {
          resolve({ error: 'BAD_REQUEST' });
        }

        resolve({ responseBody: { data }});
      }, 250);
    })
  }

  _ensureAuthenticated(headers, body) {
    const channelId = headers['x-publ-channel-id'];
    const channelToken = headers['Authorization'].split('Bearer ')[1];

    const [channelIdFromChannelToken, installedPAppIdFromChannelToken] = channelToken.split('MOCK_CHANNEL_TOKEN_')[1].split('_');

    if (channelId !== channelIdFromChannelToken) {
      return [false, {}];
    }

    const { pAppCode } = body;
    const consumerId = `PUBL-${channelId}-${pAppCode}-${installedPAppIdFromChannelToken}`;

    return [true, {consumerId, channelId, pAppCode, installedPAppIdFromChannelToken}];
  }

  _ensurePermissionGranted(uri, body) {
    const [path, queryString] = uri.replace('https://api.dev.publishingkit.net', '').split('?');
    const tapId = path.split('common-taps/')[1].split('/')[0];

    const { permissionId, resources: resourcesInStr } = Object.fromEntries(new URLSearchParams(queryString));

    const permissionSet = MOCK_DATA['permissionSets'][permissionId];

    if (!permissionSet) {
      return false;
    }

    if (permissionSet.targetTapId !== tapId) {
      return false;
    }

    const resources = resourcesInStr.split(',');

    const grantedResourcesSet = new Set(permissionSet.grantedResources)
    const resourcesSet = new Set(resources);
    if (!grantedResourcesSet.isSupersetOf(resourcesSet)) {
      return false;
    }

    return true;
  }

  _manipulateDataFromMockData(httpMethod, uri, headers, body, type) {
    const [path, queryString] = uri.replace('https://api.dev.publishingkit.net', '').split('?');

    if (type === 'MOUNT') {
      const { host, clientHash, pAppCode } = body;

      const mountSession = Object.assign({}, MOCK_DATA['mount'].mountSession, {
        host,
        clientHash,
        pAppCode
      });

      return {
        mountSession
      };
    }

    if (type === 'AUTHORIZE') {
      const { requestedPermissionIds } = body;

      const grantedAccessPermissions = MOCK_DATA['authorize'].grantedPermissions.filter((permission) => {
        return requestedPermissionIds.includes(permission.permissionId);
      });

      return {
        grantedAccessPermissions
      };
    }

    if (type === 'PROXY') {
      const tapId = path.split('proxy-taps/')[1].split('/')[0];

      return MOCK_DATA['proxy-taps'][tapId];
    }

    const tapId = path.split('common-taps/')[1].split('/')[0];
    const tapType = tapId.includes('TAP_COMMON') ? 'COMMON_TAP' : 'CATALOG_TAP';
    const queryParams = Object.fromEntries(new URLSearchParams(queryString));
    const { permissionId, page, limit, sortBy, order, resources: resourcesInStr, ...filters }  = queryParams;
    const resources = resourcesInStr.split(',');

    const tapData = MOCK_DATA['common-taps'][tapType][tapId];

    const { isSingular, queryResult } = tapData;

    if (isSingular) {
      const resourceFilteredQueryResult = resources.reduce((acc, key) => {
        return Object.assign({}, acc, {
          [key]: queryResult[key]
        });
      }, {});

      const tap = Object.assign({}, tapData, {
        queryResult: resourceFilteredQueryResult,
        lastUpdatedAt: new Date().toISOString(),
        requestedResources: resources
      });

      return { tap };
    }

    const filteredQueryResult = queryResult.filter((row) => {
      return !Object.entries(filters).some(([key, value]) => {
        return row[key] !== value;
      });
    });

    const sortedQueryResult = !sortBy
      ? filteredQueryResult
      : filteredQueryResult.sort((a, b) => {
        const weight = order === 'ASC' ? 1 : -1;

        let result = 0;
        if (a[sortBy] < b[sortBy]) {
          result = -1;
        } else if (a[sortBy] > b[sortBy]) {
          result = 1;
        }

        return weight * result;
      });

    const resourceFilteredQueryResult = sortedQueryResult.map((row) => {
      return resources.reduce((acc, key) => {
        return Object.assign({}, acc, {
          [key]: row[key]
        });
      }, {});
    });

    const paginatedQueryResult = resourceFilteredQueryResult.slice(((page - 1) * limit), page * limit);

    const pagination = {
      page: +page,
      limit: +limit,
      total: resourceFilteredQueryResult.length
    };

    const tap = Object.assign({}, tapData, {
      permissionId,
      queryResult: paginatedQueryResult,
      pagination,
      lastUpdatedAt: new Date().toISOString(),
      requestedResources: resources
    });

    return { tap };
  }
}

class SWPAppProviderAdapter {
  constructor() {
    // this._backendAdapter = new BackendAdapter({ useMock: true });
    this._backendAdapter = new BackendAdapter({ useMock: false });
    this._isMounted = false;
    this._mountSession = {
      host: null,
      clientHash: null,
      pAppCode: null
    };
    this._isPipelineAuthorized = false;
    this._grantedPermissionSets = {};

    this._isClientUserAuthenticated = false;
    this._clientUserSession = {
      accessToken: null,
      refreshToken: null
    };
  }

  _getStatus() {
    return {
      isMounted: this._isMounted,
      mountSession: this._mountSession,
      isPipelineAuthorized: this._isPipelineAuthorized,
      grantedPermissionSets: this._grantedPermissionSets,
      isClientUserAuthenticated: this._isClientUserAuthenticated,
      clientUserSession: this._clientUserSession
    };
  }

  simulateOnMessage(message) {
    return this._onMessageHandler(message);
  }

  _onMessageHandler(message) {
    const { methodType, action, payload, host } = message;

    if (this._isMounted && this._mountSession.host !== host) {
      return new Promise((resolve) => {
        resolve(this._respond('UNAUTHORIZED', { msg: 'HOST_HAS_BEEN_CHANGED' }));
      });
    }

    if (methodType === 'PARENT') {
      if (action === 'STATUS') {
        return new Promise((resolve) => {
          const data = {
            status: this._getStatus()
          };

          resolve(this._respond('OK', data));
        });
      }
    }

    if (methodType === 'NOVICE') {
      if (action === 'PING') {
        return new Promise((resolve) => {
          const { msg } = payload;

          const data = {
            ping: `Respond to ${msg}`
          };

          resolve(this._respond('OK', data));
        });
      }

      if (action === 'MOUNT') {
        const { clientHash, pAppCode } = payload;

        const body = {
          clientHash,
          pAppCode,
          host
        };

        return this._request('POST', 'https://api.dev.publishingkit.net/seller/api/v2/integrations/pipelines/mount', body);
      }
    }

    if (methodType === 'PIPELINE') {
      if (!this._isMounted) {
        return new Promise((resolve) => {
          resolve(this._respond('UNAUTHORIZED', { msg: 'MOUNT_PROCESS_REQUIRED' }));
        });
      }

      if (action === 'AUTHORIZE') {
        const { permissionIds } = payload;
        const pAppCode = this._pAppCode;

        const body = {
          pAppCode,
          requestedPermissionIds: permissionIds
        };

        return this._request('POST', 'https://api.dev.publishingkit.net/seller/api/v2/integrations/pipelines/authorize', body);
      }

      if (!this._isPipelineAuthorized) {
        return new Promise((resolve) => {
          resolve(this._respond('UNAUTHORIZED', { msg: 'AUTHORIZE_PROCESS_REQUIRED' }));
        });
      }

      if (action === 'REQUEST') {
        const { permissionId, opts } = payload;

        switch(permissionId) {
          case "PM_00000_EXCHANGE_TOKEN":
            const bodyForExchangeToken = {
              permissionId
            };

            return this._request('POST', 'https://api.dev.publishingkit.net/seller/api/v2/integrations/pipelines/proxy-taps/TAP_PROXY_00001_EXCHANGE_TOKEN/dispatch', bodyForExchangeToken);

          case "PM_00000_REFRESH_TOKEN":
            const bodyForRefreshToken = {
              permissionId,
              previousAccessToken: this._clientUserSession.accessToken,
              refreshToken: this._clientUserSession.refreshToken
            };

            return this._request('POST', 'https://api.dev.publishingkit.net/seller/api/v2/integrations/pipelines/proxy-taps/TAP_PROXY_00002_REFRESH_TOKEN/dispatch', bodyForRefreshToken);

          default:
            const grantedPermission = this._grantedPermissionSets[permissionId];

            if (grantedPermission) {
              const { _type, httpMethod, targetTapId, grantedResources } = grantedPermission;

              if (opts.resources) {
                const grantedResourcesSet = new Set(grantedResources)
                const resourcesSet = new Set(opts.resources);

                if (!grantedResourcesSet.isSupersetOf(resourcesSet)) {
                  return new Promise((resolve) => {
                    resolve(this._respond('FORBIDDEN', { msg: 'ONE_OR_MORE_OF_REQUESTED_RESOURCES_NOT_GRANTED' }));
                  });
                }
              }

              const requestedResources = (opts.resources || grantedResources);
              const requestedResourcesInStr = requestedResources.length > 0 ? requestedResources.join(',') : null;

              const body = {
                permissionId
              };

              const queryString = httpMethod === 'GET'
                ? '?' + (new URLSearchParams({
                          page: opts.page || 1,
                          limit: opts.limit || 20,
                          ...(opts.sortBy ? { sortBy: opts.sortBy } : {}),
                          ...(opts.order ? { order: opts.order } : {}),
                          ...(permissionId ? { permissionId: permissionId } : {}),
                          ...(requestedResourcesInStr ? { resources: requestedResourcesInStr } : {}),
                          ...(opts.filters || {})
                        })).toString()
                : '';

              return this._request(httpMethod, `https://api.dev.publishingkit.net/seller/api/v2/integrations/pipelines/common-taps/${targetTapId}${queryString}`, body);
            }

            return new Promise((resolve) => {
              resolve(this._respond('FORBIDDEN', { msg: 'REQUESTED_PERMISSION_ID_SHOULD_BE_GRANTED_IN_AUTHORIZE_PROCESS' }));
            });
        }
      }
    }
  }

  async _request(httpMethod, uri, body) {
    const {
      channelCode: _channelCode,
      channelId,
      channelToken,
    } = ChannelUtils.getChannelCredentials('MOCK');

    const headers = {
      'x-publ-channel-id': channelId,
      'Authorization': `Bearer ${channelToken}`
    };

    const enhancedBody = Object.assign({}, body, {
      pAppCode: body.pAppCode || this._mountSession.pAppCode
    });

    const { error, responseBody } = await this._backendAdapter.fetch(httpMethod, uri, headers, enhancedBody);

    if (error) {
      return this._respond(error, {});
    }

    if (responseBody.data.mountSession) {
      this._isMounted = true;
      this._mountSession = responseBody.data.mountSession;
    }

    if (responseBody.data.grantedAccessPermissions) {
      this._isPipelineAuthorized = true;
      this._grantedPermissionSets = responseBody.data.grantedAccessPermissions.reduce((acc, gap) => {
        return Object.assign({}, acc, {
          [gap.permissionId]: {
            targetTapId: gap.targetTapId,
            type: gap.type,
            grantedResources: gap.grantedResources,
            httpMethod: gap.httpMethod
          }
        });
      }, {});
    }

    if (responseBody.data.accessToken) {
      this._isClientUserAuthenticated = true;
      this._clientUserSession = Object.assign({}, this._clientUserSession, {
        ...(responseBody.data.accessToken ? { accessToken: responseBody.data.accessToken } : {}),
        ...(responseBody.data.refreshToken ? { refreshToken: responseBody.data.refreshToken } : {})
      });
    }

    if (!responseBody.data.tap) {
      return this._respond('OK', responseBody.data || {});
    }

    const {
      isSingular,
      requestedDomainNameSingular,
      requestedDomainNamePlural,
      queryResult,
      lastUpdatedAt,
      requestedResources,
      pagination
    } = responseBody.data.tap;

    const requestedDomainNameInSnakeCase = isSingular ? requestedDomainNameSingular : requestedDomainNamePlural;
    const requestedDomainNameInCamelCase = requestedDomainNameInSnakeCase.replace(
      /(?!^)_(.)/g,
      (_, char) => char.toUpperCase()
    );

    const data = {
      [requestedDomainNameInCamelCase]: queryResult,
      pagination,
      requestedResources,
      lastUpdatedAt
    };

    return this._respond('OK', data);
  }

  _respond(status, data) {
    const message = {
      action: 'RESPOND',
      payload: { status, data }
    };

    if (DEBUG_MODE === 'ON') {
      console.log('postMessage to child', message);
    }

    return message;
  }
}

class Messenger {
  constructor({ useAdapter, adapter}) {
    this._useAdapter = useAdapter;
    this._adapter = adapter;
    this._taskMap = {};

    window.onmessage = (e) => {
      if (!e.data.action && !e.data.action === 'RESPOND') {
        return;
      }

      const {
        taskId,
        action,
        payload
      } = e.data;

      if (this._taskMap[taskId]) {
        if (this._taskMap[taskId].status !== 'QUEUED') {
          return;
        }

        this._taskMap[taskId].result = { action, payload };
        this._taskMap[taskId].status = 'RESOLVED';
      }
    }
  }

  request(message) {
    if (this._useAdapter) {
      return this._simulatePostMessage(message);
    }

    const timestamp = new Date().getTime();
    const rand = Math.floor(Math.random() * 100000);
    const taskId = `TASK-${timestamp}-${rand}`;

    this._taskMap[taskId] = {
      id: taskId,
      status: 'QUEUED',
      count: 0,
      result: null
    };

    return this._postMessage(taskId, message);
  }

  _simulatePostMessage(message) {
    return this._adapter.simulateOnMessage(message);
  }

  _postMessage(taskId, message) {
    return new Promise((resolve) => {
      window.parent.postMessage({taskId, message}, '*');

      const interval = setInterval(() => {
        if (this._taskMap[taskId]) {
          if (this._taskMap[taskId].status === 'QUEUED') {
            if (this._taskMap[taskId].count && this._taskMap[taskId].count > 150) {
              this._taskMap[taskId].status = 'TIMEOUT';

              clearInterval(interval);
              resolve({ action: 'RESPOND', payload: { status: 'TIMEOUT', data: { msg: 'Connection Timeout.' }}});
            }

            this._taskMap[taskId].count = this._taskMap[taskId].count ? this._taskMap[taskId].count + 1 : 1;

            return;
          }

          if (this._taskMap[taskId].status === 'RESOLVED') {
            const naiveResult = this._taskMap[taskId].result;

            if (naiveResult.payload.data && naiveResult.payload.data.tap) {
              // const {
              //   isSingular,
              //   requestedDomainNameSingular,
              //   requestedDomainNamePlural,
              //   queryResult,
              //   lastUpdatedAt,
              //   requestedResources,
              //   pagination
              // } = naiveResult.payload.data.tap;

              // const requestedDomainNameInSnakeCase = isSingular ? requestedDomainNameSingular : requestedDomainNamePlural;
              // const requestedDomainNameInCamelCase = requestedDomainNameInSnakeCase.replace(
              //   /(?!^)_(.)/g,
              //   (_, char) => char.toUpperCase()
              // );

              // const data = {
              //   [requestedDomainNameInCamelCase]: queryResult,
              //   pagination,
              //   requestedResources,
              //   lastUpdatedAt
              // };

              clearInterval(interval);
              resolve({ action: 'RESPOND', payload: { data: naiveResult.payload.data } });

              return;
            }

            clearInterval(interval);
            resolve(this._taskMap[taskId].result);
          }
        }
      }, 100);
    });
  }
}

class PipelineClient {
  constructor(parent) {
    this._parent = parent;
  }

  authorize(permissionIds) {
    return this._parent._dispatcher('PIPELINE', 'AUTHORIZE', { permissionIds });
  }

  request(permissionId, opts = {}) {
    return this._parent._dispatcher('PIPELINE', 'REQUEST', { permissionId, opts });
  }
}

class SWPAppClient {
  constructor() {
    this.pipeline = new PipelineClient(this);

    this._messenger = new Messenger({
      // useAdapter: true,
      // adapter: new SWPAppProviderAdapter()
    });
  }

  getStatus() {
    return this._dispatcher('PARENT', 'STATUS', {});
  }

  ping(msg) {
    return this._dispatcher('NOVICE', 'PING', { msg });
  }

  mount({ clientHash, pAppCode }) {
    return this._dispatcher('NOVICE', 'MOUNT', { clientHash, pAppCode });
  }

  _dispatcher(methodType, action, payload) {
    const message = {
      methodType,
      action,
      payload,
      host: location.host
    };

    return this._messenger.request(message).then((responseMessage) => responseMessage.payload);
  }
}

class PAppClientSDK {
  static create(target) {
    if (target === 'SELLER_SIDE') {
      return new SWPAppClient();
    }
  }
}

window.PAppClientSDK = PAppClientSDK;
