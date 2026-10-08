'use client';

import {
  LockKeyhole,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionMenuTrigger,
  Badge,
  Button,
  Checkbox,
  ConfirmationDialog,
  DataTableV2,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  FilterSelect,
  FormField,
  IconButton,
  SearchField,
} from '../../../components/ui/index.js';
import {
  PUBL_EVENT_VARIABLE_FILTERS,
  formatParserStep,
  getParserFormatLabel,
} from './publEventDetailModel.js';

const monoCell = ({ value }) => <code className="publ-event-detail-mono">{value || ''}</code>;
const EVENT_FIELD_CONFIG = Object.freeze([
  { field: 'eventKey', label: 'eventKey', locked: true },
  { field: 'displayName', label: '표시 이름' },
  { field: 'locationType', label: '위치 유형' },
  { field: 'locationId', label: '위치 ID' },
  { field: 'sourceType', label: '소스 유형' },
  { field: 'actionType', label: '액션 유형' },
]);
const PROP_TYPE_OPTIONS = Object.freeze([
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

export function PublEventVariablesSection({
  activeFilter,
  detail,
  filteredVariables,
  isEditing = false,
  onAddVariable,
  onFilterChange,
  onSearchChange,
  onSelectVariable,
  onVariableAction,
  searchValue,
  selectedAlias,
}) {
  const hasVariables = detail.props.length > 0;
  const emptyText = hasVariables
    ? '검색 조건에 맞는 변수가 없습니다.'
    : '이 이벤트에는 표시할 변수가 없습니다.';

  return (
    <section className="publ-event-variables-section" aria-labelledby="publ-event-variables-title">
      <div className="publ-event-variables-header">
        <div>
          <h2 id="publ-event-variables-title">변수 계약</h2>
        </div>
        {isEditing ? (
          <Button className="publ-event-secondary-button" onClick={onAddVariable}>
            <Plus aria-hidden="true" size={14} />
            변수 추가
          </Button>
        ) : null}
      </div>
      <div className="automation-rules-list-toolbar publ-event-variables-toolbar">
        <div className="automation-rules-list-toolbar-search">
          <SearchField
            aria-label="변수 검색"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="라벨, alias 검색"
            value={searchValue}
          />
        </div>
        <FilterSelect
          className="publ-event-variable-filter"
          label="변수"
          onValueChange={onFilterChange}
          options={PUBL_EVENT_VARIABLE_FILTERS}
          value={activeFilter}
        />
      </div>
      <DataTableV2
        actionsClassName="is-publ-event-variable-actions"
        actionsHeaderClassName="is-publ-event-variable-actions"
        columns={getVariableColumns({ onVariableAction })}
        data={filteredVariables}
        empty={emptyText}
        fixed
        getRowId={(row) => row.clientId || row.alias || row.rawPath}
        getRowProps={({ row }) => ({
          'aria-selected': selectedAlias === row.alias ? 'true' : undefined,
          'aria-label': isEditing
            ? `${row.label || row.alias || '새 변수'} 변수 편집`
            : `${row.label || row.alias} 변수 상세 보기`,
          className: 'publ-event-variable-row',
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) {
              return;
            }

            event.preventDefault();
            if (isEditing) {
              onVariableAction?.('edit', row);
            } else {
              onSelectVariable(row.alias);
            }
          },
          role: 'button',
          tabIndex: 0,
        })}
        onRowClick={({ row }) => {
          if (isEditing) {
            onVariableAction?.('edit', row);
          } else {
            onSelectVariable(row.alias);
          }
        }}
        rowActions={({ row }) => (
          <PublEventVariableActions
            onAction={(action) => onVariableAction?.(action, row)}
            variable={row}
          />
        )}
        rootProps={{ 'aria-label': 'PUBL 이벤트 변수 계약 테이블' }}
        shellClassName="automation-data-table-shell publ-event-variable-table-shell"
        tableClassName="automation-data-table publ-event-variable-table"
      />
    </section>
  );
}

