'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  useToast,
} from '../../../components/ui/index.js';
import { PublOpenApiExampleDrawer } from '../automations/PublOpenApiExampleDrawer.jsx';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useCurrentActorQuery } from '../messageSend/queries.js';
import {
  normalizePublEventEditorMutationError,
  usePublEventDeleteMutation,
  usePublEventDetailQuery,
  usePublEventEditorMutation,
} from './queries.js';
import {
  PublEventDetailHeader,
  PublEventDetailSkeleton,
  PublEventDetailStatus,
  PublEventDetailSummary,
} from './PublEventDetailChrome.jsx';
import {
  PublEventEditorEventForm,
  PublEventEditorStatus,
  PublEventEmptyProps,
  PublEventVariableDeleteDialog,
  PublEventVariableDrawer,
  PublEventVariableEditorDrawer,
  PublEventVariablesSection,
} from './PublEventDetailSections.jsx';
import {
  getFilteredPublEventVariables,
  normalizePublEventDetail,
} from './publEventDetailModel.js';
import {
  createPublEventEditorReadState,
  getPublEventEditorPreflightIssues,
  isPublEventEditorDirty,
  normalizeEditorParserPipeline,
  publEventEditorReducer,
  serializePublEventEditorPayload,
} from './publEventEditorModel.js';

