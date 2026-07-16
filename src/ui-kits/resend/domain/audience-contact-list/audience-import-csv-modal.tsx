import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileUp,
  Loader2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { showToast } from '../../feedback/toast';
import { Button } from '../../primitives/button';
import { Checkbox } from '../../primitives/checkbox';
import {
  AudienceContactCombobox,
  type AudienceContactComboboxOption,
} from './audience-contact-combobox';
import {
  AudienceContactModalShell,
  AudienceContactModalShortcut,
} from './audience-contact-modal-shell';
import {
  contactCsvStandardFields,
  getContactCsvFileError,
  getCustomPropertyKeyError,
  getTargetId,
  parseContactCsvFile,
} from './audience-contact-modal-utils';
import type {
  AudienceContactCsvColumn,
  AudienceContactCsvCustomProperty,
  AudienceContactCsvDestination,
  AudienceContactCsvParseResult,
  AudienceContactCsvPropertyTarget,
  AudienceContactCsvResolvedMapping,
  AudienceImportContactCsvPayload,
  AudienceSegment,
} from './types';

type CsvStep = 'mapping' | 'upload';
type CsvParseState = 'idle' | 'parsing' | 'ready';
type EditableCsvMapping = {
  readonly csvHeader: string;
  readonly id: string;
  readonly previewValue?: string;
  readonly suggestionPending: boolean;
  readonly target: AudienceContactCsvPropertyTarget | null;
  readonly included: boolean;
};

type AudienceImportCsvModalProps = {
  readonly canCreateSegment?: boolean | undefined;
  readonly customProperties?: readonly AudienceContactCsvCustomProperty[] | undefined;
  readonly onImportContactCsv?: ((payload: AudienceImportContactCsvPayload) => Promise<void> | void) | undefined;
  readonly onOpenChange: (open: boolean) => void;
  readonly onParseContactCsv?: ((file: File) => AudienceContactCsvParseResult | Promise<AudienceContactCsvParseResult>) | undefined;
  readonly open: boolean;
  readonly segments: readonly AudienceSegment[];
};

function toEditableMappings(columns: readonly AudienceContactCsvColumn[]): readonly EditableCsvMapping[] {
  return columns.map((column, index) => {
    const target = column.suggestedField
      ? { field: column.suggestedField, kind: 'standard' as const }
      : column.suggestedCustomPropertyKey
        ? { key: column.suggestedCustomPropertyKey, kind: 'custom' as const }
        : null;
    return {
      csvHeader: column.csvHeader,
      id: `csv-column-${index}-${column.csvHeader}`,
      included: target !== null,
      ...(column.previewValue === undefined ? {} : { previewValue: column.previewValue }),
      suggestionPending: column.suggestedField === undefined && column.suggestedCustomPropertyKey !== undefined,
      target,
    };
  });
}

