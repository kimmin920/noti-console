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
import { IconButton } from './IconButton.jsx';

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

export function Dialog({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const contentRef = useRef(null);
  const [triggerNode, setTriggerNode] = useState(null);
  const titleId = useId();
  const descriptionId = useId();
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = useCallback((nextOpen) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }, [isControlled, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const returnFocusNode = triggerNode;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      getFocusableControls(contentRef.current)[0]?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      returnFocusNode?.focus();
    };
  }, [isOpen, triggerNode]);

  const value = useMemo(() => ({
    contentRef,
    descriptionId,
    isOpen,
    setOpen,
    setTriggerNode,
    titleId,
    triggerNode,
  }), [descriptionId, isOpen, setOpen, titleId, triggerNode]);

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
  const { contentRef, descriptionId, isOpen, setOpen, titleId } = useDialogContext('DialogContent');

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="dialog-layer">
      <button
        aria-label="닫기"
        className="dialog-backdrop"
        onClick={() => setOpen(false)}
        type="button"
      />
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={['dialog-content', `dialog-${size}`, className].filter(Boolean).join(' ')}
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
