import { describe, expect, it } from 'vitest';

import {
  createPublEventEditorDraft,
  getPublEventEditorPreflightIssues,
  isPublEventEditorDirty,
  publEventEditorReducer,
  serializePublEventEditorPayload,
} from '../../features/console/publEvents/publEventEditorModel.js';
import {
  DETAIL_FIXTURE,
  createDangerousChangeDraft,
  createSerializedPayloadDraft,
} from './publEventEditorModel.fixture.js';

describe('PUBL event editor model', () => {
  it('creates an editable draft with baseUpdatedAt and no dirty state', () => {
    const state = createPublEventEditorDraft(DETAIL_FIXTURE);

    expect(state.mode).toBe('edit');
    expect(state.baseUpdatedAt).toBe('2026-06-26T12:00:00.000Z');
    expect(state.draft.event).toMatchObject({
      eventKey: 'ORDER_CREATED',
      displayName: 'Order created',
    });
    expect(state.draft.props.map((prop) => prop.originalAlias)).toEqual([
      'targetPhoneNumber',
      'targetName',
    ]);
    expect(state.draft.props[0].sample).toBe('010-0000-0000');
    expect(state.draft.props[1].sample).toBe('');
    expect(isPublEventEditorDirty(state)).toBe(false);
  });

  it('preserves existing multi-step parser pipelines until the format is explicitly changed', () => {
    const state = createPublEventEditorDraft({
      ...DETAIL_FIXTURE,
      props: [
        {
          ...DETAIL_FIXTURE.props[0],
          parserPipeline: [
            { type: 'mapTemplate', template: '{{name}}' },
            { type: 'join', separator: ', ' },
          ],
        },
      ],
    });
    const labelChanged = publEventEditorReducer(state, {
      field: 'label',
      propKey: 'targetPhoneNumber',
      type: 'UPDATE_PROP_FIELD',
      value: '수신 전화번호',
    });
    const formatChanged = publEventEditorReducer(labelChanged, {
      propKey: 'targetPhoneNumber',
      step: { type: 'phoneFormat' },
      type: 'SET_PROP_FORMAT',
    });

    expect(labelChanged.draft.props[0].parserPipeline).toEqual([
      { type: 'mapTemplate', template: '{{name}}' },
      { type: 'join', separator: ', ' },
    ]);
    expect(formatChanged.draft.props[0].parserPipeline).toEqual([{ type: 'phoneFormat' }]);
  });

  it('tracks dirty state for event and prop edits and resets on cancel', () => {
    const editing = createPublEventEditorDraft(DETAIL_FIXTURE);
    const renamed = publEventEditorReducer(editing, {
      field: 'displayName',
      type: 'UPDATE_EVENT_FIELD',
      value: 'Order created updated',
    });
    const updatedProp = publEventEditorReducer(renamed, {
      field: 'label',
      propKey: 'targetName',
      type: 'UPDATE_PROP_FIELD',
      value: '주문자 이름',
    });
    const canceled = publEventEditorReducer(updatedProp, { type: 'CANCEL_EDIT_MODE' });

    expect(isPublEventEditorDirty(updatedProp)).toBe(true);
    expect(updatedProp.draft.event.displayName).toBe('Order created updated');
    expect(updatedProp.draft.props[1].label).toBe('주문자 이름');
    expect(canceled.mode).toBe('read');
    expect(canceled.draft).toBeNull();
  });

  it('keeps eventKey immutable and blocks dangerous prop fields until unlock', () => {
    const editing = createPublEventEditorDraft(DETAIL_FIXTURE);
    const eventKeyUpdated = publEventEditorReducer(editing, {
      field: 'eventKey',
      type: 'UPDATE_EVENT_FIELD',
      value: 'ORDER_RENAMED',
    });
    const rawPathBlocked = publEventEditorReducer(eventKeyUpdated, {
      field: 'rawPath',
      propKey: 'targetPhoneNumber',
      type: 'UPDATE_PROP_FIELD',
      value: 'payload.customer.phone',
    });
    const aliasBlocked = publEventEditorReducer(rawPathBlocked, {
      field: 'alias',
      propKey: 'targetPhoneNumber',
      type: 'UPDATE_PROP_FIELD',
      value: 'customerPhone',
    });
    const rawPathUnlocked = publEventEditorReducer(aliasBlocked, {
      propKey: 'targetPhoneNumber',
      type: 'UNLOCK_PROP_RAW_PATH',
    });
    const aliasUnlocked = publEventEditorReducer(rawPathUnlocked, {
      propKey: 'targetPhoneNumber',
      type: 'UNLOCK_PROP_ALIAS',
    });
    const rawPathChanged = publEventEditorReducer(aliasUnlocked, {
      field: 'rawPath',
      propKey: 'targetPhoneNumber',
      type: 'UPDATE_PROP_FIELD',
      value: 'payload.customer.phone',
    });
    const aliasChanged = publEventEditorReducer(rawPathChanged, {
      field: 'alias',
      propKey: 'targetPhoneNumber',
      type: 'UPDATE_PROP_FIELD',
      value: 'customerPhone',
    });

    expect(eventKeyUpdated.draft.event.eventKey).toBe('ORDER_CREATED');
    expect(rawPathBlocked.draft.props[0].rawPath).toBe('payload.phone');
    expect(aliasBlocked.draft.props[0].alias).toBe('targetPhoneNumber');
    expect(aliasChanged.draft.props[0]).toMatchObject({
      alias: 'customerPhone',
      rawPath: 'payload.customer.phone',
    });
  });

  it('supports add, edit, delete, usage, required, and format draft operations', () => {
    const editing = createPublEventEditorDraft(DETAIL_FIXTURE);
    const added = publEventEditorReducer(editing, {
      prop: {
        alias: 'orderNo',
        label: '주문 번호',
        rawPath: 'payload.orderNo',
        type: 'text',
      },
      type: 'ADD_PROP',
    });
    const usageUpdated = publEventEditorReducer(added, {
      enabled: false,
      propKey: 'orderNo',
      type: 'SET_PROP_ENABLED',
    });
    const requiredUpdated = publEventEditorReducer(usageUpdated, {
      propKey: 'orderNo',
      required: true,
      type: 'SET_PROP_REQUIRED',
    });
    const formatted = publEventEditorReducer(requiredUpdated, {
      propKey: 'orderNo',
      step: { type: 'dateFormat', format: 'yyyy년 M월 d일 HH:mm' },
      type: 'SET_PROP_FORMAT',
    });
    const deleted = publEventEditorReducer(formatted, {
      propKey: 'targetName',
      type: 'DELETE_PROP',
    });

    expect(formatted.draft.props.find((prop) => prop.alias === 'orderNo')).toMatchObject({
      enabled: false,
      originalAlias: null,
      parserPipeline: [{ type: 'dateFormat', format: 'yyyy년 M월 d일 HH:mm' }],
      required: true,
    });
    expect(deleted.draft.props.map((prop) => prop.alias)).toEqual(['targetPhoneNumber', 'orderNo']);
    expect(deleted.deletedAliases).toEqual(['targetName']);
  });

  it('tracks rawPath and alias unlock flags for dangerous existing-prop changes', () => {
    const aliasChanged = createDangerousChangeDraft();

    expect(aliasChanged.rawPathUnlockedAliases).toEqual(['targetPhoneNumber']);
    expect(aliasChanged.aliasUnlockedAliases).toEqual(['targetPhoneNumber']);
    expect(aliasChanged.draft.props[0]).toMatchObject({
      alias: 'customerPhone',
      rawPath: 'payload.customer.phone',
    });
  });

  it('serializes the exact PATCH payload shape with dangerous confirmations', () => {
    const payload = serializePublEventEditorPayload(createSerializedPayloadDraft());
    const propKeys = [
      'originalAlias',
      'alias',
      'label',
      'rawPath',
      'type',
      'required',
      'enabled',
      'fallback',
      'sample',
      'description',
      'parserPipeline',
    ];

    expect(Object.keys(payload)).toEqual([
      'baseUpdatedAt',
      'event',
      'props',
      'deletedAliases',
      'dangerousChangeConfirmations',
    ]);
    expect(payload.baseUpdatedAt).toBe('2026-06-26T12:00:00.000Z');
    expect(payload.event).toEqual({
      eventKey: 'ORDER_CREATED',
      displayName: 'Order created',
      locationType: 'P_APP',
      locationId: 'A00001',
      sourceType: 'channel',
      actionType: 'created',
    });
    expect(payload.props.map((prop) => Object.keys(prop))).toEqual([propKeys, propKeys]);
    expect(payload.props).toEqual([
      expect.objectContaining({
        alias: 'customerPhone',
        originalAlias: 'targetPhoneNumber',
        rawPath: 'payload.customer.phone',
        sample: '010-0000-0000',
      }),
      expect.objectContaining({
        alias: 'orderNo',
        fallback: null,
        originalAlias: null,
        parserPipeline: null,
        sample: null,
      }),
    ]);
    expect(payload.deletedAliases).toEqual([
      { originalAlias: 'targetName', confirmation: 'DELETE_PROP' },
    ]);
    expect(payload.dangerousChangeConfirmations).toEqual({
      rawPath: [
        {
          originalAlias: 'targetPhoneNumber',
          from: 'payload.phone',
          to: 'payload.customer.phone',
          confirmation: 'CHANGE_RAW_PATH',
        },
      ],
      alias: [
        {
          originalAlias: 'targetPhoneNumber',
          from: 'targetPhoneNumber',
          to: 'customerPhone',
          confirmation: 'CHANGE_ALIAS',
        },
      ],
    });
  });

  it('reports variable-key collision preflight issues before submit', () => {
    const editing = createPublEventEditorDraft(DETAIL_FIXTURE);
    const labelCollision = publEventEditorReducer(editing, {
      field: 'label',
      propKey: 'targetName',
      type: 'UPDATE_PROP_FIELD',
      value: '전화 번호',
    });
    const aliasCollision = publEventEditorReducer(labelCollision, {
      prop: {
        alias: '전화번호',
        label: '다른 변수',
        rawPath: 'payload.other',
        type: 'text',
      },
      type: 'ADD_PROP',
    });

    expect(getPublEventEditorPreflightIssues(aliasCollision)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'label_variable_key_collision' }),
        expect.objectContaining({ reason: 'alias_label_variable_key_collision' }),
      ])
    );
  });

  it('reports dangerous rawPath and alias changes when unlock state is missing', () => {
    const dangerousChangeState = createDangerousChangeDraft();
    const missingUnlockState = {
      ...dangerousChangeState,
      aliasUnlockedAliases: [],
      rawPathUnlockedAliases: [],
    };

    expect(getPublEventEditorPreflightIssues(missingUnlockState)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confirmation: 'CHANGE_RAW_PATH',
          from: 'payload.phone',
          originalAlias: 'targetPhoneNumber',
          reason: 'rawPath_unlock_required',
          to: 'payload.customer.phone',
        }),
        expect.objectContaining({
          confirmation: 'CHANGE_ALIAS',
          from: 'targetPhoneNumber',
          originalAlias: 'targetPhoneNumber',
          reason: 'alias_unlock_required',
          to: 'customerPhone',
        }),
      ])
    );
  });

  it('tracks save pending, save success, and save error states without side effects', () => {
    const editing = createPublEventEditorDraft(DETAIL_FIXTURE);
    const pending = publEventEditorReducer(editing, { type: 'SAVE_STARTED' });
    const failed = publEventEditorReducer(pending, {
      error: { code: 'LOCAL_VALIDATION_FAILED', message: 'Invalid draft' },
      type: 'SAVE_FAILED',
    });
    const succeeded = publEventEditorReducer(failed, {
      detail: { ...DETAIL_FIXTURE, updatedAt: '2026-06-26T12:30:00.000Z' },
      type: 'SAVE_SUCCEEDED',
    });

    expect(pending.save.status).toBe('pending');
    expect(failed.save).toMatchObject({
      status: 'error',
      error: { message: 'Invalid draft' },
    });
    expect(succeeded.save.status).toBe('success');
    expect(succeeded.baseUpdatedAt).toBe('2026-06-26T12:30:00.000Z');
    expect(isPublEventEditorDirty(succeeded)).toBe(false);
  });

  it('maps stale save failures to reload-oriented form errors', () => {
    const editing = createPublEventEditorDraft(DETAIL_FIXTURE);
    const failed = publEventEditorReducer(editing, {
      error: {
        code: 'LOCAL_VALIDATION_FAILED',
        message: 'PUBL event editor draft is stale.',
        retryable: false,
        source: 'relay',
        state: 'STALE_PUBL_EVENT_EDITOR_DRAFT',
        status: 409,
      },
      type: 'SAVE_FAILED',
    });

    expect(failed.save.error).toMatchObject({
      code: 'LOCAL_VALIDATION_FAILED',
      message: '다른 변경사항이 먼저 저장되었습니다. 최신 이벤트 정보를 다시 불러온 뒤 저장해 주세요.',
      retryable: false,
      source: 'relay',
      state: 'STALE_PUBL_EVENT_EDITOR_DRAFT',
      status: 409,
    });
  });
});
