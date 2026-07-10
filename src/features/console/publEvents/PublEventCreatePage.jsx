'use client';

import { ArrowLeft, Check, Plus, Workflow } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  DataTableV2,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  useToast,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { ConsoleLink, useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { useCurrentActorQuery } from '../messageSend/queries.js';
import { getParserFormatLabel } from './publEventDetailModel.js';
import { usePublEventCreateMutation } from './queries.js';

const DEFAULT_CREATE_FORM = Object.freeze({
  eventKey: '',
  displayName: '',
  locationType: 'P_APP',
  locationId: '',
  sourceType: '',
  actionType: '',
});

const VARIABLE_TYPE_OPTIONS = Object.freeze([
  { label: 'Text', value: 'text' },
  { label: 'Number', value: 'number' },
  { label: 'Datetime', value: 'datetime' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Enum', value: 'enum' },
  { label: 'Object', value: 'object' },
  { label: 'Array', value: 'array' },
]);
const FORMAT_OPTIONS = Object.freeze([
  { label: '가공 없음', value: 'none' },
  { label: '중간 결과가 비면 대체값', value: 'fallback' },
  { label: '첫 번째 값만 사용', value: 'firstItem' },
  { label: '날짜 표시', value: 'dateFormat' },
  { label: '금액 표시', value: 'currencyFormat' },
  { label: '전화번호 표시', value: 'phoneFormat' },
  { label: '글자 수 자르기', value: 'truncate' },
  { label: '문구 바꾸기', value: 'replace' },
  { label: '항목 문구 만들기', value: 'mapTemplate' },
  { label: '여러 값을 합치기', value: 'join' },
]);
const DEFAULT_DATE_FORMAT = 'yyyy년 M월 d일 HH:mm';
const DEFAULT_TRUNCATE_LENGTH = 20;
const INITIAL_VARIABLE_ALIASES = new Set(['targetPhoneNumber', 'eventKey', 'channelCode']);
const VARIABLE_ALIAS_GROUP_LABELS = Object.freeze({
  direct: '직접 입력',
  variable: '자주 쓰는 변수',
});
const VARIABLE_ALIAS_GROUP_ORDER = Object.freeze(['variable', 'direct']);
const COMMON_VARIABLE_PRESETS = Object.freeze([
  {
    alias: 'targetPhoneNumber',
    description: '자동화 발송 수신자 번호입니다.',
    label: '수신자 전화번호',
    required: true,
    sample: '010-1234-1234',
  },
  {
    alias: 'eventKey',
    description: 'PUBL 이벤트를 식별하는 키입니다.',
    label: '이벤트 키',
    required: true,
  },
  {
    alias: 'channelCode',
    description: '발송 채널 매핑에 사용하는 코드입니다.',
    label: '채널 코드',
    required: true,
  },
  {
    alias: 'targetName',
    description: '수신자 개인화 문구에 자주 사용합니다.',
    label: '고객명',
    sample: '김민준',
  },
  {
    alias: 'messageTitle',
    description: '발송 메시지의 제목 또는 알림 제목입니다.',
    label: '메시지 제목',
    sample: '주문 안내',
  },
  {
    alias: 'orderNo',
    description: '주문, 예약, 결제 흐름에서 자주 쓰는 식별자입니다.',
    label: '주문번호',
    sample: 'ORD-24813',
  },
  {
    alias: 'productName',
    description: '상품명, 서비스명, 예약명 등에 사용합니다.',
    label: '상품명',
    sample: '프리미엄 플랜',
  },
  {
    alias: 'paymentAmount',
    description: '결제금액 또는 청구금액입니다.',
    label: '결제금액',
    sample: '49000',
    type: 'number',
  },
  {
    alias: 'eventOccurredAt',
    description: '이벤트가 실제로 발생한 시각입니다.',
    label: '발생 일시',
    parserPipeline: [{ type: 'dateFormat', format: 'yyyy년 M월 d일 HH:mm', timezone: 'Asia/Seoul' }],
    sample: '2026-06-29T13:00:00+09:00',
    type: 'datetime',
  },
  {
    alias: 'channelName',
    description: '카카오 채널명, 문자 발신 리소스명처럼 화면에 보여줄 채널 이름입니다.',
    label: '채널명',
    sample: '공식 알림 채널',
  },
  {
    alias: 'landingUrl',
    description: '메시지에서 이동시킬 상세 페이지 URL입니다.',
    label: '랜딩 URL',
    sample: 'https://example.com/orders/ORD-24813',
  },
]);

const EVENT_KEY_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const VARIABLE_ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function PublEventCreatePage() {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const actorQuery = useCurrentActorQuery();
  const createMutation = usePublEventCreateMutation();
  const [form, setForm] = useState(DEFAULT_CREATE_FORM);
  const [variables, setVariables] = useState(() => createInitialVariables());
  const [variableDialogOpen, setVariableDialogOpen] = useState(false);
  const [variableDialogMode, setVariableDialogMode] = useState('add');
  const [variableDraft, setVariableDraft] = useState(() => createEmptyVariableDraft());
  const [variableDraftError, setVariableDraftError] = useState('');
  const [variableDraftOriginalAlias, setVariableDraftOriginalAlias] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const validation = useMemo(() => validateCreateForm(form, variables), [form, variables]);
  const variableColumns = useMemo(() => getCreateVariableColumns(), []);
  const variableAliasOptions = useMemo(
    () => getVariableAliasOptions(variables),
    [variables]
  );
  const variableAliasManualOptionFactory = useMemo(
    () => (query) => createVariableAliasManualOption(query, variableAliasOptions),
    [variableAliasOptions]
  );
  const variableDraftFormatStep = useMemo(
    () => getEditableFormatStep(variableDraft.parserPipeline),
    [variableDraft.parserPipeline]
  );
  const variableDraftParserPreview = useMemo(
    () => createParserPreview(variableDraft.sample, variableDraftFormatStep),
    [variableDraft.sample, variableDraftFormatStep]
  );
  const variableDraftValidation = useMemo(
    () => validateVariableDraft(variableDraft, variables, variableDraftOriginalAlias),
    [variableDraft, variableDraftOriginalAlias, variables]
  );
  const canCreate = actorQuery.data?.user?.isOperator === true;
  const isLoadingActor = actorQuery.isLoading || actorQuery.isPending;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVariable(alias, patch) {
    setVariables((current) => current.map((variable) => (
      variable.alias === alias ? { ...variable, ...patch } : variable
    )));
  }

  function openVariableDialog() {
    setVariableDialogMode('add');
    setVariableDraft(createEmptyVariableDraft());
    setVariableDraftOriginalAlias('');
    setVariableDraftError('');
    setVariableDialogOpen(true);
  }

  function openVariableEditDialog(variable) {
    setVariableDialogMode('edit');
    setVariableDraft(createVariableDraft(variable, { source: variable.source ?? 'custom' }));
    setVariableDraftOriginalAlias(variable.alias);
    setVariableDraftError('');
    setVariableDialogOpen(true);
  }

  function updateVariableDraftField(field, value) {
    setVariableDraft((current) => ({ ...current, [field]: value }));
    setVariableDraftError('');
  }

  function updateVariableDraftAliasValue(value) {
    const alias = getSelectedVariableAlias(value);

    setVariableDraft((current) => {
      if (!alias) {
        return createEmptyVariableDraft();
      }

      const exactPreset = getAvailableVariablePresetByAlias(alias, variables);
      if (exactPreset) {
        return createVariableDraft(exactPreset, { source: 'preset' });
      }

      const previousAlias = current.alias;
      if (current.source === 'preset') {
        return {
          ...createEmptyVariableDraft(),
          alias,
          enabled: current.enabled,
          label: alias,
          rawPath: alias,
        };
      }

      const nextDraft = {
        ...current,
        alias,
        source: 'custom',
      };

      if (!current.label || current.label === previousAlias) {
        nextDraft.label = alias;
      }
      if (!current.rawPath || current.rawPath === previousAlias) {
        nextDraft.rawPath = alias;
      }

      return nextDraft;
    });
    setVariableDraftError('');
  }

  function updateVariableDraftFormat(nextStep) {
    setVariableDraft((current) => ({
      ...current,
      parserPipeline: nextStep.type === 'none' ? null : [nextStep],
    }));
    setVariableDraftError('');
  }

  function confirmVariableDraft() {
    if (variableDraftValidation.errors.length > 0) {
      setVariableDraftError(variableDraftValidation.errors[0]);
      return;
    }

    const nextVariable = normalizeVariableDraftForList(variableDraft);
    setVariables((current) => {
      if (variableDialogMode === 'edit') {
        return current.map((variable) => (
          variable.alias === variableDraftOriginalAlias ? nextVariable : variable
        ));
      }

      return [...current, nextVariable];
    });
    setVariableDialogOpen(false);
    setVariableDraft(createEmptyVariableDraft());
    setVariableDraftOriginalAlias('');
    setVariableDraftError('');
  }

  function removeVariable(alias) {
    setVariables((current) => current.filter((variable) => variable.alias !== alias));
  }

  function deleteVariableDraft() {
    if (variableDialogMode !== 'edit') return;

    removeVariable(variableDraftOriginalAlias);
    setVariableDialogOpen(false);
    setVariableDraft(createEmptyVariableDraft());
    setVariableDraftOriginalAlias('');
    setVariableDraftError('');
  }

  async function submit(event) {
    event.preventDefault();
    setAttemptedSubmit(true);

    if (!canCreate || validation.errors.length > 0 || createMutation.isPending) return;

    try {
      const detail = await createMutation.mutateAsync({
        event: {
          eventKey: form.eventKey.trim(),
          displayName: form.displayName.trim() || null,
          locationType: form.locationType.trim() || null,
          locationId: form.locationId.trim() || null,
          sourceType: form.sourceType.trim() || null,
          actionType: form.actionType.trim() || null,
        },
        props: variables.map((variable) => toCreateVariablePayload(variable, form.eventKey.trim())),
      });
      const createdEventKey = detail?.eventKey ?? form.eventKey.trim();

      showToast({
        description: createdEventKey,
        title: 'PUBL 이벤트를 생성했습니다.',
        variant: 'success',
      });
      navigation.push(`/automations/publ-events/${encodeURIComponent(createdEventKey)}?editor=edit`);
    } catch {
      // The inline status below reads the mutation error from TanStack Query.
    }
  }

  return (
    <section className="page-frame publ-event-detail-page publ-event-create-page">
      <div className="publ-event-detail-content" aria-labelledby="publ-event-create-title">
        <header className="publ-event-detail-header publ-event-create-header">
          <div className="publ-event-detail-status-icon" aria-hidden="true">
            <Workflow size={34} strokeWidth={1.7} />
          </div>
          <div className="publ-event-detail-title-block">
            <span className="publ-event-detail-context">PUBL Event</span>
            <h1 id="publ-event-create-title">이벤트 생성</h1>
            <code translate="no">{form.eventKey.trim() || 'eventKey'}</code>
          </div>
          <div className="publ-event-detail-actions">
            <ConsoleLink className="publ-event-secondary-button publ-event-detail-link-button" href="/automations">
              <ArrowLeft aria-hidden="true" size={15} />
              목록
            </ConsoleLink>
          </div>
        </header>

        {!isLoadingActor && !canCreate ? (
          <section className="publ-event-detail-status" data-tone="critical" role="alert">
            <div>
              <h2>운영자 권한이 필요합니다</h2>
              <p>PUBL 이벤트 생성은 운영자 계정에서만 사용할 수 있습니다.</p>
            </div>
          </section>
        ) : null}

        <form className="publ-event-create-layout" onSubmit={submit}>
          <section className="publ-event-create-panel" aria-labelledby="publ-event-create-basic-title">
            <div className="publ-event-create-panel-header">
              <h2 id="publ-event-create-basic-title">기본 정보</h2>
              <p>이벤트 식별자와 PUBL 위치 정보를 먼저 지정합니다.</p>
            </div>
            <div className="publ-event-create-grid">
              <FormField.Root className="publ-event-editor-field">
                <FormField.Label htmlFor="publ-event-create-event-key" required>eventKey</FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    autoComplete="off"
                    id="publ-event-create-event-key"
                    onChange={(event) => updateField('eventKey', event.target.value)}
                    placeholder="CUSTOM_MESSAGE_READY"
                    value={form.eventKey}
                  />
                </FormField.Control>
                {attemptedSubmit && validation.fieldErrors.eventKey ? (
                  <FormField.Error>{validation.fieldErrors.eventKey}</FormField.Error>
                ) : (
                  <FormField.Help>영문, 숫자, 밑줄, 마침표, 콜론, 하이픈만 사용합니다.</FormField.Help>
                )}
              </FormField.Root>

              <FormField.Root className="publ-event-editor-field">
                <FormField.Label htmlFor="publ-event-create-display-name">표시 이름</FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    id="publ-event-create-display-name"
                    onChange={(event) => updateField('displayName', event.target.value)}
                    placeholder="고객 메시지 준비"
                    value={form.displayName}
                  />
                </FormField.Control>
              </FormField.Root>

              <FormField.Root className="publ-event-editor-field">
                <FormField.Label htmlFor="publ-event-create-location-id">location</FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    autoComplete="off"
                    id="publ-event-create-location-id"
                    onChange={(event) => updateField('locationId', event.target.value)}
                    placeholder="X00004"
                    value={form.locationId}
                  />
                </FormField.Control>
              </FormField.Root>

              <FormField.Root className="publ-event-editor-field">
                <FormField.Label htmlFor="publ-event-create-location-type">locationType</FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    autoComplete="off"
                    id="publ-event-create-location-type"
                    onChange={(event) => updateField('locationType', event.target.value)}
                    placeholder="P_APP"
                    value={form.locationType}
                  />
                </FormField.Control>
              </FormField.Root>

              <FormField.Root className="publ-event-editor-field">
                <FormField.Label htmlFor="publ-event-create-source-type">sourceType</FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    autoComplete="off"
                    id="publ-event-create-source-type"
                    onChange={(event) => updateField('sourceType', event.target.value)}
                    placeholder="message"
                    value={form.sourceType}
                  />
                </FormField.Control>
              </FormField.Root>

              <FormField.Root className="publ-event-editor-field">
                <FormField.Label htmlFor="publ-event-create-action-type">actionType</FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    autoComplete="off"
                    id="publ-event-create-action-type"
                    onChange={(event) => updateField('actionType', event.target.value)}
                    placeholder="ready"
                    value={form.actionType}
                  />
                </FormField.Control>
              </FormField.Root>
            </div>
          </section>

          <section className="publ-event-create-panel" aria-labelledby="publ-event-create-vars-title">
            <div className="publ-event-create-panel-header publ-event-create-panel-header-row">
              <div>
                <h2 id="publ-event-create-vars-title">변수 계약</h2>
                <p>alias를 입력해 추천 변수를 채우거나 필요한 변수를 직접 추가합니다.</p>
              </div>
              <Button
                className="publ-event-secondary-button publ-event-create-variable-add-button"
                onClick={openVariableDialog}
                type="button"
              >
                <Plus aria-hidden="true" size={15} />
                변수 추가
              </Button>
            </div>

            <DataTableV2
              actionsClassName="is-publ-event-variable-actions"
              actionsHeaderClassName="is-publ-event-variable-actions"
              columns={variableColumns}
              data={variables}
              empty="추가된 변수가 없습니다."
              fixed
              getRowId={(row) => row.alias}
              getRowProps={({ row }) => ({
                'aria-label': `${row.label || row.alias || '새 변수'} 변수 수정`,
                className: 'publ-event-variable-row',
                onKeyDown: (event) => {
                  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) {
                    return;
                  }

                  event.preventDefault();
                  openVariableEditDialog(row);
                },
                role: 'button',
                tabIndex: 0,
              })}
              onRowClick={({ row }) => openVariableEditDialog(row)}
              rowActions={({ row }) => (
                <PublEventCreateVariableActions
                  onEdit={() => openVariableEditDialog(row)}
                />
              )}
              rootProps={{ 'aria-label': '생성할 PUBL 이벤트 변수 계약 테이블' }}
              shellClassName="automation-data-table-shell publ-event-variable-table-shell publ-event-create-variable-table-shell"
              tableClassName="automation-data-table publ-event-variable-table publ-event-create-variable-table"
            />

            {attemptedSubmit && validation.fieldErrors.variables ? (
              <p className="publ-event-create-variable-error" role="alert">
                {validation.fieldErrors.variables}
              </p>
            ) : null}
          </section>

          <Dialog open={variableDialogOpen} onOpenChange={setVariableDialogOpen}>
            <DialogContent className="publ-event-create-variable-dialog" size="large">
              <DialogHeader>
                <DialogTitle>{variableDialogMode === 'edit' ? '변수 수정' : '변수 추가'}</DialogTitle>
                <DialogDescription>
                  {variableDialogMode === 'edit'
                    ? '선택한 변수의 라벨, rawPath, type, parser를 조정합니다.'
                    : 'alias를 입력하면 자주 쓰는 변수를 추천합니다. 필요한 값은 직접 입력으로도 추가할 수 있습니다.'}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="publ-event-create-variable-dialog-body">
                <section className="publ-event-create-variable-draft" aria-labelledby="publ-event-create-draft-title">
                  <div className="publ-event-create-variable-dialog-section-header">
                    <h3 id="publ-event-create-draft-title">변수 설정</h3>
                    <p>
                      {variableDialogMode === 'edit'
                        ? 'alias는 생성 목록에서 고정됩니다. 필요한 값과 parser만 조정하세요.'
                        : 'alias를 먼저 입력하세요. 일치하는 추천을 선택하면 라벨, rawPath, parser가 같이 채워집니다.'}
                    </p>
                  </div>
                  <div className="publ-event-create-variable-draft-grid">
                    <FormField.Root className="publ-event-editor-field publ-event-create-variable-alias-field">
                      <FormField.Label htmlFor={variableDialogMode === 'edit' ? 'publ-event-variable-draft-alias' : undefined} required>
                        alias
                      </FormField.Label>
                      <FormField.Control>
                        {variableDialogMode === 'edit' ? (
                          <FormField.Input
                            disabled
                            id="publ-event-variable-draft-alias"
                            value={variableDraft.alias}
                          />
                        ) : (
                          <PublEventVariableAliasCombobox
                            ariaLabel="변수 alias 입력"
                            emptyNoResultsDescription="영문으로 시작하고 영문, 숫자, 밑줄만 사용할 수 있습니다."
                            emptyShortDescription="alias를 입력하면 직접 입력 또는 자주 쓰는 변수를 선택할 수 있습니다."
                            groupLabels={VARIABLE_ALIAS_GROUP_LABELS}
                            groupOrder={VARIABLE_ALIAS_GROUP_ORDER}
                            manualOptionFactory={variableAliasManualOptionFactory}
                            onValueChange={updateVariableDraftAliasValue}
                            options={variableAliasOptions}
                            placeholder="targetName"
                            value={getVariableAliasSelectValue(variableDraft)}
                          />
                        )}
                      </FormField.Control>
                    </FormField.Root>

                    <FormField.Root className="publ-event-editor-field">
                      <FormField.Label htmlFor="publ-event-variable-draft-type">Type</FormField.Label>
                      <FormField.Control>
                        <FormField.Select
                          id="publ-event-variable-draft-type"
                          onChange={(event) => updateVariableDraftField('type', event.target.value)}
                          value={variableDraft.type}
                        >
                          {VARIABLE_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </FormField.Select>
                      </FormField.Control>
                    </FormField.Root>

                    <FormField.Root className="publ-event-editor-field">
                      <FormField.Label htmlFor="publ-event-variable-draft-label" required>라벨</FormField.Label>
                      <FormField.Control>
                        <FormField.Input
                          autoComplete="off"
                          id="publ-event-variable-draft-label"
                          onChange={(event) => updateVariableDraftField('label', event.target.value)}
                          placeholder="고객명"
                          value={variableDraft.label}
                        />
                      </FormField.Control>
                    </FormField.Root>

                    <FormField.Root className="publ-event-editor-field">
                      <FormField.Label htmlFor="publ-event-variable-draft-raw-path" required>rawPath</FormField.Label>
                      <FormField.Control>
                        <FormField.Input
                          autoComplete="off"
                          id="publ-event-variable-draft-raw-path"
                          onChange={(event) => updateVariableDraftField('rawPath', event.target.value)}
                          placeholder="targetName"
                          value={variableDraft.rawPath}
                        />
                      </FormField.Control>
                    </FormField.Root>

                    <FormField.Root className="publ-event-editor-field">
                      <FormField.Label htmlFor="publ-event-variable-draft-sample">샘플</FormField.Label>
                      <FormField.Control>
                        <FormField.Input
                          id="publ-event-variable-draft-sample"
                          onChange={(event) => updateVariableDraftField('sample', event.target.value)}
                          placeholder="김민준"
                          value={variableDraft.sample}
                        />
                      </FormField.Control>
                    </FormField.Root>

                    <FormField.Root className="publ-event-editor-field">
                      <FormField.Label htmlFor="publ-event-variable-draft-description">설명</FormField.Label>
                      <FormField.Control>
                        <FormField.Input
                          id="publ-event-variable-draft-description"
                          onChange={(event) => updateVariableDraftField('description', event.target.value)}
                          placeholder="메시지 개인화에 사용하는 값"
                          value={variableDraft.description}
                        />
                      </FormField.Control>
                    </FormField.Root>

                    <FormField.Root className="publ-event-editor-field publ-event-create-variable-parser-select">
                      <FormField.Label htmlFor="publ-event-variable-draft-parser">Parser</FormField.Label>
                      <FormField.Control>
                        <FormField.Select
                          id="publ-event-variable-draft-parser"
                          onChange={(event) => updateVariableDraftFormat(
                            createFormatStep(event.target.value, variableDraftFormatStep)
                          )}
                          value={variableDraftFormatStep.type}
                        >
                          {FORMAT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </FormField.Select>
                      </FormField.Control>
                    </FormField.Root>
                  </div>

                  <PublEventCreateFormatFields
                    formatStep={variableDraftFormatStep}
                    onFormatFieldChange={(field, value) => updateVariableDraftFormat({
                      ...variableDraftFormatStep,
                      [field]: value,
                    })}
                  />

                  <PublEventCreateParserPreview preview={variableDraftParserPreview} />

                  <div className="publ-event-create-variable-dialog-flags">
                    <label>
                      <input
                        checked={variableDraft.required}
                        onChange={(event) => updateVariableDraftField('required', event.target.checked)}
                        type="checkbox"
                      />
                      필수
                    </label>
                    <label>
                      <input
                        checked={variableDraft.enabled}
                        onChange={(event) => updateVariableDraftField('enabled', event.target.checked)}
                        type="checkbox"
                      />
                      사용
                    </label>
                  </div>

                  {variableDraftError ? (
                    <p className="publ-event-create-variable-error" role="alert">{variableDraftError}</p>
                  ) : null}
                </section>
              </DialogBody>
              <DialogFooter>
                {variableDialogMode === 'edit' ? (
                  <Button
                    className="publ-event-create-variable-delete-button"
                    onClick={deleteVariableDraft}
                    type="button"
                    variant="danger"
                  >
                    삭제
                  </Button>
                ) : null}
                <Button
                  className="publ-event-secondary-button"
                  onClick={() => setVariableDialogOpen(false)}
                  type="button"
                >
                  {variableDialogMode === 'edit' ? '닫기' : '취소'}
                </Button>
                <Button
                  className="publ-event-primary-button"
                  onClick={confirmVariableDraft}
                  type="button"
                >
                  {variableDialogMode === 'edit'
                    ? <Check aria-hidden="true" size={15} />
                    : <Plus aria-hidden="true" size={15} />}
                  {variableDialogMode === 'edit' ? '변경' : '추가'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {createMutation.isError ? (
            <section className="publ-event-detail-status" data-tone="critical" role="alert">
              <div>
                <h2>이벤트를 생성하지 못했습니다</h2>
                <p>{getRelayErrorMessage(createMutation.error, '입력값을 확인한 뒤 다시 시도해 주세요.')}</p>
              </div>
            </section>
          ) : null}

          <div className="publ-event-create-actions">
            <ConsoleLink className="publ-event-secondary-button publ-event-detail-link-button" href="/automations">
              취소
            </ConsoleLink>
            <Button
              className="publ-event-primary-button"
              disabled={!canCreate || createMutation.isPending}
              type="submit"
            >
              <Plus aria-hidden="true" size={15} />
              {createMutation.isPending ? '생성 중' : '이벤트 생성'}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function createInitialVariables() {
  return COMMON_VARIABLE_PRESETS
    .filter((preset) => INITIAL_VARIABLE_ALIASES.has(preset.alias))
    .map((preset) => createVariableDraft(preset, { source: 'system' }));
}

function createVariableDraft(preset, { source = 'preset' } = {}) {
  return {
    alias: preset.alias,
    description: preset.description ?? '',
    enabled: preset.enabled ?? true,
    fallback: preset.fallback ?? '',
    label: preset.label ?? preset.alias,
    parserPipeline: preset.parserPipeline ?? null,
    rawPath: preset.rawPath ?? preset.alias,
    required: preset.required ?? false,
    sample: preset.sample ?? '',
    source,
    type: preset.type ?? 'text',
  };
}

function createEmptyVariableDraft() {
  return {
    alias: '',
    description: '',
    enabled: true,
    fallback: '',
    label: '',
    parserPipeline: null,
    rawPath: '',
    required: false,
    sample: '',
    source: 'custom',
    type: 'text',
  };
}

function getCreateVariableColumns() {
  return [
    {
      accessor: (row) => row.label,
      className: 'is-variable-label',
      header: '변수',
      cell: ({ row }) => <CreateVariableLabelCell variable={row} />,
    },
    {
      accessor: (row) => row.alias,
      className: 'is-variable-alias',
      header: 'Alias',
      cell: ({ value }) => <code className="publ-event-detail-mono">{value || ''}</code>,
    },
    {
      accessor: (row) => row.rawPath,
      className: 'is-variable-raw-path',
      header: 'rawPath',
      cell: ({ value }) => <code className="publ-event-detail-mono">{value || ''}</code>,
    },
    {
      accessor: (row) => row.type,
      className: 'is-variable-type',
      header: 'Type',
      cell: ({ value }) => value || '',
    },
    {
      accessor: (row) => row.sample,
      className: 'is-variable-sample',
      header: 'Sample',
      cell: ({ value }) => value ? <span title={value}>{value}</span> : '',
    },
    {
      accessor: (row) => row.enabled,
      className: 'is-variable-usage',
      header: '사용',
      cell: ({ row }) => <CreateVariableUsageText variable={row} />,
    },
    {
      accessor: (row) => getParserFormatLabel(row.parserPipeline),
      className: 'is-variable-parser',
      header: '포맷',
      cell: ({ value }) => (value ? <Badge>{value}</Badge> : ''),
    },
  ];
}

function CreateVariableLabelCell({ variable }) {
  return (
    <span className="publ-event-variable-label-cell">
      <span className="publ-event-variable-label-main">
        <span>{variable.label || variable.alias}</span>
        {variable.required ? (
          <>
            <span aria-hidden="true" className="publ-event-required-marker">*</span>
            <span className="publ-event-required-label">(필수)</span>
          </>
        ) : null}
      </span>
    </span>
  );
}

function CreateVariableUsageText({ variable }) {
  return (
    <span className="publ-event-create-variable-usage" data-enabled={variable.enabled ? 'true' : 'false'}>
      {variable.enabled ? '사용' : '미사용'}
    </span>
  );
}

function PublEventCreateVariableActions({ onEdit }) {
  return (
    <div className="publ-event-create-variable-table-actions" onClick={(event) => event.stopPropagation()}>
      <button
        className="publ-event-create-variable-table-action"
        onClick={onEdit}
        type="button"
      >
        상세
      </button>
    </div>
  );
}

function getAvailableVariablePresets(variables) {
  const selectedAliases = new Set(variables.map((variable) => variable.alias));

  return COMMON_VARIABLE_PRESETS.filter((preset) => !selectedAliases.has(preset.alias));
}

function getAvailableVariablePresetByAlias(value, variables) {
  const alias = normalizeVariableAliasInput(value);
  if (!alias) return null;

  return getAvailableVariablePresets(variables).find((preset) => preset.alias === alias) ?? null;
}

function getVariableAliasOptions(variables) {
  return getAvailableVariablePresets(variables).map((preset) => ({
    detail: preset.label,
    label: preset.alias,
    type: 'variable',
    value: preset.alias,
  }));
}

function createVariableAliasManualOption(query, options = []) {
  const alias = normalizeVariableAliasInput(query);
  if (!alias || !VARIABLE_ALIAS_PATTERN.test(alias)) return null;
  if (options.some((option) => option.value === alias)) return null;

  return {
    label: alias,
    type: 'manual',
    value: alias,
  };
}

function getSelectedVariableAlias(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return normalizeVariableAliasInput(value);
  }

  return normalizeVariableAliasInput(value.value ?? value.label);
}

function getVariableAliasSelectValue(draft) {
  const alias = normalizeVariableAliasInput(draft.alias);
  if (!alias) return '';

  return {
    detail: draft.source === 'preset' ? draft.label : '',
    label: alias,
    type: draft.source === 'preset' ? 'variable' : 'manual',
    value: alias,
  };
}

function PublEventVariableAliasCombobox({
  ariaLabel,
  emptyNoResultsDescription,
  emptyShortDescription,
  groupLabels,
  groupOrder,
  manualOptionFactory,
  onValueChange,
  options = [],
  placeholder,
  value,
}) {
  const baseId = useId();
  const selectedAlias = getSelectedVariableAlias(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedAlias);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = normalizeVariableAliasInput(query);
  const visibleOptions = useMemo(() => {
    const loweredQuery = normalizedQuery.toLowerCase();
    const matchedOptions = options.filter((option) => {
      if (!loweredQuery) return true;

      return [option.label, option.value, option.detail]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(loweredQuery));
    });
    const manualOption = manualOptionFactory?.(normalizedQuery);
    const combined = manualOption ? [...matchedOptions, manualOption] : matchedOptions;
    const seenValues = new Set();

    return combined.filter((option) => {
      if (seenValues.has(option.value)) return false;
      seenValues.add(option.value);
      return true;
    });
  }, [manualOptionFactory, normalizedQuery, options]);
  const groupedOptions = useMemo(() => (
    groupOrder
      .map((groupId) => ({
        groupId,
        options: visibleOptions
          .map((option, index) => ({ index, option }))
          .filter(({ option }) => getVariableAliasOptionGroup(option) === groupId),
      }))
      .filter((group) => group.options.length > 0)
  ), [groupOrder, visibleOptions]);
  const listboxId = `${baseId}-listbox`;
  const clampedActiveIndex = visibleOptions.length
    ? Math.min(activeIndex, visibleOptions.length - 1)
    : 0;
  const activeOptionId = visibleOptions[clampedActiveIndex]
    ? `${baseId}-option-${clampedActiveIndex}`
    : undefined;

  function commitOption(option) {
    if (!option) return;

    onValueChange?.(option);
    setQuery(option.value);
    setOpen(false);
    setActiveIndex(0);
  }

  function updateQuery(nextQuery) {
    setQuery(nextQuery);
    setOpen(true);
    setActiveIndex(0);
    onValueChange?.(nextQuery);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (
        visibleOptions.length ? (current + 1) % visibleOptions.length : 0
      ));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (
        visibleOptions.length ? (current - 1 + visibleOptions.length) % visibleOptions.length : 0
      ));
      return;
    }

    if (event.key === 'Enter' && open && visibleOptions[clampedActiveIndex]) {
      event.preventDefault();
      commitOption(visibleOptions[clampedActiveIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className="publ-event-variable-alias-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <input
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="publ-event-variable-alias-combobox-input"
        onChange={(event) => updateQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={query}
      />
      {open ? (
        <div className="publ-event-variable-alias-combobox-menu" id={listboxId} role="listbox">
          {groupedOptions.length ? (
            groupedOptions.map((group) => (
              <div className="publ-event-variable-alias-combobox-group" key={group.groupId}>
                <span>{groupLabels[group.groupId]}</span>
                {group.options.map(({ index, option }) => (
                  <button
                    aria-selected={index === clampedActiveIndex}
                    className="publ-event-variable-alias-combobox-option"
                    id={`${baseId}-option-${index}`}
                    key={`${option.type}-${option.value}`}
                    onClick={() => commitOption(option)}
                    onMouseDown={(event) => event.preventDefault()}
                    role="option"
                    type="button"
                  >
                    <code>{option.value}</code>
                    {option.detail ? <span>{option.detail}</span> : null}
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="publ-event-variable-alias-combobox-empty">
              {normalizedQuery ? emptyNoResultsDescription : emptyShortDescription}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function getVariableAliasOptionGroup(option) {
  return option.type === 'manual' ? 'direct' : option.type;
}

function normalizeVariableDraftForList(draft) {
  return {
    ...draft,
    alias: normalizeVariableAliasInput(draft.alias),
    description: draft.description.trim(),
    fallback: draft.fallback.trim(),
    label: draft.label.trim(),
    rawPath: draft.rawPath.trim(),
    sample: draft.sample.trim(),
    source: draft.source === 'preset' ? 'preset' : 'custom',
  };
}

function PublEventCreateFormatFields({ formatStep, onFormatFieldChange }) {
  if (['none', 'firstItem', 'phoneFormat'].includes(formatStep.type)) {
    return null;
  }

  if (formatStep.type === 'fallback') {
    return (
      <PublEventCreateParserTextField
        help="포맷 처리 중 값이 비어 있으면 사용할 값입니다."
        id="publ-event-create-variable-format-fallback"
        label="포맷 대체값"
        onChange={(value) => onFormatFieldChange('fallback', value)}
        value={formatStep.fallback ?? formatStep.value ?? formatStep.defaultValue ?? ''}
      />
    );
  }

  if (formatStep.type === 'dateFormat') {
    return (
      <div className="publ-event-format-fieldset publ-event-create-variable-parser-fields">
        <PublEventCreateParserTextField
          help="지원 형식: yyyy년 M월 d일 HH:mm"
          id="publ-event-create-variable-date-format"
          label="날짜 표시 형식"
          onChange={(value) => onFormatFieldChange('format', value)}
          value={formatStep.format ?? DEFAULT_DATE_FORMAT}
        />
        <PublEventCreateParserTextField
          id="publ-event-create-variable-date-timezone"
          label="시간대"
          onChange={(value) => onFormatFieldChange('timezone', value)}
          value={formatStep.timezone ?? 'Asia/Seoul'}
        />
      </div>
    );
  }

  if (formatStep.type === 'currencyFormat') {
    return (
      <div className="publ-event-format-fieldset publ-event-create-variable-parser-fields">
        <PublEventCreateParserTextField
          id="publ-event-create-variable-currency-locale"
          label="Locale"
          onChange={(value) => onFormatFieldChange('locale', value)}
          value={formatStep.locale ?? 'ko-KR'}
        />
        <PublEventCreateParserTextField
          id="publ-event-create-variable-currency"
          label="통화"
          onChange={(value) => onFormatFieldChange('currency', value)}
          value={formatStep.currency ?? 'KRW'}
        />
        <PublEventCreateParserTextField
          id="publ-event-create-variable-currency-path"
          label="통화 rawPath"
          onChange={(value) => onFormatFieldChange('currencyPath', value)}
          value={formatStep.currencyPath ?? ''}
        />
      </div>
    );
  }

  if (formatStep.type === 'truncate') {
    return (
      <PublEventCreateParserTextField
        help="지정한 글자 수 이후의 문자는 자릅니다."
        id="publ-event-create-variable-truncate-length"
        label="최대 글자 수"
        onChange={(value) => onFormatFieldChange('maxLength', value)}
        value={formatStep.maxLength ?? formatStep.length ?? DEFAULT_TRUNCATE_LENGTH}
      />
    );
  }

  if (formatStep.type === 'replace') {
    return (
      <div className="publ-event-format-fieldset publ-event-create-variable-parser-fields">
        <PublEventCreateParserTextField
          id="publ-event-create-variable-replace-from"
          label="찾을 문구"
          onChange={(value) => onFormatFieldChange('from', value)}
          value={formatStep.from ?? ''}
        />
        <PublEventCreateParserTextField
          id="publ-event-create-variable-replace-to"
          label="바꿀 문구"
          onChange={(value) => onFormatFieldChange('to', value)}
          value={formatStep.to ?? ''}
        />
      </div>
    );
  }

  if (formatStep.type === 'mapTemplate') {
    return (
      <PublEventCreateParserTextField
        help="배열 항목마다 적용할 문구입니다. 예: #{name} #{count}개 또는 {{name}}"
        id="publ-event-create-variable-map-template"
        label="항목 문구"
        onChange={(value) => onFormatFieldChange('template', value)}
        value={formatStep.template ?? ''}
      />
    );
  }

  if (formatStep.type === 'join') {
    return (
      <PublEventCreateParserTextField
        id="publ-event-create-variable-join-separator"
        label="합치기 구분자"
        onChange={(value) => onFormatFieldChange('separator', value)}
        value={formatStep.separator ?? ', '}
      />
    );
  }

  return null;
}

function PublEventCreateParserTextField({ help, id, label, onChange, value }) {
  return (
    <FormField.Root className="publ-event-editor-field publ-event-create-variable-parser-field">
      <FormField.Label htmlFor={id}>{label}</FormField.Label>
      <FormField.Control>
        <FormField.Input
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value ?? ''}
        />
        {help ? <FormField.Help>{help}</FormField.Help> : null}
      </FormField.Control>
    </FormField.Root>
  );
}

function PublEventCreateParserPreview({ preview }) {
  if (!preview) return null;

  return (
    <section className="publ-event-create-parser-preview" aria-label="Parser 미리보기">
      <div className="publ-event-create-parser-preview-header">
        <strong>Parser 미리보기</strong>
        <span>샘플 기준</span>
      </div>
      <div className="publ-event-create-parser-preview-flow">
        <div className="publ-event-create-parser-preview-value">
          <span>샘플</span>
          <code>{preview.input}</code>
        </div>
        <span className="publ-event-create-parser-preview-arrow" aria-hidden="true">-&gt;</span>
        <div className="publ-event-create-parser-preview-value">
          <span>파싱 후 결과</span>
          <code>{preview.output}</code>
        </div>
      </div>
    </section>
  );
}

function getEditableFormatStep(parserPipeline) {
  const step = Array.isArray(parserPipeline)
    ? parserPipeline.find((item) => item?.type && item.type !== 'none')
    : null;

  return step ? { ...step, type: step.type } : { type: 'none' };
}

function createFormatStep(type, currentStep = {}) {
  switch (type) {
    case 'fallback':
      return {
        type,
        fallback: currentStep.fallback ?? currentStep.value ?? currentStep.defaultValue ?? '',
      };
    case 'firstItem':
    case 'phoneFormat':
      return { type };
    case 'dateFormat':
      return {
        type,
        format: currentStep.format ?? DEFAULT_DATE_FORMAT,
        timezone: currentStep.timezone ?? 'Asia/Seoul',
      };
    case 'currencyFormat':
      return {
        type,
        currency: currentStep.currency ?? 'KRW',
        currencyPath: currentStep.currencyPath ?? '',
        locale: currentStep.locale ?? 'ko-KR',
      };
    case 'truncate':
      return {
        type,
        maxLength: currentStep.maxLength ?? currentStep.length ?? DEFAULT_TRUNCATE_LENGTH,
      };
    case 'replace':
      return {
        type,
        from: currentStep.from ?? '',
        to: currentStep.to ?? '',
      };
    case 'mapTemplate':
      return {
        type,
        template: currentStep.template ?? '',
      };
    case 'join':
      return {
        type,
        separator: currentStep.separator ?? ', ',
      };
    default:
      return { type: 'none' };
  }
}

function createParserPreview(sample, formatStep) {
  if (!formatStep || formatStep.type === 'none') return null;

  const parsedSample = parsePreviewSample(sample);
  const output = applyPreviewParserStep(parsedSample.value, formatStep, parsedSample.value);

  return {
    input: formatPreviewValue(parsedSample.value),
    output: formatPreviewValue(output),
  };
}

function parsePreviewSample(sample) {
  const text = String(sample ?? '');
  const trimmed = text.trim();

  if (!trimmed) {
    return { value: '' };
  }

  if (shouldParsePreviewSampleAsJson(trimmed)) {
    try {
      return { value: JSON.parse(trimmed) };
    } catch {
      return { value: text };
    }
  }

  return { value: text };
}

function shouldParsePreviewSampleAsJson(value) {
  return (
    (value.startsWith('{') && value.endsWith('}'))
    || (value.startsWith('[') && value.endsWith(']'))
    || value === 'true'
    || value === 'false'
    || value === 'null'
    || /^-?\d+(\.\d+)?$/.test(value)
  );
}

function applyPreviewParserStep(value, step, payload) {
  switch (step?.type) {
    case 'fallback':
      return getPreviewFallbackValue(value, step);
    case 'firstItem':
      return Array.isArray(value) ? value[0] : value;
    case 'dateFormat':
      return formatPreviewDateValue(value, step);
    case 'currencyFormat':
      return formatPreviewCurrencyValue(value, step, payload);
    case 'phoneFormat':
      return formatPreviewPhoneValue(value);
    case 'truncate':
      return truncatePreviewValue(value, step);
    case 'replace':
      return replacePreviewValue(value, step);
    case 'mapTemplate':
      return mapPreviewTemplateValue(value, step);
    case 'join':
      return joinPreviewValue(value, step);
    default:
      return value;
  }
}

function getPreviewFallbackValue(value, step) {
  if (!isMissingPreviewParserValue(value)) return value;

  return step?.value ?? step?.fallback ?? step?.defaultValue ?? value;
}

function formatPreviewDateValue(value, step) {
  if (value == null || value === '') return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const format = step?.format ?? DEFAULT_DATE_FORMAT;
  if (format !== DEFAULT_DATE_FORMAT) return value;

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: step?.timezone || 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${Number(byType.year)}년 ${Number(byType.month)}월 ${Number(byType.day)}일 ${byType.hour}:${byType.minute}`;
}

function formatPreviewCurrencyValue(value, step, payload) {
  if (value == null || value === '') return value;

  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return value;

  const currencyLookup = readPreviewDotPath(payload, step?.currencyPath);
  const currency = step?.currency || currencyLookup.value || 'KRW';
  const locale = step?.locale || 'ko-KR';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'KRW' ? 0 : undefined,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(locale).format(amount);
  }
}

function formatPreviewPhoneValue(value) {
  if (value == null || value === '') return value;

  const text = String(value).trim();
  const digits = text.replace(/\D/g, '');
  if (!digits) return value;

  const phoneDigits = digits.startsWith('82') && digits.length >= 11
    ? `0${digits.slice(2)}`
    : digits;

  if (phoneDigits.length === 11) {
    return `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 7)}-${phoneDigits.slice(7)}`;
  }

  if (phoneDigits.startsWith('02') && phoneDigits.length === 10) {
    return `${phoneDigits.slice(0, 2)}-${phoneDigits.slice(2, 6)}-${phoneDigits.slice(6)}`;
  }

  if (phoneDigits.startsWith('02') && phoneDigits.length === 9) {
    return `${phoneDigits.slice(0, 2)}-${phoneDigits.slice(2, 5)}-${phoneDigits.slice(5)}`;
  }

  if (phoneDigits.length === 10) {
    return `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;
  }

  if (phoneDigits.length === 8) {
    return `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`;
  }

  return text;
}

function truncatePreviewValue(value, step) {
  if (value == null || value === '') return value;

  const maxLength = Number(step?.maxLength ?? step?.length);
  if (!Number.isFinite(maxLength) || maxLength < 0) return value;

  return String(value).slice(0, maxLength);
}

function replacePreviewValue(value, step) {
  if (value == null) return value;

  const from = typeof step?.from === 'string' ? step.from : '';
  if (!from) return value;

  return String(value).split(from).join(step?.to == null ? '' : String(step.to));
}

function mapPreviewTemplateValue(value, step) {
  if (!Array.isArray(value)) return value;

  const template = typeof step?.template === 'string' ? step.template : '';

  return value.map((item) =>
    template.replace(/#\{([^}]+)\}|\{\{([^}]+)\}\}/g, (_, hashPath, bracePath) => {
      const fieldPath = hashPath ?? bracePath;
      const lookup = readPreviewDotPath(item, fieldPath.trim());
      return lookup.value == null ? '' : String(lookup.value);
    })
  );
}

function joinPreviewValue(value, step) {
  if (!Array.isArray(value)) return value;

  return value.join(typeof step?.separator === 'string' ? step.separator : '');
}

function readPreviewDotPath(source, path) {
  if (!path) return { found: false, value: undefined };

  const segments = String(path).split('.').filter(Boolean);
  let current = source;

  for (const segment of segments) {
    if (current == null || !Object.prototype.hasOwnProperty.call(Object(current), segment)) {
      return { found: false, value: undefined };
    }

    current = current[segment];
  }

  return { found: true, value: current };
}

function isMissingPreviewParserValue(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function formatPreviewValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (value === '') return '빈 값';
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function validateVariableDraft(draft, variables, originalAlias = '') {
  const errors = [];
  const alias = normalizeVariableAliasInput(draft.alias);

  if (!alias) {
    errors.push('alias를 입력해 주세요.');
  } else if (!VARIABLE_ALIAS_PATTERN.test(alias)) {
    errors.push('alias는 영문으로 시작하고 영문, 숫자, 밑줄만 사용할 수 있습니다.');
  } else if (variables.some((variable) => variable.alias === alias && variable.alias !== originalAlias)) {
    errors.push('이미 추가된 변수입니다.');
  }

  if (!draft.label.trim()) {
    errors.push('라벨을 입력해 주세요.');
  }

  if (!draft.rawPath.trim()) {
    errors.push('rawPath를 입력해 주세요.');
  }

  return { errors };
}

function normalizeVariableAliasInput(value) {
  return String(value ?? '').trim();
}

function toCreateVariablePayload(variable, eventKey) {
  const sample = normalizeOptionalPayloadText(variable.alias === 'eventKey' ? eventKey : variable.sample);

  return {
    alias: variable.alias.trim(),
    description: normalizeOptionalPayloadText(variable.description),
    enabled: variable.enabled === true,
    fallback: normalizeOptionalPayloadText(variable.fallback),
    label: variable.label.trim(),
    parserPipeline: variable.parserPipeline,
    rawPath: variable.rawPath.trim(),
    required: variable.required === true,
    sample,
    type: variable.type,
  };
}

function normalizeOptionalPayloadText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function validateCreateForm(form, variables) {
  const fieldErrors = {};
  const eventKey = form.eventKey.trim();

  if (!eventKey) {
    fieldErrors.eventKey = 'eventKey를 입력해 주세요.';
  } else if (!EVENT_KEY_PATTERN.test(eventKey)) {
    fieldErrors.eventKey = 'eventKey 형식을 확인해 주세요.';
  }

  const seenAliases = new Set();
  if (variables.length === 0) {
    fieldErrors.variables = '변수는 하나 이상 필요합니다.';
  }

  for (const variable of variables) {
    if (fieldErrors.variables) break;

    const alias = variable.alias.trim();
    if (!alias || !VARIABLE_ALIAS_PATTERN.test(alias)) {
      fieldErrors.variables = '변수 alias 형식을 확인해 주세요.';
      break;
    }

    if (seenAliases.has(alias)) {
      fieldErrors.variables = '중복된 변수 alias가 있습니다.';
      break;
    }
    seenAliases.add(alias);

    if (!variable.label.trim() || !variable.rawPath.trim()) {
      fieldErrors.variables = '변수 라벨과 rawPath를 모두 입력해 주세요.';
      break;
    }
  }

  return {
    errors: Object.values(fieldErrors),
    fieldErrors,
  };
}
