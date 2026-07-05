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

const DrawerContext = createContext(null);

function useDrawerContext(component) {
  const context = useContext(DrawerContext);

  if (!context) {
    throw new Error(`${component} must be used inside Drawer`);
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

export function Drawer({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const contentRef = useRef(null);
  const [triggerNode, setTriggerNode] = useState(null);
  const titleId = useId();
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
    isOpen,
    setOpen,
    setTriggerNode,
    titleId,
    triggerNode,
  }), [isOpen, setOpen, titleId, triggerNode]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
}

export function DrawerTrigger({
  asChild = false,
  children,
  onClick,
  type = 'button',
  ...props
}) {
  const { setOpen, setTriggerNode } = useDrawerContext('DrawerTrigger');

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

export function DrawerContent({
  children,
  className = '',
  side = 'right',
  ...props
}) {
  const { contentRef, isOpen, setOpen, titleId } = useDrawerContext('DrawerContent');

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="drawer-layer">
      <button
        aria-label="닫기"
        className="drawer-backdrop"
        onClick={() => setOpen(false)}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={['drawer-content', `drawer-${side}`, className].filter(Boolean).join(' ')}
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

export function DrawerHeader({ children, className = '', ...props }) {
  const { setOpen } = useDrawerContext('DrawerHeader');

  return (
    <header className={['drawer-header', className].filter(Boolean).join(' ')} {...props}>
      <div>{children}</div>
      <IconButton icon={X} label="닫기" onClick={() => setOpen(false)} title="" />
    </header>
  );
}

export function DrawerTitle({ children, className = '', ...props }) {
  const { titleId } = useDrawerContext('DrawerTitle');

  return (
    <h2 className={['drawer-title', className].filter(Boolean).join(' ')} id={titleId} {...props}>
      {children}
    </h2>
  );
}

export function DrawerDescription({ children, className = '', ...props }) {
  return (
    <p className={['drawer-description', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </p>
  );
}

export function DrawerBody({ children, className = '', ...props }) {
  return (
    <div className={['drawer-body', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function DrawerFooter({ children, className = '', ...props }) {
  return (
    <footer className={['drawer-footer', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </footer>
  );
}
