'use client';

import { useEffect, useState } from 'react';
import { Button, ImageCropDialog } from '@/components/ui/index.js';

function createSampleFile() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 1200;
  canvas.height = 760;

  if (!context) {
    return Promise.reject(new Error('샘플 이미지를 만들 수 없습니다.'));
  }

  context.fillStyle = '#e7eef5';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffd400';
  context.fillRect(96, 92, 280, 280);
  context.fillStyle = '#171717';
  context.font = '700 72px sans-serif';
  context.fillText('비주오', 142, 260);
  context.fillStyle = '#ffffff';
  context.fillRect(430, 122, 610, 360);
  context.fillStyle = '#2b2f33';
  context.font = '600 48px sans-serif';
  context.fillText('브랜드 이미지 샘플', 486, 250);
  context.fillStyle = '#6b7280';
  context.font = '400 28px sans-serif';
  context.fillText('크롭 영역과 비율을 조정해 확인합니다.', 486, 322);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('샘플 이미지를 만들 수 없습니다.'));
        return;
      }

      resolve(new File([blob], 'brand-sample.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.94);
  });
}

export default function ImageCropDialogPlaygroundPage() {
  const [file, setFile] = useState(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [resultUrl, setResultUrl] = useState('');

  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  async function openDialog() {
    const nextFile = file ?? await createSampleFile();
    setFile(nextFile);
    setOpen(true);
  }

  function handleApply(nextResult) {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResult(nextResult);
    setResultUrl(URL.createObjectURL(nextResult.file));
  }

  return (
    <main className="image-crop-playground">
      <section className="image-crop-playground-shell">
        <header className="image-crop-playground-header">
          <div>
            <p className="image-crop-playground-kicker">dev-only</p>
            <h1>ImageCropDialog</h1>
          </div>
          <Button onClick={openDialog} variant="primary">샘플 이미지 편집</Button>
        </header>

        <article className="image-crop-playground-stage">
          {resultUrl ? (
            <div className="file-upload-tag">
              <span
                aria-label="편집된 이미지"
                className="file-upload-preview"
                role="img"
                style={{ backgroundImage: `url("${resultUrl}")` }}
              />
              <span className="file-upload-file">
                <span className="file-upload-name">{result.file.name}</span>
                <span className="file-upload-metadata">
                  {result.width}x{result.height} / {Math.round(result.size / 1024)}KB
                </span>
              </span>
            </div>
          ) : (
            <p className="image-crop-dialog-requirement">버튼을 눌러 공통 크롭 다이얼로그를 엽니다.</p>
          )}
        </article>
      </section>

      <ImageCropDialog
        file={file}
        onApply={handleApply}
        onOpenChange={setOpen}
        open={open}
        preset="BRAND_CAROUSEL_IMAGE"
      />
    </main>
  );
}