function PublEventVariableActions({ onAction, variable }) {
  const label = variable.label || variable.alias || variable.rawPath;

  return (
    <div className="publ-event-variable-actions" onClick={(event) => event.stopPropagation()}>
      <ActionMenu>
        <ActionMenuTrigger asChild>
          <IconButton
            className="publ-event-variable-menu-trigger"
            icon={MoreHorizontal}
            label={`${label} 변수 작업 더보기`}
            onClick={(event) => event.stopPropagation()}
          />
        </ActionMenuTrigger>
        <ActionMenuContent align="end">
          <ActionMenuItem leadingVisual={<Pencil size={16} />} onSelect={() => onAction?.('edit')}>
            편집
          </ActionMenuItem>
          <ActionMenuSeparator />
          <ActionMenuItem leadingVisual={<Trash2 size={16} />} onSelect={() => onAction?.('delete')} variant="danger">
            삭제
          </ActionMenuItem>
        </ActionMenuContent>
      </ActionMenu>
    </div>
  );
}

export function PublEventVariableDrawer({ onOpenChange, open, variable }) {
  if (!variable) {
    return null;
  }

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent className="publ-event-variable-drawer" title="변수 상세">
        <DrawerHeader>
          <DrawerTitle>변수 상세</DrawerTitle>
          <DrawerDescription>{variable.alias || variable.rawPath}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <PublEventVariableDetails variable={variable} />
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

export function PublEventEditorEventForm({ detail, fieldErrors = {}, onFieldChange }) {
  return (
    <section className="publ-event-editor-panel" aria-labelledby="publ-event-editor-title">
      <div className="publ-event-editor-panel-header">
        <div>
          <h2 id="publ-event-editor-title">이벤트 메타데이터</h2>
          <p>기존 eventKey는 변경할 수 없습니다.</p>
        </div>
      </div>
      <div className="publ-event-editor-grid">
        {EVENT_FIELD_CONFIG.map((config) => {
          const fieldId = config.field === 'eventKey' ? 'eventKey' : `publ-event-${config.field}`;
          const error = fieldErrors[`event.${config.field}`];

          return (
            <FormField.Root className="publ-event-editor-field" key={config.field}>
              <FormField.Label error={error} htmlFor={fieldId}>
                {config.label}
              </FormField.Label>
              <FormField.Control>
                <FormField.Input
                  aria-invalid={error ? 'true' : undefined}
                  disabled={config.locked}
                  id={fieldId}
                  name={config.field}
                  onChange={(event) => onFieldChange?.(config.field, event.target.value)}
                  value={detail?.[config.field] ?? ''}
                />
                {error ? <FormField.Error>{error}</FormField.Error> : null}
              </FormField.Control>
            </FormField.Root>
          );
        })}
      </div>
    </section>
  );
}

export function PublEventEditorStatus({
  dirty,
  errors = [],
  issues = [],
  onReload,
  saveError,
  saveStatus,
}) {
  const isStale = saveError?.state === 'STALE_PUBL_EVENT_EDITOR_DRAFT';

  if (isStale) {
    return (
      <section className="publ-event-editor-notice" data-tone="critical" role="alert">
        <div>
          <strong>최신 이벤트 정보가 필요합니다</strong>
          <p>{saveError.message}</p>
        </div>
        <Button className="publ-event-secondary-button" onClick={onReload}>
          다시 불러오기
        </Button>
      </section>
    );
  }

  if (saveStatus === 'error' && saveError) {
    return (
      <section className="publ-event-editor-notice" data-tone="critical" role="alert">
        <div>
          <strong>저장하지 못했습니다</strong>
          <p>{saveError.message}</p>
        </div>
      </section>
    );
  }

  if (errors.length || issues.length) {
    return (
      <section className="publ-event-editor-notice" data-tone="critical" role="alert">
        <div>
          <strong>저장 전 확인이 필요합니다</strong>
          <ul>
            {Array.from(new Set(errors)).slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (saveStatus === 'pending') {
    return (
      <section className="publ-event-editor-notice" role="status">
        <div>
          <strong>저장 중입니다</strong>
          <p>중복 저장을 막기 위해 저장이 끝날 때까지 제출을 비활성화합니다.</p>
        </div>
      </section>
    );
  }

  if (dirty) {
    return (
      <section className="publ-event-editor-notice" role="status">
        <div>
          <strong>저장하지 않은 변경사항이 있습니다</strong>
          <p>상단의 저장 또는 취소 작업으로 편집을 마무리해 주세요.</p>
        </div>
      </section>
    );
  }

  return null;
}

export function PublEventVariableEditorDrawer({
  addDisabled = false,
  aliasUnlockedAliases = [],
  fieldErrors = {},
  mode = 'edit',
  onConfirmAdd,
  onFieldChange,
  onFormatChange,
  onOpenChange,
  onUnlockField,
  onVariableBooleanChange,
  open,
  propKey,
  rawPathUnlockedAliases = [],
  variable,
}) {
  if (!variable) {
    return null;
  }

  const aliasLocked = isExistingFieldLocked(variable, aliasUnlockedAliases);
  const rawPathLocked = isExistingFieldLocked(variable, rawPathUnlockedAliases);
  const formatStep = getEditableFormatStep(variable.parserPipeline);
  const formatType = formatStep.type;
  const title = mode === 'add' ? '변수 추가' : '변수 편집';
  const description = variable.alias || variable.rawPath || '새 변수';

  function updateField(field, value) {
    onFieldChange?.(propKey, field, value);
  }

  function updateFormat(nextStep) {
    onFormatChange?.(propKey, nextStep);
  }

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerContent className="publ-event-variable-drawer publ-event-variable-editor-drawer" title={title}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <section className="publ-event-variable-editor-form" aria-label="변수 편집 항목">
            <PublEventVariableTextField
              error={getPropFieldError(fieldErrors, propKey, 'alias')}
              help={aliasLocked ? '자동화와 템플릿에서 참조될 수 있어 잠겨 있습니다.' : '템플릿에서 사용할 변수 key입니다.'}
              id="publ-event-variable-alias"
              label="Alias"
              locked={aliasLocked}
              onChange={(value) => updateField('alias', value)}
              onUnlock={() => onUnlockField?.(propKey, 'alias')}
              required
              unlockLabel="Alias 잠금 해제"
              value={variable.alias}
            />
            <PublEventVariableTextField
              error={getPropFieldError(fieldErrors, propKey, 'label')}
              id="publ-event-variable-label"
              label="라벨"
              onChange={(value) => updateField('label', value)}
              required
              value={variable.label}
            />
            <PublEventVariableTextField
              error={getPropFieldError(fieldErrors, propKey, 'rawPath')}
              help={rawPathLocked ? '원본 payload 경로 변경은 런타임 해석에 영향을 줄 수 있어 잠겨 있습니다.' : 'PUBL payload에서 값을 읽을 경로입니다.'}
              id="publ-event-variable-rawPath"
              label="rawPath"
              locked={rawPathLocked}
              onChange={(value) => updateField('rawPath', value)}
              onUnlock={() => onUnlockField?.(propKey, 'rawPath')}
              required
              unlockLabel="rawPath 잠금 해제"
              value={variable.rawPath}
            />
            <FormField.Root className="publ-event-editor-field">
              <FormField.Label error={getPropFieldError(fieldErrors, propKey, 'type')} htmlFor="publ-event-variable-type" required requiredLabel="필수">
                Type
              </FormField.Label>
              <FormField.Control>
                <FormField.Select
                  aria-invalid={getPropFieldError(fieldErrors, propKey, 'type') ? 'true' : undefined}
                  id="publ-event-variable-type"
                  onChange={(event) => updateField('type', event.target.value)}
                  value={variable.type || 'text'}
                >
                  {PROP_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </FormField.Select>
                {getPropFieldError(fieldErrors, propKey, 'type') ? (
                  <FormField.Error>{getPropFieldError(fieldErrors, propKey, 'type')}</FormField.Error>
                ) : null}
              </FormField.Control>
            </FormField.Root>
            <div className="publ-event-variable-checkbox-grid">
              <Checkbox
                checked={variable.required}
                label="필수"
                onCheckedChange={(checked) => onVariableBooleanChange?.(propKey, 'required', checked)}
              />
              <Checkbox
                checked={variable.enabled}
                label="사용"
                onCheckedChange={(checked) => onVariableBooleanChange?.(propKey, 'enabled', checked)}
              />
            </div>
            <PublEventVariableTextField
              id="publ-event-variable-fallback"
              label="기본 대체값"
              onChange={(value) => updateField('fallback', value)}
              value={variable.fallback}
            />
            <PublEventVariableTextField
              id="publ-event-variable-sample"
              label="Sample"
              onChange={(value) => updateField('sample', value)}
              value={variable.sample}
            />
            <FormField.Root className="publ-event-editor-field">
              <FormField.Label htmlFor="publ-event-variable-description">설명</FormField.Label>
              <FormField.Control>
                <FormField.Textarea
                  id="publ-event-variable-description"
                  onChange={(event) => updateField('description', event.target.value)}
                  value={variable.description}
                />
              </FormField.Control>
            </FormField.Root>
            <FormField.Root className="publ-event-editor-field">
              <FormField.Label htmlFor="publ-event-variable-format">포맷</FormField.Label>
              <FormField.Control>
                <FormField.Select
                  id="publ-event-variable-format"
                  onChange={(event) => updateFormat(createFormatStep(event.target.value, formatStep))}
                  value={formatType}
                >
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </FormField.Select>
              </FormField.Control>
            </FormField.Root>
            <PublEventFormatFields
              formatStep={formatStep}
              onFormatFieldChange={(field, value) => updateFormat({ ...formatStep, [field]: value })}
            />
          </section>
        </DrawerBody>
        <DrawerFooter>
          <Button onClick={() => onOpenChange?.(false)}>
            {mode === 'add' ? '취소' : '닫기'}
          </Button>
          {mode === 'add' ? (
            <Button disabled={addDisabled} onClick={onConfirmAdd} variant="primary">
              추가
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function PublEventVariableTextField({
  error,
  help,
  id,
  label,
  locked = false,
  onChange,
  onUnlock,
  required = false,
  unlockLabel,
  value,
}) {
  const control = (
    <FormField.Input
      aria-invalid={error ? 'true' : undefined}
      disabled={locked}
      id={id}
      onChange={(event) => onChange?.(event.target.value)}
      value={value ?? ''}
    />
  );

  return (
    <FormField.Root
      action={locked ? (
        <PublEventUnlockButton label={unlockLabel} onUnlock={onUnlock} />
      ) : null}
      className="publ-event-editor-field"
    >
      <FormField.Label error={error} htmlFor={id} required={required} requiredLabel="필수">
        {label}
      </FormField.Label>
      <FormField.Control>
        {control}
        {help ? <FormField.Help>{help}</FormField.Help> : null}
        {error ? <FormField.Error>{error}</FormField.Error> : null}
      </FormField.Control>
    </FormField.Root>
  );
}

function PublEventUnlockButton({ label, onUnlock }) {
  return (
    <ConfirmationDialog
      cancelLabel="유지"
      confirmLabel="잠금 해제"
      description="이 값을 변경하면 기존 자동화나 템플릿 매핑에 영향이 생길 수 있습니다. 변경 의도를 확인한 뒤 저장 요청에 확인 토큰을 포함합니다."
      onConfirm={onUnlock}
      title={label}
    >
      <Button className="publ-event-unlock-button">
        <LockKeyhole aria-hidden="true" size={14} />
        잠금 해제
      </Button>
    </ConfirmationDialog>
  );
}

function PublEventFormatFields({ formatStep, onFormatFieldChange }) {
  if (['none', 'firstItem', 'phoneFormat'].includes(formatStep.type)) {
    return null;
  }

  if (formatStep.type === 'fallback') {
    return (
      <PublEventVariableTextField
        help="포맷 처리 중 값이 비어 있으면 사용할 값입니다."
        id="publ-event-variable-format-fallback"
        label="포맷 대체값"
        onChange={(value) => onFormatFieldChange('fallback', value)}
        value={formatStep.fallback ?? formatStep.value ?? formatStep.defaultValue ?? ''}
      />
    );
  }

  if (formatStep.type === 'dateFormat') {
    return (
      <div className="publ-event-format-fieldset">
        <PublEventVariableTextField
          help="지원 형식: yyyy년 M월 d일 HH:mm"
          id="publ-event-variable-date-format"
          label="날짜 표시 형식"
          onChange={(value) => onFormatFieldChange('format', value)}
          value={formatStep.format ?? DEFAULT_DATE_FORMAT}
        />
        <PublEventVariableTextField
          id="publ-event-variable-date-timezone"
          label="시간대"
          onChange={(value) => onFormatFieldChange('timezone', value)}
          value={formatStep.timezone ?? 'Asia/Seoul'}
        />
      </div>
    );
  }

  if (formatStep.type === 'currencyFormat') {
    return (
      <div className="publ-event-format-fieldset">
        <PublEventVariableTextField
          id="publ-event-variable-currency-locale"
          label="Locale"
          onChange={(value) => onFormatFieldChange('locale', value)}
          value={formatStep.locale ?? 'ko-KR'}
        />
        <PublEventVariableTextField
          id="publ-event-variable-currency"
          label="통화"
          onChange={(value) => onFormatFieldChange('currency', value)}
          value={formatStep.currency ?? 'KRW'}
        />
        <PublEventVariableTextField
          id="publ-event-variable-currency-path"
          label="통화 rawPath"
          onChange={(value) => onFormatFieldChange('currencyPath', value)}
          value={formatStep.currencyPath ?? ''}
        />
      </div>
    );
  }

  if (formatStep.type === 'truncate') {
    return (
      <PublEventVariableTextField
        help="지정한 글자 수 이후의 문자는 자릅니다."
        id="publ-event-variable-truncate-length"
        label="최대 글자 수"
        onChange={(value) => onFormatFieldChange('maxLength', value)}
        value={formatStep.maxLength ?? formatStep.length ?? DEFAULT_TRUNCATE_LENGTH}
      />
    );
  }

  if (formatStep.type === 'replace') {
    return (
      <div className="publ-event-format-fieldset">
        <PublEventVariableTextField
          id="publ-event-variable-replace-from"
          label="찾을 문구"
          onChange={(value) => onFormatFieldChange('from', value)}
          value={formatStep.from ?? ''}
        />
        <PublEventVariableTextField
          id="publ-event-variable-replace-to"
          label="바꿀 문구"
          onChange={(value) => onFormatFieldChange('to', value)}
          value={formatStep.to ?? ''}
        />
      </div>
    );
  }

  if (formatStep.type === 'mapTemplate') {
    return (
      <PublEventVariableTextField
        help="배열 항목마다 적용할 문구입니다. 예: #{name} #{count}개 또는 {{name}}"
        id="publ-event-variable-map-template"
        label="항목 문구"
        onChange={(value) => onFormatFieldChange('template', value)}
        value={formatStep.template ?? ''}
      />
    );
  }

  if (formatStep.type === 'join') {
    return (
      <PublEventVariableTextField
        id="publ-event-variable-join-separator"
        label="합치기 구분자"
        onChange={(value) => onFormatFieldChange('separator', value)}
        value={formatStep.separator ?? ', '}
      />
    );
  }

  return null;
}

export function PublEventVariableDeleteDialog({
  cancelLabel = '취소',
  confirmLabel = '삭제',
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  variable,
}) {
  const variableName = variable?.label || variable?.alias || variable?.rawPath || '선택한 변수';
  const resolvedTitle = title ?? '변수를 삭제할까요?';
  const resolvedDescription = description ?? `${variableName} 변수를 삭제합니다. 저장하기 전까지 서버에는 반영되지 않습니다.`;

  return (
    <ConfirmationDialog
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      description={resolvedDescription}
      destructive
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={resolvedTitle}
    />
  );
}

function PublEventVariableDetails({ variable }) {
  const parserSteps = variable.parserPipeline.map(formatParserStep);

  return (
    <section className="publ-event-variable-detail" aria-label="변수 속성">
      <div className="publ-event-variable-detail-heading">
        <ListFilter aria-hidden="true" size={16} />
        <span>계약 필드</span>
      </div>
      <div className="publ-event-variable-title">
        <span>{variable.label || variable.alias}</span>
        <code translate="no">{variable.alias}</code>
      </div>
      <dl className="publ-event-variable-definition-list">
        <Definition label="Type" value={variable.type} />
        <Definition label="Required" value={variable.required ? '필수' : '선택'} />
        <Definition label="사용" value={variable.enabled ? '사용' : '미사용'} />
        <Definition label="Fallback" value={variable.fallback} />
        <Definition label="Description" value={variable.description} />
      </dl>
      <div className="publ-event-parser-section">
        <h3>포맷</h3>
        {parserSteps.length ? (
          <ol>
            {parserSteps.map((step) => (
              <li key={`${step.type}-${step.label}-${step.detail}`}>
                <div>
                  <strong>{step.label}</strong>
                  {step.detail ? <code>{step.detail}</code> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>가공 없음</p>
        )}
      </div>
    </section>
  );
}

export function PublEventEmptyProps({ onCreateAutomation }) {
  return (
    <EmptyState
      action="자동화 생성"
      copy="이 이벤트는 현재 사용할 변수가 없지만 이벤트 key로 자동화 조건을 만들 수 있습니다."
      icon={ListFilter}
      onAction={onCreateAutomation}
      title="표시할 변수가 없습니다"
    />
  );
}

function getVariableColumns({ onVariableAction }) {
  return [
    {
      accessor: (row) => row.label,
      className: 'is-variable-label',
      header: '변수',
      cell: ({ row }) => <VariableLabelCell variable={row} />,
    },
    {
      accessor: (row) => row.alias,
      className: 'is-variable-alias',
      header: 'Alias',
      cell: monoCell,
    },
    {
      accessor: (row) => row.type,
      className: 'is-variable-type',
      header: 'Type',
      cell: ({ value }) => value || '',
    },
    {
      accessor: (row) => row.enabled,
      className: 'is-variable-usage',
      header: '사용',
      cell: ({ row }) => (
        <VariableUsageSwitch
          onToggle={(event) => {
            event.stopPropagation();
            onVariableAction?.('toggle', row);
          }}
          variable={row}
        />
      ),
    },
    {
      accessor: (row) => getParserFormatLabel(row.parserPipeline),
      className: 'is-variable-parser',
      header: '포맷',
      cell: ({ value }) => (value ? <Badge>{value}</Badge> : ''),
    },
  ];
}

function VariableLabelCell({ variable }) {
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

function VariableUsageSwitch({ onToggle, variable }) {
  const label = variable.label || variable.alias || variable.rawPath;

  return (
    <button
      aria-checked={variable.enabled ? 'true' : 'false'}
      aria-label={`${label} 변수 ${variable.enabled ? '사용' : '미사용'}`}
      className="publ-event-usage-switch"
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="publ-event-usage-switch-track">
        <span className="publ-event-usage-switch-thumb" />
      </span>
      <span>{variable.enabled ? '사용' : '미사용'}</span>
    </button>
  );
}

function Definition({ label, mono = false, value }) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'is-mono' : ''}>{value}</dd>
    </div>
  );
}

function getPropFieldError(fieldErrors, propKey, field) {
  return fieldErrors?.[`prop.${propKey}.${field}`] ?? '';
}

function isExistingFieldLocked(variable, unlockedAliases) {
  return Boolean(variable.originalAlias) && !unlockedAliases.includes(variable.originalAlias);
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
