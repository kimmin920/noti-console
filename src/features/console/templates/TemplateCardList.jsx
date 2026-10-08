'use client';

/* eslint-disable @next/next/no-img-element -- NHN template image URLs can come from provider-hosted domains. */
import { useState } from 'react';
import { Copy, Ellipsis, Eye, ImageOff, Pencil, Sparkles, SquarePen, Trash2 } from 'lucide-react';
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionMenuTrigger,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  IconButton,
  TextField,
} from '../../../components/ui/index.js';
import { BrandMessageTemplateCardPreview } from '../../../components/ui/BrandMessageTemplateCardPreview.jsx';
import {
  brandTemplateTypeLabels,
  getBrandTemplateType,
} from '../../../components/ui/brandMessageTemplateCardPreviewData.js';
import { KakaoTemplateCardPreview } from '../../../components/ui/KakaoTemplateCardPreview.jsx';
import { SmsTemplateCardPreview } from '../../../components/ui/SmsTemplateCardPreview.jsx';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { buildTemplateDetailHref } from './templateDetailModel.js';

const skeletonCards = Array.from({ length: 6 }, (_, index) => index);
const SMS_TEMPLATE_TAB = 'SMS';
const ALIMTALK_TEMPLATE_TAB = '알림톡';
const BRAND_MESSAGE_TEMPLATE_TAB = '브랜드 메시지';

export function TemplateCardList({
  activeTab,
  emptyCopy,
  emptyTitle,
  isLoading = false,
  senderResourceId = '',
  templates,
}) {
  if (isLoading) {
    return <TemplateCardSkeletonGrid activeTab={activeTab} />;
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        copy={emptyCopy}
        icon={Sparkles}
        title={emptyTitle}
      />
    );
  }

  return (
    <div className="template-card-grid">
      {templates.map((template, index) => (
        <TemplateCard
          activeTab={activeTab}
          key={template.id}
          eager={index < 3}
          senderResourceId={senderResourceId}
          template={template}
        />
      ))}
    </div>
  );
}

function TemplateCardSkeletonGrid({ activeTab }) {
  const isSmsPreview = isSmsTemplatePreview(activeTab, {});

  return (
    <div
      aria-busy="true"
      aria-label="템플릿을 불러오는 중입니다"
      className="template-card-grid template-card-skeleton-grid"
      role="status"
    >
      {skeletonCards.map((item) => (
        <TemplateCardSkeleton isSmsPreview={isSmsPreview} key={item} />
      ))}
    </div>
  );
}

function TemplateCardSkeleton({ isSmsPreview }) {
  return (
    <article aria-hidden="true" className="template-card template-card-skeleton">
      <div className={['template-card-preview-frame', isSmsPreview && 'template-card-preview-frame--sms', 'template-card-skeleton-preview'].filter(Boolean).join(' ')}>
        <span className="template-skeleton-block template-skeleton-preview-window" />
      </div>
      <div className="template-card-content">
        <div className="template-card-header">
          <div className="template-card-copy">
            <span className="template-skeleton-block template-skeleton-title" />
            <span className="template-card-alias-row">
              <span className="template-skeleton-block template-skeleton-code" />
              <span className="template-skeleton-block template-skeleton-meta" />
            </span>
          </div>
          <span className="template-skeleton-block template-skeleton-status" />
        </div>
      </div>
    </article>
  );
}

function TemplateCard({ activeTab, eager, senderResourceId, template }) {
  const navigation = useConsoleNavigation();
  const isSmsPreview = isSmsTemplatePreview(activeTab, template);
  const isBrandPreview = isBrandMessageTemplatePreview(activeTab, template);
  const brandTypeLabel = getBrandTemplateCardTypeLabel(activeTab, template);
  const detailHref = buildTemplateDetailHref({ activeTab, senderResourceId, template });

  return (
    <article className="template-card">
      <div className={['template-card-preview-frame', isSmsPreview && 'template-card-preview-frame--sms'].filter(Boolean).join(' ')}>
        <TemplateCardMenu detailHref={detailHref} template={template} />
        {isBrandPreview ? (
          <div className="template-card-preview-surface">
            <BrandMessageTemplateCardPreview template={template} />
          </div>
        ) : isSmsPreview ? (
          <a
            className="template-card-preview-link template-card-preview-link--sms"
            draggable="false"
            href={detailHref ? navigation.href(detailHref) : '#'}
            onClick={(event) => {
              if (!detailHref) event.preventDefault();
            }}
          >
            <SmsTemplateCardPreview template={template} />
          </a>
        ) : (
          <a
            className="template-card-preview-link"
            draggable="false"
            href={detailHref ? navigation.href(detailHref) : '#'}
            onClick={(event) => {
              if (!detailHref) event.preventDefault();
            }}
          >
            {template.imageUrl ? (
              <img
                alt={`${template.name} 템플릿 미리보기`}
                className="template-card-preview-image"
                draggable="false"
                loading={eager ? 'eager' : 'lazy'}
                src={template.imageUrl}
              />
            ) : (
              <TemplatePreviewFallback activeTab={activeTab} template={template} />
            )}
          </a>
        )}
      </div>
      <div className="template-card-content">
        <div className="template-card-header">
          <div className="template-card-copy">
            <span className="template-card-title" title={template.name}>{template.name}</span>
            <span className="template-card-alias-row">
              <code className="template-card-alias" title={template.code}>{template.code}</code>
              {template.codeMetaLabel ? (
                <>
                  <span className="template-card-alias-separator" aria-hidden="true">|</span>
                  <span className="template-card-code-meta" title={template.codeMetaLabel}>
                    {template.codeMetaLabel}
                  </span>
                </>
              ) : null}
            </span>
            {brandTypeLabel ? (
              <span className="template-card-description-row">
                <span className="template-card-type-meta">[{brandTypeLabel}]</span>
              </span>
            ) : null}
          </div>
          <Badge className="template-card-status" tone={template.statusTone}>{template.status}</Badge>
        </div>
      </div>
    </article>
  );
}

