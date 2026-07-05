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

const PopoverContext = createContext(null);

function usePopoverContext(component) {
  const context = useContext(PopoverContext);

  if (!context) {
    throw new Error(`${component} must be used inside Popover`);
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

export function Popover({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const contentId = useId();
  const contentRef = useRef(null);
  const rootRef = useRef(null);
  const [triggerNode, setTriggerNode] = useState(null);
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

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const firstControl = getFocusableControls(contentRef.current)[0];
      (firstControl ?? contentRef.current)?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const value = useMemo(() => ({
    contentId,
    contentRef,
    isOpen,
    rootRef,
    setOpen,
    setTriggerNode,
    triggerNode,
  }), [contentId, isOpen, setOpen, triggerNode]);

  return (
    <PopoverContext.Provider value={value}>
      <div className="popover-root" data-state={isOpen ? 'open' : 'closed'} ref={rootRef}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  asChild = false,
  children,
  onClick,
  type = 'button',
  ...props
}) {
  const { contentId, isOpen, setOpen, setTriggerNode } = usePopoverContext('PopoverTrigger');

  const handleClick = useCallback((event) => {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    setTriggerNode(event.currentTarget);
    setOpen(!isOpen);
  }, [isOpen, onClick, setOpen, setTriggerNode]);

  const triggerProps = {
    'aria-controls': contentId,
    'aria-expanded': isOpen,
    'data-state': isOpen ? 'open' : 'closed',
    ...props,
    onClick: handleClick,
  };

  if (asChild && isValidElement(children)) {
    return cloneElement(Children.only(children), {
      ...triggerProps,
      onClick: (event) => {
        children.props.onClick?.(event);
        triggerProps.onClick(event);
      },
    });
  }

  return (
    <button type={type} {...triggerProps}>
      {children}
    </button>
  );
}

export function PopoverContent({
  children,
  className = '',
  side = 'bottom',
  width = 'medium',
  ...props
}) {
  const { contentId, contentRef, isOpen, setOpen, triggerNode } = usePopoverContext('PopoverContent');

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className={['popover-content', `popover-${side}`, `popover-${width}`, className].filter(Boolean).join(' ')}
      id={contentId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          triggerNode?.focus();
        }
      }}
      ref={contentRef}
      role="complementary"
      tabIndex={-1}
      {...props}
    >
      {children}
    </aside>
  );
}

export function PopoverClose({
  asChild = false,
  children,
  onClick,
  type = 'button',
  ...props
}) {
  const { setOpen, triggerNode } = usePopoverContext('PopoverClose');

  const handleClick = useCallback((event) => {
    onClick?.(event);

    if (!event.defaultPrevented) {
      setOpen(false);
      window.requestAnimationFrame(() => triggerNode?.focus());
    }
  }, [onClick, setOpen, triggerNode]);

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
