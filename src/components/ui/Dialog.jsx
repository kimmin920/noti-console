'use client';

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AppIconButton as IconButton } from '../ui-extensions/AppIconButton.jsx';

const DialogContext = createContext(null);

function useDialogContext(component) {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error(`${component} must be used inside Dialog`);
  }

  return context;
}

function getFocusableControls(node) {
  if (!node) return [];

  return Array.from(
    node.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
    )
  );
}

function getMotionDurationMs(customProperty, fallbackMs) {
  const rawValue = window.getComputedStyle(document.documentElement).getPropertyValue(customProperty).trim();
  const parsedValue = Number.parseFloat(rawValue);

  if (!Number.isFinite(parsedValue)) {
    return fallbackMs;
  }

  return rawValue.endsWith('s') && !rawValue.endsWith('ms') ? parsedValue * 1000 : parsedValue;
}

export function Dialog({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;
  const contentRef = useRef(null);
  const presenceRef = useRef(isOpen ? 'closed' : 'unmounted');
  const [triggerNode, setTriggerNode] = useState(null);
  const titleId = useId();
  const descriptionId = useId();
  const [presenceState, setPresenceState] = useState(() => (isOpen ? 'closed' : 'unmounted'));
  const isPresent = presenceState !== 'unmounted';
  const motionState = presenceState === 'open' ? 'open' : 'closed';

  const setOpen = useCallback((nextOpen) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }, [isControlled, onOpenChange]);

  useEffect(() => {
    let frame = 0;
    let openFrame = 0;
    let timeout = 0;

    if (isOpen) {
      presenceRef.current = 'closed';

      frame = window.requestAnimationFrame(() => {
        setPresenceState('closed');

        openFrame = window.requestAnimationFrame(() => {
          presenceRef.current = 'open';
          setPresenceState('open');
        });
      });

      return () => {
        window.cancelAnimationFrame(frame);
        window.cancelAnimationFrame(openFrame);
      };
    }

    if (presenceRef.current === 'unmounted') {
      return undefined;
    }

    presenceRef.current = 'closed';
    frame = window.requestAnimationFrame(() => {
      setPresenceState('closed');

      timeout = window.setTimeout(() => {
        if (presenceRef.current !== 'closed') return;
        presenceRef.current = 'unmounted';
        setPresenceState('unmounted');
      }, getMotionDurationMs('--modal-close-dur', 150));
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isPresent) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPresent]);

  useEffect(() => {
    if (!isOpen || presenceState !== 'open') return;

    getFocusableControls(contentRef.current)[0]?.focus();
  }, [isOpen, presenceState]);

  useEffect(() => {
    if (isPresent) return;

    triggerNode?.focus();
  }, [isPresent, triggerNode]);

  const value = useMemo(() => ({
    contentRef,
    descriptionId,
    isOpen,
    isPresent,
    motionState,
    setOpen,
    setTriggerNode,
    titleId,
    triggerNode,
  }), [descriptionId, isOpen, isPresent, motionState, setOpen, titleId, triggerNode]);

  return (
    <DialogContext.Provider value={value}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  asChild = false,
  children,
  onClick,
  type = 'button',
  ...props
}) {
  const { setOpen, setTriggerNode } = useDialogContext('DialogTrigger');

  const handleClick = useCallback((event) => {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    setTriggerNode(event.currentTarget);
    setOpen(true);
  }, [onClick, setOpen, setTriggerNode]);

  if (asChild && isValidElement(children)) {
    return cloneElement(Children.only(children), {
      ...props,
      onClick: (event) => {
        children.props.onClick?.(event);
        handleClick(event);
      },
    });
  }

  return (
    <button type={type} {...props} onClick={handleClick}>
      {children}
    </button>
  );
}

export function DialogContent({
  children,
  className = '',
  size = 'medium',
  ...props
}) {
  const {
    contentRef,
    descriptionId,
    isPresent,
    motionState,
    setOpen,
    titleId,
  } = useDialogContext('DialogContent');

  if (!isPresent) {
    return null;
  }

  return createPortal(
    <div className="dialog-layer" data-state={motionState}>
      <button
        aria-label="닫기"
        className="dialog-backdrop"
        data-state={motionState}
        onClick={() => setOpen(false)}
        type="button"
      />
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={['dialog-content', 't-modal', `dialog-${size}`, className].filter(Boolean).join(' ')}
        data-state={motionState}
        onKeyDown={(event) => {
          const controls = getFocusableControls(contentRef.current);
          const currentIndex = controls.indexOf(document.activeElement);

          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            return;
          }

          if (event.key !== 'Tab' || controls.length === 0) {
            return;
          }

          if (event.shiftKey && currentIndex <= 0) {
            event.preventDefault();
            controls[controls.length - 1]?.focus();
          } else if (!event.shiftKey && currentIndex === controls.length - 1) {
            event.preventDefault();
            controls[0]?.focus();
          }
        }}
        ref={contentRef}
        role="dialog"
        {...props}
      >
        {children}
      </section>
    </div>,
    document.body
  );
}

export function DialogHeader({ children, className = '', showClose = true, ...props }) {
  const { setOpen } = useDialogContext('DialogHeader');

  return (
    <header className={['dialog-header', className].filter(Boolean).join(' ')} {...props}>
      <div>{children}</div>
      {showClose ? <IconButton icon={X} label="닫기" onClick={() => setOpen(false)} title="" /> : null}
    </header>
  );
}

export function DialogTitle({ children, className = '', ...props }) {
  const { titleId } = useDialogContext('DialogTitle');

  return (
    <h2 className={['dialog-title', className].filter(Boolean).join(' ')} id={titleId} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className = '', ...props }) {
  const { descriptionId } = useDialogContext('DialogDescription');

  return (
    <p className={['dialog-description', className].filter(Boolean).join(' ')} id={descriptionId} {...props}>
      {children}
    </p>
  );
}

export function DialogBody({ children, className = '', ...props }) {
  return (
    <div className={['dialog-body', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({ children, className = '', ...props }) {
  return (
    <footer className={['dialog-footer', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </footer>
  );
}

export function DialogClose({
  asChild = false,
  children,
  onClick,
  type = 'button',
  ...props
}) {
  const { setOpen } = useDialogContext('DialogClose');

  const handleClick = useCallback((event) => {
    onClick?.(event);

    if (!event.defaultPrevented) {
      setOpen(false);
    }
  }, [onClick, setOpen]);

  if (asChild && isValidElement(children)) {
    return cloneElement(Children.only(children), {
      ...props,
      onClick: (event) => {
        children.props.onClick?.(event);
        handleClick(event);
      },
    });
  }

  return (
    <button type={type} {...props} onClick={handleClick}>
      {children}
    </button>
  );
}
