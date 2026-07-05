'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import { RotateCcw } from 'lucide-react';
import { Button } from './Button.jsx';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog.jsx';
import { createCroppedImageFile, getImageCropPreset, validateImageCropOriginalFile } from './imageCropUtils.js';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

function getRequirementText(preset) {
  const items = [];

  if (preset.minWidth) items.push(`가로 ${preset.minWidth}px 이상`);
  if (preset.maxWidth && preset.maxHeight) items.push(`${preset.maxWidth}x${preset.maxHeight}px 이하`);
  if (preset.maxBytes) items.push(`${formatBytes(preset.maxBytes)} 이하`);
  if (preset.aspect) items.push(`${formatAspect(preset.aspect)} 비율`);

  return items.join(' · ');
}

function formatAspect(aspect) {
  if (aspect === 1) return '1:1';
  if (aspect === 2) return '2:1';
  if (Math.abs(aspect - 3 / 4) < 0.001) return '3:4';
  if (Math.abs(aspect - 4 / 3) < 0.001) return '4:3';
  return `${Math.round(aspect * 100) / 100}:1`;
}

function getInitialAspect(preset) {
  return Number.isFinite(preset.aspect) ? preset.aspect : preset.aspectOptions?.[0]?.value ?? 1;
}

export function ImageCropDialog({
  applyLabel = '적용',
  cancelLabel = '취소',
  description,
  file,
  onApply,
  onOpenChange,
  open,
  preset,
}) {
  const resolvedPreset = useMemo(() => getImageCropPreset(preset), [preset]);
  const editorKey = file
    ? `${file.name}:${file.size}:${file.lastModified}:${file.type}:${resolvedPreset.title}`
    : 'empty';
  const requirementText = getRequirementText({
    ...resolvedPreset,
    aspect: resolvedPreset.aspectOptions?.length ? null : getInitialAspect(resolvedPreset),
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="image-crop-dialog"
        data-brand-message-inspector-ignore="true"
        size="large"
      >
        <DialogHeader>
          <DialogTitle>{resolvedPreset.title}</DialogTitle>
          <DialogDescription>
            {description || requirementText || '이미지를 규격에 맞게 잘라 저장합니다.'}
          </DialogDescription>
        </DialogHeader>
        {file ? (
          <ImageCropDialogEditor
            applyLabel={applyLabel}
            cancelLabel={cancelLabel}
            file={file}
            key={editorKey}
            onApply={onApply}
            onOpenChange={onOpenChange}
            preset={resolvedPreset}
          />
        ) : (
          <ImageCropDialogEmpty cancelLabel={cancelLabel} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImageCropDialogEditor({
  applyLabel,
  cancelLabel,
  file,
  onApply,
  onOpenChange,
  preset,
}) {
  const [imageSrc, setImageSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(() => getInitialAspect(preset));
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requirementText = getRequirementText({ ...preset, aspect });
  const aspectOptions = preset.aspectOptions ?? [];

  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const nextImageSrc = String(reader.result ?? '');
      const image = new Image();

      image.addEventListener('load', () => {
        if (cancelled) {
          return;
        }

        try {
          validateImageCropOriginalFile({ file, image, preset });
          setImageSrc(nextImageSrc);
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : '이미지 규격을 확인해 주세요.');
        }
      });
      image.addEventListener('error', () => {
        if (!cancelled) {
          setError('이미지를 읽을 수 없습니다.');
        }
      });

      if (!cancelled) {
        image.src = nextImageSrc;
      }
    });
    reader.addEventListener('error', () => {
      if (!cancelled) {
        setError('이미지를 읽을 수 없습니다.');
      }
    });
    reader.readAsDataURL(file);

    return () => {
      cancelled = true;
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
      }
    };
  }, [file, preset]);

  const handleCropComplete = useCallback((_, nextCroppedAreaPixels) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  }, []);

  async function handleApply() {
    setError('');

    if (!file || !imageSrc || !croppedAreaPixels) {
      setError('이미지를 선택하고 편집 영역을 확인해 주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await createCroppedImageFile({
        crop: croppedAreaPixels,
        file,
        imageSrc,
        preset: { ...preset, aspect },
        rotation,
      });
      await onApply?.(result);
      onOpenChange?.(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '이미지를 편집할 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogBody className="image-crop-dialog-body">
        <div className="image-crop-dialog-frame">
          {imageSrc ? (
            <Cropper
              aspect={aspect}
              crop={crop}
              image={imageSrc}
              onCropChange={setCrop}
              onCropComplete={handleCropComplete}
              onRotationChange={setRotation}
              onZoomChange={setZoom}
              rotation={rotation}
              showGrid
              zoom={zoom}
            />
          ) : (
            <div className="image-crop-dialog-empty">이미지를 불러오는 중입니다.</div>
          )}
        </div>

        <div className="image-crop-dialog-controls">
          {aspectOptions.length ? (
            <div className="image-crop-dialog-aspects" aria-label="이미지 비율">
              {aspectOptions.map((option) => (
                <button
                  aria-pressed={aspect === option.value}
                  className="image-crop-dialog-aspect"
                  key={option.label}
                  onClick={() => setAspect(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          <label className="image-crop-dialog-control">
            <span>확대</span>
            <input
              max="3"
              min="1"
              onChange={(event) => setZoom(Number(event.target.value))}
              step="0.01"
              type="range"
              value={zoom}
            />
          </label>

          <label className="image-crop-dialog-control">
            <span>회전</span>
            <input
              max="180"
              min="-180"
              onChange={(event) => setRotation(Number(event.target.value))}
              step="1"
              type="range"
              value={rotation}
            />
          </label>

          <Button className="image-crop-dialog-reset" onClick={() => {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setRotation(0);
          }}>
            <RotateCcw aria-hidden="true" size={14} />
            초기화
          </Button>
        </div>

        {error ? <p className="image-crop-dialog-error">{error}</p> : null}
        {requirementText ? <p className="image-crop-dialog-requirement">{requirementText}</p> : null}
      </DialogBody>
      <DialogFooter>
        <Button disabled={submitting} onClick={() => onOpenChange?.(false)}>
          {cancelLabel}
        </Button>
        <Button disabled={submitting || !file || !imageSrc} onClick={handleApply} variant="primary">
          {submitting ? '처리 중' : applyLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

function ImageCropDialogEmpty({ cancelLabel, onOpenChange }) {
  return (
    <>
      <DialogBody className="image-crop-dialog-body">
        <div className="image-crop-dialog-frame">
          <div className="image-crop-dialog-empty">이미지를 선택해 주세요.</div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => onOpenChange?.(false)}>{cancelLabel}</Button>
      </DialogFooter>
    </>
  );
}