function AudienceImportCsvModal({
  canCreateSegment = true,
  customProperties = [],
  onImportContactCsv,
  onOpenChange,
  onParseContactCsv,
  open,
  segments,
}: AudienceImportCsvModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parseRequestRef = useRef(0);
  const [step, setStep] = useState<CsvStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseState, setParseState] = useState<CsvParseState>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [destination, setDestination] = useState<AudienceContactCsvDestination>({ kind: 'all-contacts' });
  const [mappings, setMappings] = useState<readonly EditableCsvMapping[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const destinationOptions = useMemo<readonly AudienceContactComboboxOption[]>(() => [
    { id: 'destination:all', label: 'All contacts' },
    ...segments.map((segment) => ({ id: `destination:${segment.id}`, label: segment.name })),
  ], [segments]);
  const selectedDestinationId = destination.kind === 'all-contacts'
    ? 'destination:all'
    : destination.kind === 'existing'
      ? `destination:${destination.id}`
      : 'destination:create';
  const selectedDestinationLabel = destination.kind === 'all-contacts'
    ? 'All contacts'
    : destination.kind === 'existing'
      ? segments.find((segment) => segment.id === destination.id)?.name ?? 'Select a segment'
      : destination.name;

  const propertyTargets = useMemo(() => {
    const entries: Array<{ option: AudienceContactComboboxOption; target: AudienceContactCsvPropertyTarget }> = [
      ...contactCsvStandardFields.map((field) => {
        const target = { field, kind: 'standard' as const };
        return { option: { id: getTargetId(target), label: field }, target };
      }),
      ...customProperties.map((property) => {
        const target = { key: property.key, kind: 'custom' as const };
        return { option: { id: getTargetId(target), label: property.key }, target };
      }),
    ];
    return entries;
  }, [customProperties]);

  const includedCount = mappings.filter((mapping) => mapping.included).length;
  const allIncluded = mappings.length > 0 && includedCount === mappings.length;
  const someIncluded = includedCount > 0 && !allIncluded;
  const hasEmailMapping = mappings.some((mapping) => (
    mapping.included && mapping.target?.kind === 'standard' && mapping.target.field === 'email'
  ));
  const hasUnmappedIncluded = mappings.some((mapping) => mapping.included && mapping.target === null);
  const includedTargetIds = mappings.flatMap((mapping) => (
    mapping.included && mapping.target !== null ? [getTargetId(mapping.target)] : []
  ));
  const hasDuplicateMappings = new Set(includedTargetIds).size !== includedTargetIds.length;
  const importDisabled = importing || !hasEmailMapping || hasUnmappedIncluded || hasDuplicateMappings || file === null;

  function reset() {
    parseRequestRef.current += 1;
    setStep('upload');
    setFile(null);
    setParseState('idle');
    setDragActive(false);
    setDestination({ kind: 'all-contacts' });
    setMappings([]);
    setRowCount(0);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function chooseFile(nextFile: File) {
    const nextFileError = getContactCsvFileError(nextFile);
    if (nextFileError !== null) {
      parseRequestRef.current += 1;
      setFile(null);
      setMappings([]);
      setRowCount(0);
      setParseState('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast({ appearance: 'red', title: nextFileError });
      return;
    }

    const requestId = parseRequestRef.current + 1;
    parseRequestRef.current = requestId;
    setFile(nextFile);
    setParseState('parsing');
    try {
      const result = await (onParseContactCsv?.(nextFile) ?? parseContactCsvFile(nextFile));
      if (parseRequestRef.current !== requestId) return;
      setMappings(toEditableMappings(result.mappings));
      setRowCount(result.rowCount);
      setParseState('ready');
    } catch (caughtError) {
      if (parseRequestRef.current !== requestId) return;
      setFile(null);
      setMappings([]);
      setRowCount(0);
      setParseState('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast({
        appearance: 'red',
        title: caughtError instanceof Error ? caughtError.message : 'Failed to read CSV file.',
      });
    }
  }

  function handleFiles(files: readonly File[]) {
    if (files.length !== 1 || files[0] === undefined) {
      parseRequestRef.current += 1;
      setFile(null);
      setMappings([]);
      setRowCount(0);
      setParseState('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast({ appearance: 'red', title: 'Please upload a single .csv file.' });
      return;
    }
    void chooseFile(files[0]);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    handleFiles(Array.from(event.dataTransfer.files));
  }

  function updateMapping(mappingId: string, update: (mapping: EditableCsvMapping) => EditableCsvMapping) {
    setMappings((current) => current.map((mapping) => (
      mapping.id === mappingId ? update(mapping) : mapping
    )));
  }

  function selectDestination(option: AudienceContactComboboxOption) {
    if (option.id === 'destination:all') {
      setDestination({ kind: 'all-contacts' });
      return;
    }
    setDestination({ id: option.id.replace('destination:', ''), kind: 'existing' });
  }

  function selectProperty(mappingId: string, target: AudienceContactCsvPropertyTarget) {
    updateMapping(mappingId, (mapping) => ({
      ...mapping,
      included: true,
      suggestionPending: false,
      target,
    }));
  }

  async function submitImport() {
    if (importDisabled || file === null) return;
    const resolvedMappings: readonly AudienceContactCsvResolvedMapping[] = mappings.flatMap((mapping) => (
      mapping.included && mapping.target !== null
        ? [{ csvHeader: mapping.csvHeader, target: mapping.target }]
        : []
    ));

    setImporting(true);
    try {
      await onImportContactCsv?.({ destination, file, mappings: resolvedMappings, rowCount });
      showToast({ appearance: 'green', title: 'Contact import started' });
      handleOpenChange(false);
    } catch (caughtError) {
      showToast({
        appearance: 'red',
        title: caughtError instanceof Error ? caughtError.message : 'Failed to import contacts.',
      });
    } finally {
      setImporting(false);
    }
  }

  function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitImport();
  }

  function handleMappingKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();
    void submitImport();
  }

  return (
    <AudienceContactModalShell
      onOpenChange={handleOpenChange}
      open={open}
      size={step === 'mapping' ? 'mapping' : 'default'}
      title={step === 'mapping' ? 'Map properties' : 'Import contacts'}
    >
      {step === 'upload' ? (
        <div
          data-resend-audience-import-csv-upload
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey) || parseState !== 'ready') return;
            event.preventDefault();
            setStep('mapping');
          }}
        >
          <button
            aria-label="Choose your .CSV file"
            className="resend-ui-audience-contact-modal__dropzone"
            data-drag-active={dragActive ? '' : undefined}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            type="button"
          >
            <span className="resend-ui-audience-contact-modal__dropzone-icon">
              {parseState === 'ready'
                ? <CheckCircle2 aria-hidden="true" size={16} />
                : <FileUp aria-hidden="true" size={16} />}
            </span>
            {dragActive ? (
              <span>Release to upload your .CSV file</span>
            ) : file ? (
              <span className="resend-ui-audience-contact-modal__filename">{file.name}</span>
            ) : (
              <span>
                Drag and drop or click to<br />
                choose your <strong>.CSV</strong> file
              </span>
            )}
          </button>
          <input
            accept=".csv,text/csv"
            className="resend-ui-audience-contact-modal__file-input"
            hidden
            onChange={(event) => handleFiles(Array.from(event.currentTarget.files ?? []))}
            ref={fileInputRef}
            type="file"
          />
          <div className="resend-ui-audience-contact-modal__field resend-ui-audience-contact-modal__import-to">
            <span className="resend-ui-audience-contact-modal__label">Import to</span>
            <AudienceContactCombobox
              ariaLabel="Import to"
              createError={canCreateSegment ? undefined : () => 'Your plan includes 3 segments. Upgrade to add more.'}
              createLabel={(query) => <>Create segment <strong>{query}</strong></>}
              emptyLabel="No matching segments."
              onCreate={(name) => {
                if (canCreateSegment) setDestination({ kind: 'create', name });
              }}
              onSelect={selectDestination}
              options={destinationOptions}
              placeholder="Select a segment"
              selectedBadge={destination.kind === 'create' ? 'NEW' : undefined}
              selectedId={selectedDestinationId}
              selectedLabel={selectedDestinationLabel}
            />
          </div>
          <div className="resend-ui-audience-contact-modal__actions">
            <Button
              className="resend-ui-audience-contact-modal__action-with-shortcut"
              disabled={parseState !== 'ready'}
              onClick={() => setStep('mapping')}
              type="button"
              variant="accent"
            >
              {parseState === 'parsing' ? <Loader2 aria-hidden="true" className="resend-ui-audience-contact-modal__spinner" size={14} /> : null}
              <span>Next</span>
              <AudienceContactModalShortcut tokens={['CMD', 'ENTER']} />
            </Button>
            <Button
              className="resend-ui-audience-contact-modal__action-with-shortcut"
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              <span>Cancel</span>
              <AudienceContactModalShortcut tokens={['ESC']} />
            </Button>
          </div>
        </div>
      ) : (
        <form
          data-resend-audience-import-csv-mapping
          onKeyDown={handleMappingKeyDown}
          onSubmit={handleImportSubmit}
        >
          <p className="resend-ui-audience-contact-modal__mapping-description">
            We mapped your columns automatically and suggested matches for custom fields before import.
          </p>
          <div className="resend-ui-audience-contact-modal__mapping-scroll">
            <div className="resend-ui-audience-contact-modal__mapping-grid resend-ui-audience-contact-modal__mapping-header">
              <Checkbox
                aria-label="Import all columns"
                checked={someIncluded ? 'indeterminate' : allIncluded}
                onCheckedChange={(checked) => {
                  const included = checked === true;
                  setMappings((current) => current.map((mapping) => ({
                    ...mapping,
                    included,
                    target: included ? mapping.target : null,
                  })));
                }}
              />
              <strong>CSV field ({includedCount} of {mappings.length})</strong>
              <span aria-hidden="true" />
              <strong>Your data</strong>
              <span aria-hidden="true" />
              <strong>Resend property</strong>
            </div>
            <div className="resend-ui-audience-contact-modal__mapping-list">
              {mappings.length === 0 ? (
                <p className="resend-ui-audience-contact-modal__mapping-empty">
                  No columns detected in the uploaded file.
                </p>
              ) : null}
              {mappings.map((mapping) => {
                const usedTargetIds = new Set(mappings.flatMap((candidate) => (
                  candidate.id !== mapping.id && candidate.included && candidate.target !== null
                    ? [getTargetId(candidate.target)]
                    : []
                )));
                const propertyOptions = propertyTargets.map(({ option }) => ({
                  ...option,
                  disabled: usedTargetIds.has(option.id),
                }));
                const selectedTargetId = mapping.target === null ? undefined : getTargetId(mapping.target);
                const isNewCustom = mapping.target?.kind === 'custom'
                  && !customProperties.some((property) => (
                    mapping.target?.kind === 'custom' && property.key === mapping.target.key
                  ));
                const selectedPropertyLabel = mapping.target === null
                  ? undefined
                  : mapping.target.kind === 'standard' ? mapping.target.field : mapping.target.key;

                return (
                  <div
                    className="resend-ui-audience-contact-modal__mapping-grid resend-ui-audience-contact-modal__mapping-row"
                    key={mapping.id}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest('button, input, [role="combobox"]')) return;
                      updateMapping(mapping.id, (current) => ({
                        ...current,
                        included: !current.included,
                        target: current.included ? null : current.target,
                      }));
                    }}
                  >
                    <Checkbox
                      aria-label={`Import ${mapping.csvHeader}`}
                      checked={mapping.included}
                      onCheckedChange={(checked) => {
                        updateMapping(mapping.id, (current) => ({
                          ...current,
                          included: checked === true,
                          target: checked === true ? current.target : null,
                        }));
                      }}
                    />
                    <strong title={mapping.csvHeader}>{mapping.csvHeader}</strong>
                    <ArrowRight aria-hidden="true" size={14} />
                    <span className="resend-ui-audience-contact-modal__preview" title={mapping.previewValue}>
                      {mapping.previewValue ?? '—'}
                    </span>
                    <ArrowRight aria-hidden="true" size={14} />
                    <div className="resend-ui-audience-contact-modal__property-cell">
                      <div
                        className="resend-ui-audience-contact-modal__property-combobox"
                        data-ai-suggested={mapping.suggestionPending ? '' : undefined}
                      >
                        <AudienceContactCombobox
                          ariaLabel={`Resend property for ${mapping.csvHeader}`}
                          createError={getCustomPropertyKeyError}
                          createLabel={(query) => <>Create custom property <strong>{query}</strong></>}
                          emptyLabel="No matching properties."
                          invalid={mapping.included && mapping.target === null}
                          onCreate={(key) => selectProperty(mapping.id, { key, kind: 'custom' })}
                          onSelect={(option) => {
                            const entry = propertyTargets.find((candidate) => candidate.option.id === option.id);
                            if (entry) selectProperty(mapping.id, entry.target);
                          }}
                          options={propertyOptions}
                          placeholder="Select a property"
                          selectedBadge={(mapping.suggestionPending || isNewCustom) ? 'NEW' : undefined}
                          selectedId={selectedTargetId}
                          selectedLabel={selectedPropertyLabel}
                        />
                      </div>
                      {mapping.suggestionPending ? (
                        <span className="resend-ui-audience-contact-modal__suggestion-actions">
                          <button
                            aria-label="Confirm suggestion"
                            onClick={() => updateMapping(mapping.id, (current) => ({ ...current, suggestionPending: false }))}
                            type="button"
                          >
                            <Check aria-hidden="true" size={14} />
                          </button>
                          <button
                            aria-label="Reject suggestion"
                            onClick={() => updateMapping(mapping.id, (current) => ({
                              ...current,
                              included: false,
                              suggestionPending: false,
                              target: null,
                            }))}
                            type="button"
                          >
                            <X aria-hidden="true" size={14} />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="resend-ui-audience-contact-modal__actions">
            <span title={!hasEmailMapping ? 'Map a column to email to import contacts' : undefined}>
              <Button
                className="resend-ui-audience-contact-modal__action-with-shortcut"
                data-loading={importing ? '' : undefined}
                disabled={importDisabled}
                type="submit"
                variant="accent"
              >
                {importing ? <Loader2 aria-hidden="true" className="resend-ui-audience-contact-modal__spinner" size={14} /> : null}
                <span>Import {rowCount.toLocaleString()} {rowCount === 1 ? 'contact' : 'contacts'}</span>
                <AudienceContactModalShortcut tokens={['CMD', 'ENTER']} />
              </Button>
            </span>
            <Button
              className="resend-ui-audience-contact-modal__action-with-shortcut"
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              <span>Cancel</span>
              <AudienceContactModalShortcut tokens={['ESC']} />
            </Button>
          </div>
        </form>
      )}
    </AudienceContactModalShell>
  );
}

export { AudienceImportCsvModal };
