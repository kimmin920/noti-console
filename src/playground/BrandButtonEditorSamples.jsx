'use client';

import { useState } from 'react';
import {
  Check,
  ExternalLink,
  GripVertical,
  Link2,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
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
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EmailSendFormGhostButton,
  EmailSendFormInput,
  EmailSendFormSelect,
  EmailSendFormTextarea,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/index.js';

const sampleButtonTypes = [
  { label: '웹 링크', value: 'WL' },
  { label: '앱 링크', value: 'AL' },
  { label: '봇 키워드', value: 'BK' },
  { label: '메시지 전달', value: 'MD' },
];

const initialButtons = [
  {
    id: 'collection',
    linkMo: 'https://m.acme.example/collection',
    linkPc: 'https://acme.example/collection',
    name: '컬렉션 보기',
    type: 'WL',
  },
  {
    id: 'coupon',
    linkMo: 'https://m.acme.example/coupon',
    linkPc: 'https://acme.example/coupon',
    name: '쿠폰 받기',
    type: 'WL',
  },
  {
    id: 'talk',
    linkMo: '',
    linkPc: '',
    name: '상담하기',
    type: 'BK',
  },
];

function cloneInitialButtons() {
  return initialButtons.map((button) => ({ ...button }));
}

function createSampleButton(index) {
  return {
    id: `sample-button-${Date.now()}-${index}`,
    linkMo: '',
    linkPc: '',
    name: `버튼 ${index}`,
    type: 'WL',
  };
}

function getButtonTypeLabel(type) {
  return sampleButtonTypes.find((option) => option.value === type)?.label ?? type;
}

function useSampleButtons() {
  const [buttons, setButtons] = useState(cloneInitialButtons);
  const [activeId, setActiveId] = useState(initialButtons[0].id);
  const activeButton = buttons.find((button) => button.id === activeId) ?? buttons[0] ?? null;

  function addButton() {
    const nextButton = createSampleButton(buttons.length + 1);
    setButtons((current) => [...current, nextButton]);
    setActiveId(nextButton.id);
    return nextButton;
  }

  function updateButton(buttonId, patch) {
    setButtons((current) => current.map((button) => (
      button.id === buttonId ? { ...button, ...patch } : button
    )));
  }

  function removeButton(buttonId) {
    const nextButtons = buttons.filter((button) => button.id !== buttonId);
    setButtons(nextButtons);

    if (buttonId === activeId) {
      setActiveId(nextButtons[0]?.id ?? '');
    }
  }

  return {
    activeButton,
    activeId,
    addButton,
    buttons,
    removeButton,
    setActiveId,
    updateButton,
  };
}

function ButtonSettingsFields({ button, onChange }) {
  if (!button) {
    return (
      <div className="brand-button-sample-empty">
        <span>버튼 없음</span>
      </div>
    );
  }

  return (
    <div className="brand-button-sample-fields">
      <label className="brand-button-sample-field">
        <span>버튼 이름</span>
        <EmailSendFormInput
          maxLength={14}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="버튼 이름"
          value={button.name}
        />
      </label>

      <div className="brand-button-sample-field">
        <span>버튼 타입</span>
        <EmailSendFormSelect
          ariaLabel="버튼 타입 선택"
          onValueChange={(type) => onChange({ type })}
          options={sampleButtonTypes}
          showMenuLabel={false}
          value={button.type}
        />
      </div>

      <label className="brand-button-sample-field">
        <span>모바일 링크</span>
        <EmailSendFormInput
          onChange={(event) => onChange({ linkMo: event.target.value })}
          placeholder="https://m.example.com"
          type="url"
          value={button.linkMo}
        />
      </label>

      <label className="brand-button-sample-field">
        <span>PC 링크</span>
        <EmailSendFormInput
          onChange={(event) => onChange({ linkPc: event.target.value })}
          placeholder="https://example.com"
          type="url"
          value={button.linkPc}
        />
      </label>
    </div>
  );
}

function SampleShell({
  accent = 'neutral',
  children,
  copy,
  label,
  recommended = false,
  title,
}) {
  return (
    <article className={['brand-button-sample-card', `is-${accent}`].filter(Boolean).join(' ')}>
      <header className="brand-button-sample-card-header">
        <div>
          <p className="brand-button-sample-kicker">{label}</p>
          <h3>{title}</h3>
        </div>
        {recommended ? <span className="brand-button-sample-tag">추천</span> : null}
      </header>
      <p className="brand-button-sample-copy">{copy}</p>
      {children}
    </article>
  );
}

function ButtonPill({ active = false, button, index, onClick, ...props }) {
  return (
    <button
      className={['brand-button-sample-pill', active && 'is-active'].filter(Boolean).join(' ')}
      onClick={onClick}
      type="button"
      {...props}
    >
      <span className="brand-button-sample-pill-index">{index + 1}</span>
      <span className="brand-button-sample-pill-label">{button.name || '이름 없음'}</span>
      <span className="brand-button-sample-pill-type">{getButtonTypeLabel(button.type)}</span>
      <Pencil aria-hidden="true" size={13} />
    </button>
  );
}

function ComposerMock({
  activeId,
  buttons,
  onAdd,
  onSelect,
  trailing,
}) {
  return (
    <div className="brand-button-composer">
      <div className="brand-button-composer-top">
        <span>본문</span>
        <span>38 / 1,300</span>
      </div>
      <EmailSendFormTextarea
        aria-label="샘플 브랜드 메시지 본문"
        defaultValue={'신규 컬렉션이 공개되었습니다.\n이번 주 한정 혜택을 확인해 보세요.'}
        rows={5}
      />
      <div className="brand-button-sample-pill-row">
        {buttons.map((button, index) => (
          <ButtonPill
            active={button.id === activeId}
            button={button}
            index={index}
            key={button.id}
            onClick={() => onSelect?.(button.id)}
          />
        ))}
        {onAdd ? (
          <button className="brand-button-sample-add" onClick={onAdd} type="button">
            <Plus aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

function DrawerInspectorSample() {
  const {
    activeButton,
    activeId,
    addButton,
    buttons,
    removeButton,
    setActiveId,
    updateButton,
  } = useSampleButtons();
  const [open, setOpen] = useState(false);

  function openSettings(buttonId) {
    setActiveId(buttonId);
    setOpen(true);
  }

  function addAndOpenSettings() {
    addButton();
    setOpen(true);
  }

  return (
    <SampleShell
      accent="black"
      copy="본문 아래에는 버튼 칩만 남기고, 링크와 타입은 오른쪽 설정 패널에서 처리합니다."
      label="안 01"
      recommended
      title="오른쪽 인스펙터 드로어"
    >
      <ComposerMock
        activeId={activeId}
        buttons={buttons}
        onAdd={addAndOpenSettings}
        onSelect={openSettings}
        trailing={(
          <EmailSendFormGhostButton onClick={() => setOpen(true)}>
            <PanelRightOpen aria-hidden="true" size={14} />
            버튼 설정
          </EmailSendFormGhostButton>
        )}
      />

      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerContent className="brand-button-editor-drawer" side="right" title="버튼 설정">
          <DrawerHeader>
            <DrawerTitle>버튼 설정</DrawerTitle>
            <DrawerDescription>{activeButton?.name || '새 버튼'} · {activeButton ? getButtonTypeLabel(activeButton.type) : ''}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <ButtonSettingsFields
              button={activeButton}
              onChange={(patch) => updateButton(activeButton.id, patch)}
            />
            <div className="brand-button-link-preview">
              <ExternalLink aria-hidden="true" size={15} />
              <span>{activeButton?.linkMo || '모바일 링크 없음'}</span>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button
              disabled={!activeButton}
              onClick={() => activeButton && removeButton(activeButton.id)}
              variant="danger"
            >
              <Trash2 aria-hidden="true" size={15} />
              삭제
            </Button>
            <Button onClick={() => setOpen(false)} variant="primary">완료</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </SampleShell>
  );
}

function PopoverEditorSample() {
  const {
    addButton,
    buttons,
    updateButton,
  } = useSampleButtons();

  return (
    <SampleShell
      accent="blue"
      copy="버튼을 누른 자리에서 작은 편집면을 띄웁니다. 버튼명과 링크만 빠르게 고칠 때 가장 가볍습니다."
      label="안 02"
      title="앵커드 팝오버 편집"
    >
      <div className="brand-button-composer">
        <div className="brand-button-composer-top">
          <span>버튼</span>
          <span>{buttons.length}개</span>
        </div>
        <div className="brand-button-popover-row">
          {buttons.map((button, index) => (
            <Popover key={button.id}>
              <PopoverTrigger asChild>
                <ButtonPill button={button} index={index} />
              </PopoverTrigger>
              <PopoverContent
                aria-label={`${button.name} 설정`}
                className="brand-button-popover-editor"
                side="bottom"
                width="medium"
              >
                <div className="brand-button-popover-heading">
                  <strong>{button.name || '이름 없음'}</strong>
                  <span>{getButtonTypeLabel(button.type)}</span>
                </div>
                <ButtonSettingsFields
                  button={button}
                  onChange={(patch) => updateButton(button.id, patch)}
                />
                <div className="brand-button-popover-footer">
                  <PopoverClose asChild>
                    <Button variant="primary">
                      <Check aria-hidden="true" size={15} />
                      적용
                    </Button>
                  </PopoverClose>
                </div>
              </PopoverContent>
            </Popover>
          ))}
          <button className="brand-button-sample-add" onClick={addButton} type="button">
            <Plus aria-hidden="true" size={14} />
          </button>
        </div>
      </div>
    </SampleShell>
  );
}

function SplitInspectorSample() {
  const {
    activeButton,
    activeId,
    addButton,
    buttons,
    setActiveId,
    updateButton,
  } = useSampleButtons();

  return (
    <SampleShell
      accent="green"
      copy="작성 영역 오른쪽에 선택된 버튼 속성을 고정합니다. 드로어를 열지 않아도 설정 상태가 계속 보입니다."
      label="안 03"
      title="캔버스 분할 인스펙터"
    >
      <div className="brand-button-split-layout">
        <ComposerMock
          activeId={activeId}
          buttons={buttons}
          onAdd={addButton}
          onSelect={setActiveId}
        />
        <aside className="brand-button-inline-inspector">
          <div className="brand-button-inline-inspector-header">
            <Settings2 aria-hidden="true" size={16} />
            <strong>Button</strong>
          </div>
          <ButtonSettingsFields
            button={activeButton}
            onChange={(patch) => updateButton(activeButton.id, patch)}
          />
        </aside>
      </div>
    </SampleShell>
  );
}

function ButtonManagerSample() {
  const {
    activeButton,
    activeId,
    addButton,
    buttons,
    removeButton,
    setActiveId,
    updateButton,
  } = useSampleButtons();

  return (
    <SampleShell
      accent="amber"
      copy="여러 버튼을 순서, 타입, 링크 상태까지 한 번에 확인합니다. 카카오 버튼 제한이나 정렬 작업에 강합니다."
      label="안 04"
      title="버튼 매니저 패널"
    >
      <div className="brand-button-manager-layout">
        <div className="brand-button-manager-list">
          <div className="brand-button-manager-list-header">
            <span>버튼 {buttons.length}/5</span>
            <EmailSendFormGhostButton onClick={addButton}>
              <Plus aria-hidden="true" size={14} />
              추가
            </EmailSendFormGhostButton>
          </div>
          {buttons.map((button, index) => (
            <button
              className={['brand-button-manager-row', button.id === activeId && 'is-active'].filter(Boolean).join(' ')}
              key={button.id}
              onClick={() => setActiveId(button.id)}
              type="button"
            >
              <GripVertical aria-hidden="true" size={14} />
              <span>{index + 1}</span>
              <strong>{button.name || '이름 없음'}</strong>
              <em>{getButtonTypeLabel(button.type)}</em>
              <MoreHorizontal aria-hidden="true" size={15} />
            </button>
          ))}
        </div>
        <div className="brand-button-manager-detail">
          <div className="brand-button-manager-detail-header">
            <SlidersHorizontal aria-hidden="true" size={16} />
            <strong>{activeButton?.name || '버튼'}</strong>
          </div>
          <ButtonSettingsFields
            button={activeButton}
            onChange={(patch) => updateButton(activeButton.id, patch)}
          />
          <Button
            disabled={!activeButton}
            onClick={() => activeButton && removeButton(activeButton.id)}
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={15} />
            삭제
          </Button>
        </div>
      </div>
    </SampleShell>
  );
}

function FocusDialogSample() {
  const {
    activeButton,
    activeId,
    buttons,
    setActiveId,
    updateButton,
  } = useSampleButtons();
  const [open, setOpen] = useState(false);

  return (
    <SampleShell
      accent="rose"
      copy="링크 오류가 발송 품질에 직접 영향을 줄 때 쓰는 집중형 모달입니다. 저장 전 최종 확인 흐름을 넣기 좋습니다."
      label="안 05"
      title="링크 설정 모달"
    >
      <ComposerMock
        activeId={activeId}
        buttons={buttons}
        onSelect={setActiveId}
        trailing={(
          <Button onClick={() => setOpen(true)} variant="primary">
            <Link2 aria-hidden="true" size={15} />
            링크 설정
          </Button>
        )}
      />

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="brand-button-modal-editor" size="large">
          <DialogHeader>
            <DialogTitle>링크 설정</DialogTitle>
            <DialogDescription>{activeButton?.name || '버튼'} 링크와 버튼 타입을 확인합니다.</DialogDescription>
          </DialogHeader>
          <DialogBody className="brand-button-modal-body">
            <div className="brand-button-modal-preview">
              <span>미리보기</span>
              <button type="button">{activeButton?.name || '버튼'}</button>
              <small>{activeButton?.linkMo || '모바일 링크 없음'}</small>
            </div>
            <ButtonSettingsFields
              button={activeButton}
              onChange={(patch) => updateButton(activeButton.id, patch)}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button>취소</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="primary">저장</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SampleShell>
  );
}

const samples = [
  { Component: DrawerInspectorSample, id: 'drawer' },
  { Component: PopoverEditorSample, id: 'popover' },
  { Component: SplitInspectorSample, id: 'split' },
  { Component: ButtonManagerSample, id: 'manager' },
  { Component: FocusDialogSample, id: 'modal' },
];

export function BrandButtonEditorSamples({ option = 'all' }) {
  const visibleSamples = option === 'all'
    ? samples
    : samples.filter((sample) => sample.id === option);

  return (
    <section className="brand-button-editor-samples">
      <div className="brand-button-samples-summary">
        <span>Resend editor pattern</span>
        <strong>버튼은 캔버스에서 선택만, 세부 설정은 분리된 표면에서 편집</strong>
      </div>
      <div className="brand-button-sample-grid">
        {visibleSamples.map(({ Component, id }) => (
          <Component key={id} />
        ))}
      </div>
    </section>
  );
}
