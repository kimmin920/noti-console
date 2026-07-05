'use client';

import { useId, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from './Button.jsx';
import { IconButton } from './IconButton.jsx';

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function getFileItemId(file, index) {
  return file.id ?? file.fileId ?? file.name ?? file.fileName ?? `file-${index}`;
}

function getFileName(file) {
  return file.fileName ?? file.name ?? 'Selected file';
}

function renderMetadata(metadata) {
  if (Array.isArray(metadata)) {
    return metadata.filter(Boolean).join(' / ');
  }

  return metadata;
}

export function FileUploadField({
  accept,
  actionLabel = 'Upload file',
  actionVariant = 'secondary',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className = '',
  disabled = false,
  emptyDescription,
  emptyLabel = 'No files selected',
  files = [],
  id,
  multiple = false,
  name,
  onFileChange,
  onRemoveFile,
  removeLabel = 'Remove file',
  ...props
}) {
  const generatedId = useId();
  const inputRef = useRef(null);
  const resolvedId = id ?? `file-upload-${generatedId}`;
  const hasFiles = files.length > 0;

  function handleUploadAction() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleFileChange(event) {
    onFileChange?.(event, Array.from(event.target.files ?? []));
  }

  return (
    <div
      className={classNames('file-upload-field', className)}
      data-disabled={disabled ? 'true' : 'false'}
      {...props}
    >
      <input
        accept={accept}
        aria-hidden="true"
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className="file-upload-input"
        disabled={disabled}
        hidden
        id={resolvedId}
        multiple={multiple}
        name={name}
        onChange={handleFileChange}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="file-upload-list">
        {files.map((file, index) => {
          const itemId = getFileItemId(file, index);
          const fileName = getFileName(file);
          const metadata = renderMetadata(file.metadata);
          const previewUrl = file.previewUrl;
          const removeActionLabel = file.removeLabel ?? `${removeLabel}: ${fileName}`;

          return (
            <span className="file-upload-tag" key={itemId}>
              {previewUrl ? (
                <span
                  aria-hidden={file.previewAlt ? undefined : 'true'}
                  aria-label={file.previewAlt || undefined}
                  className="file-upload-preview"
                  role={file.previewAlt ? 'img' : undefined}
                  style={{ backgroundImage: `url("${previewUrl}")` }}
                />
              ) : null}
              <span className="file-upload-file">
                <span className="file-upload-name" title={fileName}>{fileName}</span>
                {metadata ? <span className="file-upload-metadata">{metadata}</span> : null}
              </span>
              {onRemoveFile ? (
                <IconButton
                  className="file-upload-remove"
                  disabled={disabled || file.disabled}
                  icon={X}
                  label={removeActionLabel}
                  onClick={() => onRemoveFile(itemId)}
                />
              ) : null}
            </span>
          );
        })}

        {!hasFiles && (emptyLabel || emptyDescription) ? (
          <span className="file-upload-empty">
            {emptyLabel ? <span className="file-upload-empty-label">{emptyLabel}</span> : null}
            {emptyDescription ? (
              <span className="file-upload-empty-description">{emptyDescription}</span>
            ) : null}
          </span>
        ) : null}

        <Button
          aria-controls={resolvedId}
          className="file-upload-action"
          disabled={disabled}
          onClick={handleUploadAction}
          variant={actionVariant}
        >
          <Upload aria-hidden="true" size={14} />
          <span>{actionLabel}</span>
        </Button>
      </div>
    </div>
  );
}