export function PublEventDetailPage({ eventKey }) {
  const navigation = useConsoleNavigation();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [searchValue, setSearchValue] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedAlias, setSelectedAlias] = useState('');
  const [editorState, dispatchEditor] = useReducer(
    publEventEditorReducer,
    undefined,
    createPublEventEditorReadState
  );
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openApiExampleOpen, setOpenApiExampleOpen] = useState(false);
  const [variableDrawer, setVariableDrawer] = useState(null);
  const [pendingAddVariable, setPendingAddVariable] = useState(null);
  const suppressEditParamOpenRef = useRef(false);
  const actorQuery = useCurrentActorQuery();
  const detailQuery = usePublEventDetailQuery(eventKey);
  const mutation = usePublEventEditorMutation();
  const deleteMutation = usePublEventDeleteMutation();
  const detail = useMemo(() => (
    detailQuery.data ? normalizePublEventDetail(detailQuery.data) : null
  ), [detailQuery.data]);
  const wantsEditMode = searchParams.get('editor') === 'edit';
  const canEdit = actorQuery.data?.user?.isOperator === true;
  const isEditing = canEdit && editorState.mode === 'edit' && Boolean(editorState.draft);
  const dirty = isPublEventEditorDirty(editorState);
  const editorDetail = useMemo(() => {
    if (!isEditing || !editorState.draft) return detail;

    return normalizePublEventDetail({
      ...editorState.draft.event,
      props: editorState.draft.props,
      updatedAt: editorState.baseUpdatedAt,
    });
  }, [detail, editorState, isEditing]);
  const filteredVariables = useMemo(() => (
    editorDetail
      ? getFilteredPublEventVariables({ detail: editorDetail, filter: activeFilter, query: searchValue })
      : []
  ), [activeFilter, editorDetail, searchValue]);
  const selectedVariable = useMemo(() => {
    if (!isEditing) {
      return detail?.props.find((prop) => prop.alias === selectedAlias) ?? null;
    }

    if (variableDrawer?.mode === 'add') {
      return pendingAddVariable;
    }

    return findEditorVariable(editorState.draft?.props, variableDrawer?.propKey);
  }, [detail, editorState.draft?.props, isEditing, pendingAddVariable, selectedAlias, variableDrawer?.mode, variableDrawer?.propKey]);
  const validation = useMemo(() => getEditorValidation(editorState), [editorState]);
  const displayedValidation = attemptedSave ? validation : EMPTY_VALIDATION;
  const isNotFound = detailQuery.error?.status === 404;
  const editDenied = wantsEditMode && actorQuery.data?.user && !canEdit;

  useEffect(() => {
    if (!wantsEditMode) {
      suppressEditParamOpenRef.current = false;
      return;
    }

    if (suppressEditParamOpenRef.current) return;
    if (!detail || !wantsEditMode || !canEdit || editorState.mode === 'edit') return;

    dispatchEditor({ detail, type: 'OPEN_EDIT_MODE' });
  }, [canEdit, detail, editorState.mode, wantsEditMode]);

  useEffect(() => {
    if (editorState.mode !== 'edit' || actorQuery.data?.user?.isOperator !== false) return;

    dispatchEditor({ type: 'CANCEL_EDIT_MODE' });
  }, [actorQuery.data?.user?.isOperator, editorState.mode]);

  function copyEventKey() {
    writeClipboard(eventKey).then(() => {
      showToast({ description: eventKey, title: '이벤트 key를 복사했습니다.', variant: 'success' });
    }).catch(() => {
      showToast({ description: eventKey, title: '이벤트 key를 복사하지 못했습니다.', variant: 'error' });
    });
  }

  function createAutomation() {
    navigation.push(`/automations/new?eventKey=${encodeURIComponent(String(eventKey ?? ''))}`);
  }

  function requestDeleteEvent() {
    if (!detail || !canEdit || isEditing) return;

    setDeleteConfirmationValue('');
    deleteMutation.reset();
    setDeleteDialogOpen(true);
  }

  function handleDeleteDialogOpen(nextOpen) {
    setDeleteDialogOpen(nextOpen);

    if (!nextOpen) {
      setDeleteConfirmationValue('');
      deleteMutation.reset();
    }
  }

  async function confirmDeleteEvent(event) {
    event.preventDefault();

    const normalizedEventKey = String(eventKey ?? '').trim();
    const confirmationEventKey = deleteConfirmationValue.trim();
    if (!normalizedEventKey || confirmationEventKey !== normalizedEventKey || deleteMutation.isPending) return;

    try {
      await deleteMutation.mutateAsync({
        eventKey: normalizedEventKey,
        payload: {
          confirmation: 'DELETE_EVENT',
          eventKey: confirmationEventKey,
        },
      });
      showToast({
        description: normalizedEventKey,
        title: 'PUBL 이벤트를 삭제했습니다.',
        variant: 'success',
      });
      navigation.push('/automations');
    } catch {
      // The dialog renders the mutation error inline.
    }
  }

  function getDetailHref(nextOptions = {}) {
    const params = new URLSearchParams();
    const encodedEventKey = encodeURIComponent(String(eventKey ?? ''));

    if (nextOptions.editor === 'edit') {
      params.set('editor', 'edit');
    }

    const query = params.toString();
    return `/automations/publ-events/${encodedEventKey}${query ? `?${query}` : ''}`;
  }

  function enterEditMode() {
    if (!detail || !canEdit) return;

    dispatchEditor({ detail, type: 'OPEN_EDIT_MODE' });
    setAttemptedSave(false);
    setSelectedAlias('');
    setPendingAddVariable(null);
    setVariableDrawer(null);
    navigation.push(getDetailHref({ editor: 'edit' }));
  }

  function requestVariableEdit(variable) {
    if (!variable) return;

    if (!isEditing) {
      if (!detail || !canEdit) {
        showUnavailableVariableActionToast('edit', variable);
        return;
      }

      dispatchEditor({ detail, type: 'OPEN_EDIT_MODE' });
      setAttemptedSave(false);
      setSelectedAlias('');
      setDeleteTarget(null);
      setPendingAddVariable(null);
      navigation.push(getDetailHref({ editor: 'edit' }));
    }

    setPendingAddVariable(null);
    setVariableDrawer({ mode: 'edit', propKey: getPropKey(variable) });
  }

  function cancelEditMode() {
    suppressEditParamOpenRef.current = true;
    dispatchEditor({ type: 'CANCEL_EDIT_MODE' });
    setAttemptedSave(false);
    setDeleteTarget(null);
    setPendingAddVariable(null);
    setSelectedAlias('');
    setVariableDrawer(null);
    navigation.replace(getDetailHref());
  }

  function requestCancelEditMode() {
    if (dirty) {
      setDiscardDialogOpen(true);
      return;
    }

    cancelEditMode();
  }

  async function reloadEditorDraft() {
    const result = await detailQuery.refetch();
    if (result.data) {
      dispatchEditor({ detail: result.data, type: 'OPEN_EDIT_MODE' });
      setAttemptedSave(false);
      setPendingAddVariable(null);
      setVariableDrawer(null);
    }
  }

  async function saveEditorDraft() {
    if (!isEditing || mutation.isPending) return;

    setAttemptedSave(true);

    if (validation.errors.length > 0 || validation.issues.length > 0) {
      showToast({
        description: '필수 항목과 변수 키 충돌을 확인해 주세요.',
        title: '저장 전 확인이 필요합니다',
        variant: 'error',
      });
      return;
    }

    dispatchEditor({ type: 'SAVE_STARTED' });

    try {
      const savedDetail = await mutation.mutateAsync({
        eventKey,
        payload: serializePublEventEditorPayload(editorState),
      });
      const normalizedDetail = normalizePublEventDetail(savedDetail);
      dispatchEditor({ detail: normalizedDetail, type: 'SAVE_SUCCEEDED' });
      setAttemptedSave(false);
      setPendingAddVariable(null);
      setVariableDrawer(null);
      showToast({
        description: normalizedDetail.eventKey,
        title: 'PUBL 이벤트 변경사항을 저장했습니다.',
        variant: 'success',
      });
      navigation.replace(getDetailHref({ editor: 'edit' }));
    } catch (error) {
      dispatchEditor({
        error: normalizePublEventEditorMutationError(error),
        type: 'SAVE_FAILED',
      });
    }
  }

  function handleEventFieldChange(field, value) {
    dispatchEditor({
      field,
      type: 'UPDATE_EVENT_FIELD',
      value,
    });
  }

  function handleVariableAction(action, variable) {
    if (isEditing) {
      if (action === 'toggle') {
        dispatchEditor({
          enabled: !variable.enabled,
          propKey: getPropKey(variable),
          type: 'SET_PROP_ENABLED',
        });
        return;
      }

      if (action === 'edit') {
        setPendingAddVariable(null);
        setVariableDrawer({ mode: 'edit', propKey: getPropKey(variable) });
        return;
      }

      if (action === 'delete') {
        setDeleteTarget(variable);
      }
      return;
    }

    if (!detail || !canEdit) {
      showUnavailableVariableActionToast(action, variable);
      return;
    }

    if (action === 'edit') {
      requestVariableEdit(variable);
      return;
    }

    dispatchEditor({ detail, type: 'OPEN_EDIT_MODE' });
    setAttemptedSave(false);
    setSelectedAlias('');
    setPendingAddVariable(null);
    setVariableDrawer(null);
    navigation.push(getDetailHref({ editor: 'edit' }));

    if (action === 'toggle') {
      dispatchEditor({
        enabled: !variable.enabled,
        propKey: getPropKey(variable),
        type: 'SET_PROP_ENABLED',
      });
      return;
    }

    if (action === 'delete') {
      setDeleteTarget(variable);
      return;
    }

    showUnavailableVariableActionToast(action, variable);
  }

  function showUnavailableVariableActionToast(action, variable) {
    const actionLabels = {
      delete: '삭제',
      edit: '편집',
      toggle: '사용 상태 변경',
    };
    const actionLabel = actionLabels[action] ?? '작업';
    const alias = variable?.alias || variable?.rawPath || '선택한 변수';

    showToast({
      description: `${alias} 변수는 운영자 권한이 있는 계정에서 편집할 수 있습니다.`,
      title: `변수 ${actionLabel} 권한이 필요합니다.`,
      variant: 'info',
    });
  }

  function addVariable() {
    const clientId = `new:${crypto.randomUUID()}`;

    setPendingAddVariable(createPendingVariableDraft(clientId, editorState.draft?.props.length ?? 0));
    setVariableDrawer({ mode: 'add', propKey: clientId });
    setAttemptedSave(false);
  }

  function updateVariableField(propKey, field, value) {
    if (isPendingAddVariable(pendingAddVariable, propKey, variableDrawer)) {
      setPendingAddVariable((current) => (
        isPendingAddVariable(current, propKey, variableDrawer)
          ? { ...current, [field]: value }
          : current
      ));
      return;
    }

    dispatchEditor({
      field,
      propKey,
      type: 'UPDATE_PROP_FIELD',
      value,
    });
  }

  function setVariableBoolean(propKey, field, value) {
    if (isPendingAddVariable(pendingAddVariable, propKey, variableDrawer)) {
      setPendingAddVariable((current) => (
        isPendingAddVariable(current, propKey, variableDrawer)
          ? { ...current, [field]: value }
          : current
      ));
      return;
    }

    dispatchEditor({
      propKey,
      [field]: value,
      type: field === 'required' ? 'SET_PROP_REQUIRED' : 'SET_PROP_ENABLED',
    });
  }

  function setVariableFormat(propKey, step) {
    if (isPendingAddVariable(pendingAddVariable, propKey, variableDrawer)) {
      setPendingAddVariable((current) => (
        isPendingAddVariable(current, propKey, variableDrawer)
          ? { ...current, parserPipeline: normalizeEditorParserPipeline(step) }
          : current
      ));
      return;
    }

    dispatchEditor({
      propKey,
      step,
      type: 'SET_PROP_FORMAT',
    });
  }

  function unlockVariableField(propKey, field) {
    if (isPendingAddVariable(pendingAddVariable, propKey, variableDrawer)) return;

    dispatchEditor({
      propKey,
      type: field === 'rawPath' ? 'UNLOCK_PROP_RAW_PATH' : 'UNLOCK_PROP_ALIAS',
    });
  }

  function closeVariableDrawer() {
    if (variableDrawer?.mode === 'add') {
      setPendingAddVariable(null);
    }

    setVariableDrawer(null);
  }

  function confirmAddVariable() {
    if (!isPendingAddVariable(pendingAddVariable, variableDrawer?.propKey, variableDrawer)) return;
    if (!canCommitPendingVariable(pendingAddVariable)) return;

    dispatchEditor({
      prop: pendingAddVariable,
      type: 'ADD_PROP',
    });
    setPendingAddVariable(null);
    setVariableDrawer(null);
    setAttemptedSave(false);
  }

  function confirmDeleteVariable() {
    if (!deleteTarget) return;

    dispatchEditor({
      propKey: getPropKey(deleteTarget),
      type: 'DELETE_PROP',
    });
    setDeleteTarget(null);
    if (variableDrawer?.propKey === getPropKey(deleteTarget)) {
      setVariableDrawer(null);
    }
  }

  return (
    <section className="page-frame publ-event-detail-page">
      <div className="publ-event-detail-content" aria-labelledby="publ-event-detail-title">
        <PublEventDetailHeader
          canEdit={canEdit}
          detail={editorDetail}
          eventKey={eventKey}
          isEditing={isEditing}
          onCancelEdit={requestCancelEditMode}
          onCopyEventKey={copyEventKey}
          onEnterEdit={enterEditMode}
          onRequestDelete={requestDeleteEvent}
          onOpenApiExample={() => setOpenApiExampleOpen(true)}
          onSave={saveEditorDraft}
          deleteDisabled={deleteMutation.isPending}
          saveDisabled={!dirty || mutation.isPending}
          saveLabel={mutation.isPending ? '저장 중' : '저장'}
        />
        <PublOpenApiExampleDrawer
          event={editorDetail}
          eventKey={eventKey}
          onOpenChange={setOpenApiExampleOpen}
          open={openApiExampleOpen}
        />
        {detailQuery.isPending ? <PublEventDetailSkeleton /> : null}
        {editDenied ? (
          <PublEventDetailStatus
            copy="PUBL 이벤트 편집은 운영자 권한이 있는 계정에서만 사용할 수 있습니다. 읽기 전용 상세는 계속 확인할 수 있습니다."
            title="운영자 권한이 필요합니다"
            tone="critical"
          />
        ) : null}
        {detailQuery.isError && isNotFound ? (
          <PublEventDetailStatus
            actionHref="/automations"
            actionLabel="PUBL 이벤트 목록으로 이동"
            copy="요청한 이벤트 정의를 찾을 수 없습니다. 목록에서 사용 가능한 PUBL 이벤트를 다시 선택해 주세요."
            title="PUBL 이벤트 정의를 찾을 수 없습니다"
            tone="critical"
          />
        ) : null}
        {detailQuery.isError && !isNotFound ? (
          <PublEventDetailStatus
            copy={getRelayErrorMessage(detailQuery.error, 'PUBL 이벤트 상세를 불러오지 못했습니다.')}
            onRetry={() => detailQuery.refetch()}
            title="PUBL 이벤트 상세를 불러오지 못했습니다"
            tone="critical"
          />
        ) : null}
        {editorDetail ? (
          <>
            {isEditing ? (
              <>
                <PublEventEditorEventForm
                  detail={editorDetail}
                  fieldErrors={displayedValidation.fieldErrors}
                  onFieldChange={handleEventFieldChange}
                  saveError={editorState.save.error}
                />
                <PublEventEditorStatus
                  dirty={dirty}
                  errors={displayedValidation.errors}
                  issues={displayedValidation.issues}
                  onReload={reloadEditorDraft}
                  saveError={editorState.save.error}
                  saveStatus={editorState.save.status}
                />
              </>
            ) : (
              <PublEventDetailSummary detail={editorDetail} />
            )}
            {!isEditing && editorDetail.props.length === 0 ? (
              <PublEventEmptyProps onCreateAutomation={createAutomation} />
            ) : (
              <>
                <PublEventVariablesSection
                  activeFilter={activeFilter}
                  detail={editorDetail}
                  filteredVariables={filteredVariables}
                  isEditing={isEditing}
                  onAddVariable={addVariable}
                  onFilterChange={setActiveFilter}
                  onSearchChange={setSearchValue}
                  onSelectVariable={setSelectedAlias}
                  onVariableAction={handleVariableAction}
                  searchValue={searchValue}
                  selectedAlias={selectedAlias}
                />
                {isEditing ? (
                  <>
                    <PublEventVariableEditorDrawer
                      addDisabled={variableDrawer?.mode === 'add' && !canCommitPendingVariable(pendingAddVariable)}
                      fieldErrors={displayedValidation.fieldErrors}
                      mode={variableDrawer?.mode ?? 'edit'}
                      onConfirmAdd={confirmAddVariable}
                      onFieldChange={updateVariableField}
                      onFormatChange={setVariableFormat}
                      onOpenChange={(open) => {
                        if (!open) closeVariableDrawer();
                      }}
                      onUnlockField={unlockVariableField}
                      onVariableBooleanChange={setVariableBoolean}
                      open={Boolean(selectedVariable)}
                      propKey={variableDrawer?.propKey}
                      rawPathUnlockedAliases={editorState.rawPathUnlockedAliases}
                      aliasUnlockedAliases={editorState.aliasUnlockedAliases}
                      variable={selectedVariable}
                    />
                    <PublEventVariableDeleteDialog
                      onConfirm={confirmDeleteVariable}
                      onOpenChange={(open) => {
                        if (!open) setDeleteTarget(null);
                      }}
                      open={Boolean(deleteTarget)}
                      variable={deleteTarget}
                    />
                  </>
                ) : (
                  <PublEventVariableDrawer
                    onOpenChange={(open) => {
                      if (!open) setSelectedAlias('');
                    }}
                    open={Boolean(selectedVariable)}
                    variable={selectedVariable}
                  />
                )}
              </>
            )}
          </>
        ) : null}
        <PublEventDiscardDialog
          onConfirm={cancelEditMode}
          onOpenChange={setDiscardDialogOpen}
          open={discardDialogOpen}
        />
        <PublEventDeleteDialog
          confirmationValue={deleteConfirmationValue}
          error={deleteMutation.error}
          eventKey={eventKey}
          onConfirmationChange={setDeleteConfirmationValue}
          onConfirm={confirmDeleteEvent}
          onOpenChange={handleDeleteDialogOpen}
          open={deleteDialogOpen}
          pending={deleteMutation.isPending}
        />
      </div>
    </section>
  );
}