function TemplatePreviewFallback({ activeTab, template }) {
  const preview = template.body?.trim();

  if (!preview) {
    return (
      <span className="template-card-preview-fallback">
        <ImageOff size={20} strokeWidth={1.8} />
      </span>
    );
  }

  if (isAlimtalkTemplatePreview(activeTab, template)) {
    return <KakaoTemplateCardPreview body={preview} template={template} />;
  }

  return (
    <span className="template-card-preview-fallback">
      <span className="template-card-preview-text">{preview}</span>
    </span>
  );
}

function isAlimtalkTemplatePreview(activeTab, template) {
  const channelValue = String(activeTab ?? template.channel ?? '').toLowerCase();

  return channelValue === ALIMTALK_TEMPLATE_TAB || channelValue === 'alimtalk';
}

function isSmsTemplatePreview(activeTab, template) {
  const channelValue = String(activeTab ?? template.channel ?? '').toLowerCase();

  return channelValue === SMS_TEMPLATE_TAB.toLowerCase() || channelValue === 'sms';
}

function isBrandMessageTemplatePreview(activeTab, template) {
  const channelValue = String(activeTab ?? template.channel ?? '').toLowerCase();

  return channelValue === BRAND_MESSAGE_TEMPLATE_TAB
    || channelValue === 'brand-message'
    || channelValue === 'brand';
}

function getBrandTemplateCardTypeLabel(activeTab, template) {
  if (!isBrandMessageTemplatePreview(activeTab, template)) {
    return '';
  }

  return brandTemplateTypeLabels[getBrandTemplateType(template)] ?? '';
}

function TemplateCardMenu({ detailHref, template }) {
  const navigation = useConsoleNavigation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <>
      <ActionMenu>
        <ActionMenuTrigger asChild>
          <IconButton
            className="template-card-menu-trigger"
            icon={Ellipsis}
            label={`${template.name} 작업 더보기`}
            title=""
          />
        </ActionMenuTrigger>
        <ActionMenuContent align="end" className="template-card-menu-content" sideOffset={4}>
          <ActionMenuItem
            disabled={!detailHref}
            leadingVisual={<Eye size={16} />}
            onSelect={() => {
              if (detailHref) navigation.push(detailHref);
            }}
          >
            상세 보기
          </ActionMenuItem>
          <ActionMenuItem leadingVisual={<Pencil size={16} />}>
            편집
          </ActionMenuItem>
          <ActionMenuItem leadingVisual={<SquarePen size={16} />}>
            이름 변경
          </ActionMenuItem>
          <ActionMenuItem leadingVisual={<Copy size={16} />}>
            복제
          </ActionMenuItem>
          <ActionMenuSeparator />
          <ActionMenuItem
            leadingVisual={<Trash2 size={16} />}
            onSelect={() => setIsDeleteDialogOpen(true)}
            variant="danger"
          >
            삭제
          </ActionMenuItem>
        </ActionMenuContent>
      </ActionMenu>
      <TemplateDeleteDialog
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
        template={template}
      />
    </>
  );
}

function TemplateDeleteDialog({ onOpenChange, open, template }) {
  const [confirmationValue, setConfirmationValue] = useState('');
  const canDelete = confirmationValue === template.name;

  function handleOpenChange(nextOpen) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setConfirmationValue('');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canDelete) {
      return;
    }

    setConfirmationValue('');
    onOpenChange(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="template-delete-dialog" size="large">
        <DialogHeader showClose={false}>
          <DialogTitle>템플릿 삭제</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="template-delete-dialog-body">
            <DialogDescription>이 템플릿을 삭제하시겠습니까?</DialogDescription>
            <p className="template-delete-warning">이 작업은 되돌릴 수 없습니다.</p>
            <label className="template-delete-confirm-field">
              <span><strong>{template.name}</strong> 을 입력해 확인합니다.</span>
              <TextField.Root>
                <TextField.Input
                  autoComplete="off"
                  onChange={(event) => setConfirmationValue(event.target.value)}
                  placeholder="템플릿 이름 입력"
                  value={confirmationValue}
                />
              </TextField.Root>
            </label>
          </DialogBody>
          <DialogFooter>
            <Button disabled={!canDelete} type="submit" variant="danger">
              삭제
            </Button>
            <DialogClose asChild>
              <Button>취소</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
