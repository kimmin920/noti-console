import {
  createPublEventEditorDraft,
  publEventEditorReducer,
} from '../../features/console/publEvents/publEventEditorModel.js';

export const DETAIL_FIXTURE = Object.freeze({
  eventKey: 'ORDER_CREATED',
  displayName: 'Order created',
  locationType: 'P_APP',
  locationId: 'A00001',
  sourceType: 'channel',
  actionType: 'created',
  updatedAt: '2026-06-26T12:00:00.000Z',
  props: [
    {
      alias: 'targetPhoneNumber',
      description: 'Customer phone',
      enabled: true,
      fallback: null,
      label: '전화번호',
      parserPipeline: null,
      rawPath: 'payload.phone',
      required: true,
      sample: '010-0000-0000',
      sortOrder: 0,
      type: 'text',
    },
    {
      alias: 'targetName',
      description: null,
      enabled: false,
      fallback: '고객',
      label: '고객 이름',
      parserPipeline: [{ type: 'none' }],
      rawPath: 'payload.name',
      required: false,
      sample: null,
      sortOrder: 1,
      type: 'text',
    },
  ],
});

export function createDangerousChangeDraft() {
  const editing = createPublEventEditorDraft(DETAIL_FIXTURE);
  const rawUnlocked = publEventEditorReducer(editing, {
    propKey: 'targetPhoneNumber',
    type: 'UNLOCK_PROP_RAW_PATH',
  });
  const aliasUnlocked = publEventEditorReducer(rawUnlocked, {
    propKey: 'targetPhoneNumber',
    type: 'UNLOCK_PROP_ALIAS',
  });
  const rawChanged = publEventEditorReducer(aliasUnlocked, {
    field: 'rawPath',
    propKey: 'targetPhoneNumber',
    type: 'UPDATE_PROP_FIELD',
    value: 'payload.customer.phone',
  });

  return publEventEditorReducer(rawChanged, {
    field: 'alias',
    propKey: 'targetPhoneNumber',
    type: 'UPDATE_PROP_FIELD',
    value: 'customerPhone',
  });
}

export function createSerializedPayloadDraft() {
  const deleted = publEventEditorReducer(createDangerousChangeDraft(), {
    propKey: 'targetName',
    type: 'DELETE_PROP',
  });

  return publEventEditorReducer(deleted, {
    prop: {
      alias: 'orderNo',
      fallback: '',
      label: '주문 번호',
      rawPath: 'payload.orderNo',
      sample: '',
      type: 'text',
    },
    type: 'ADD_PROP',
  });
}