const EMPTY_VALIDATION = Object.freeze({
  errors: [],
  fieldErrors: Object.freeze({}),
  issues: [],
});

function createPendingVariableDraft(clientId, sortOrder = 0) {
  return {
    alias: '',
    clientId,
    description: '',
    enabled: true,
    fallback: '',
    label: '',
    originalAlias: null,
    parserPipeline: null,
    rawPath: '',
    required: false,
    sample: '',
    sortOrder,
    type: 'text',
  };
}

function isPendingAddVariable(variable, propKey, variableDrawer) {
  return variableDrawer?.mode === 'add' && Boolean(propKey) && variable?.clientId === propKey;
}

function canCommitPendingVariable(variable) {
  return Boolean(
    String(variable?.alias ?? '').trim() &&
    String(variable?.label ?? '').trim() &&
    String(variable?.rawPath ?? '').trim() &&
    String(variable?.type ?? '').trim()
  );
}

function getPropKey(prop) {
  return prop?.clientId || prop?.originalAlias || prop?.alias || prop?.rawPath || '';
}

function findEditorVariable(props = [], propKey) {
  if (!propKey) return null;

  return props.find((prop) => (
    [prop.clientId, prop.originalAlias, prop.alias, prop.rawPath].includes(propKey)
  )) ?? null;
}

function getEditorValidation(state) {
  if (!state?.draft) return EMPTY_VALIDATION;

  const fieldErrors = {};
  const errors = [];

  if (!String(state.draft.event?.eventKey ?? '').trim()) {
    addFieldError(fieldErrors, errors, 'event.eventKey', 'eventKey는 필수입니다.');
  }

  state.draft.props.forEach((prop, index) => {
    const propKey = getPropKey(prop) || `prop-${index}`;
    const label = prop.label || prop.alias || `변수 ${index + 1}`;

    if (!String(prop.alias ?? '').trim()) {
      addFieldError(fieldErrors, errors, `prop.${propKey}.alias`, `${label} alias를 입력해 주세요.`);
    }

    if (!String(prop.label ?? '').trim()) {
      addFieldError(fieldErrors, errors, `prop.${propKey}.label`, `${label} 라벨을 입력해 주세요.`);
    }

    if (!String(prop.rawPath ?? '').trim()) {
      addFieldError(fieldErrors, errors, `prop.${propKey}.rawPath`, `${label} rawPath를 입력해 주세요.`);
    }

    if (!String(prop.type ?? '').trim()) {
      addFieldError(fieldErrors, errors, `prop.${propKey}.type`, `${label} 타입을 선택해 주세요.`);
    }
  });

  const issues = getPublEventEditorPreflightIssues(state)
    .filter((issue) => !String(issue.reason ?? '').endsWith('_unlock_required'));

  for (const issue of issues) {
    const message = getPreflightIssueMessage(issue);
    errors.push(message);
    markPreflightFieldError(fieldErrors, state.draft.props, issue, message);
  }

  return { errors, fieldErrors, issues };
}

function addFieldError(fieldErrors, errors, field, message) {
  fieldErrors[field] = fieldErrors[field] ?? message;
  errors.push(message);
}

function markPreflightFieldError(fieldErrors, props, issue, message) {
  const matchingProps = props.filter((prop) => (
    prop.alias === issue.alias ||
    getLabelVariableKeys(prop.label).includes(issue.key)
  ));

  for (const prop of matchingProps) {
    const propKey = getPropKey(prop);
    const field = issue.reason?.includes('label') && !issue.reason?.includes('alias_label')
      ? 'label'
      : 'alias';
    fieldErrors[`prop.${propKey}.${field}`] = fieldErrors[`prop.${propKey}.${field}`] ?? message;
  }
}

function getPreflightIssueMessage(issue) {
  if (issue.reason === 'duplicate_alias') {
    return `Alias "${issue.alias}"가 중복되었습니다.`;
  }

  if (issue.reason === 'label_variable_key_collision') {
    return `라벨 기반 변수 key "${issue.key}"가 중복되었습니다.`;
  }

  if (issue.reason === 'alias_label_variable_key_collision') {
    return `Alias "${issue.alias}"가 다른 라벨 기반 변수 key와 충돌합니다.`;
  }

  return '변수 key 충돌을 확인해 주세요.';
}

function getLabelVariableKeys(label) {
  const value = String(label ?? '').trim();
  const normalized = value.replace(/\s+/g, '');
  return normalized && normalized !== value ? [value, normalized] : [value].filter(Boolean);
}

function PublEventDeleteDialog({
  confirmationValue,
  error,
  eventKey,
  onConfirmationChange,
  onConfirm,
  onOpenChange,
  open,
  pending,
}) {
  const normalizedEventKey = String(eventKey ?? '');
  const canDelete = confirmationValue.trim() === normalizedEventKey && !pending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="publ-event-delete-dialog" size="large">
        <DialogHeader showClose={false}>
          <DialogTitle>이벤트 삭제</DialogTitle>
          <DialogDescription>
            이 PUBL 이벤트 정의와 변수 계약을 삭제합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onConfirm}>
          <DialogBody className="publ-event-delete-dialog-body">
            <p className="publ-event-delete-warning">
              연결된 자동화 또는 발송 이력이 있으면 삭제할 수 없습니다.
            </p>
            <FormField.Root className="publ-event-delete-confirm-field">
              <FormField.Label htmlFor="publ-event-delete-confirmation" required>
                eventKey 확인
              </FormField.Label>
              <FormField.Control>
                <FormField.Input
                  autoComplete="off"
                  id="publ-event-delete-confirmation"
                  onChange={(event) => onConfirmationChange(event.target.value)}
                  placeholder={normalizedEventKey}
                  value={confirmationValue}
                />
                <FormField.Help>
                  <code translate="no">{normalizedEventKey}</code> 를 정확히 입력해야 삭제할 수 있습니다.
                </FormField.Help>
              </FormField.Control>
            </FormField.Root>
            {error ? (
              <p className="publ-event-delete-error" role="alert">
                {getRelayErrorMessage(error, '이벤트를 삭제하지 못했습니다.')}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button disabled={!canDelete} type="submit" variant="danger">
              {pending ? '삭제 중' : '삭제'}
            </Button>
            <DialogClose asChild>
              <Button disabled={pending} type="button">
                취소
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PublEventDiscardDialog({ onConfirm, onOpenChange, open }) {
  return (
    <PublEventVariableDeleteDialog
      cancelLabel="계속 편집"
      confirmLabel="변경사항 버리기"
      description="저장하지 않은 PUBL 이벤트 편집 내용이 사라집니다. 최신 카탈로그 값은 변경되지 않습니다."
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title="변경사항을 버릴까요?"
    />
  );
}

async function writeClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(value ?? ''));
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = String(value ?? '');
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
