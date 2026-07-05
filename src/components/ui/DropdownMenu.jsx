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

const DropdownMenuContext = createContext(null);
const VIEWPORT_PADDING = 12;

function useDropdownMenuContext(component) {
  const context = useContext(DropdownMenuContext);

  if (!context) {
    throw new Error(`${component} must be used inside DropdownMenu`);
  }

  return context;
}

function getFocusableItems(contentNode) {
  if (!contentNode) return [];

  return Array.from(
    contentNode.querySelectorAll('[role^="menuitem"]:not([aria-disabled="true"])')
  );
}

function getFocusableControls(contentNode) {
  if (!contentNode) return [];

  return Array.from(
    contentNode.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
    )
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDropdownMenuPosition({ align, contentNode, matchTriggerWidth, sideOffset, triggerNode }) {
  const triggerRect = triggerNode.getBoundingClientRect();
  const contentRect = contentNode.getBoundingClientRect();
  const minWidth = matchTriggerWidth ? triggerRect.width : null;
  const contentWidth = minWidth === null ? contentRect.width : Math.max(contentRect.width, minWidth);
  const contentHeight = contentRect.height;
  const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - contentWidth - VIEWPORT_PADDING);
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - contentHeight - VIEWPORT_PADDING);
  const availableBelow = window.innerHeight - triggerRect.bottom - sideOffset - VIEWPORT_PADDING;
  const availableAbove = triggerRect.top - sideOffset - VIEWPORT_PADDING;
  const shouldOpenAbove = availableBelow < contentHeight && availableAbove > availableBelow;
  const rawTop = shouldOpenAbove
    ? triggerRect.top - contentHeight - sideOffset
    : triggerRect.bottom + sideOffset;
  const rawLeft = align === 'end'
    ? triggerRect.right - contentWidth
    : triggerRect.left;

  return {
    left: clamp(rawLeft, VIEWPORT_PADDING, maxLeft),
    minWidth,
    top: clamp(rawTop, VIEWPORT_PADDING, maxTop),
    transformOrigin: shouldOpenAbove
      ? `bottom ${align === 'end' ? 'right' : 'left'}`
      : `top ${align === 'end' ? 'right' : 'left'}`,
  };
}

function applyDropdownMenuPosition({ align, contentNode, matchTriggerWidth, sideOffset, triggerNode }) {
  const position = getDropdownMenuPosition({
    align,
    contentNode,
    matchTriggerWidth,
    sideOffset,
    triggerNode,
  });

  contentNode.style.left = `${position.left}px`;
  contentNode.style.minWidth = position.minWidth === null ? '' : `${position.minWidth}px`;
  contentNode.style.top = `${position.top}px`;
  contentNode.style.transformOrigin = position.transformOrigin;
  contentNode.style.visibility = 'visible';
}

export function DropdownMenu({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const triggerId = useId();
  const contentId = useId();
  const rootRef = useRef(null);
  const contentRef = useRef(null);
  const [triggerNode, setTriggerNode] = useState(null);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const setOpen = useCallback((nextOpen) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }, [isControlled, onOpenChange]);

  const handleRootPointerDown = useCallback((event) => {
    if (isOpen && event.target === event.currentTarget) {
      setOpen(false);
    }
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      const target = event.target;

      if (!(target instanceof Node)) {
        setOpen(false);
        return;
      }

      if (rootRef.current?.contains(target) || contentRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, setOpen]);

  const value = useMemo(() => ({
    contentId,
    contentRef,
    isOpen,
    rootRef,
    setOpen,
    setTriggerNode,
    triggerId,
    triggerNode,
  }), [contentId, isOpen, setOpen, triggerId, triggerNode]);

  return (
    <DropdownMenuContext.Provider value={value}>
      <div
        className="dropdown-menu-root"
        data-state={isOpen ? 'open' : 'closed'}
        onPointerDown={handleRootPointerDown}
        ref={rootRef}
      >
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild = false,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  const { contentId, isOpen, setOpen, setTriggerNode, triggerId } = useDropdownMenuContext('DropdownMenuTrigger');
  const { onClick, onFocus, onKeyDown, ...triggerRest } = props;

  const handleClick = useCallback((event) => {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    setTriggerNode(event.currentTarget);

    if (event.currentTarget.disabled || event.currentTarget.getAttribute('aria-disabled') === 'true') {
      return;
    }

    setOpen(!isOpen);
  }, [isOpen, onClick, setOpen, setTriggerNode]);

  const handleFocus = useCallback((event) => {
    onFocus?.(event);

    if (!event.defaultPrevented) {
      setTriggerNode(event.currentTarget);
    }
  }, [onFocus, setTriggerNode]);

  const handleKeyDown = useCallback((event) => {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    setTriggerNode(event.currentTarget);

    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  }, [onKeyDown, setOpen, setTriggerNode]);

  const triggerProps = {
    'aria-controls': contentId,
    'aria-expanded': isOpen,
    'aria-haspopup': 'menu',
    'data-state': isOpen ? 'open' : 'closed',
    id: triggerId,
    onClick: handleClick,
    onFocus: handleFocus,
    onKeyDown: handleKeyDown,
    ...triggerRest,
  };

  if (asChild && isValidElement(children)) {
    return cloneElement(Children.only(children), {
      ...triggerProps,
      className: [children.props.className, triggerProps.className].filter(Boolean).join(' '),
      onClick: (event) => {
        children.props.onClick?.(event);
        triggerProps.onClick(event);
      },
      onFocus: (event) => {
        children.props.onFocus?.(event);
        triggerProps.onFocus(event);
      },
      onKeyDown: (event) => {
        children.props.onKeyDown?.(event);
        triggerProps.onKeyDown(event);
      },
    });
  }

  return (
    <button
      className={['dropdown-menu-trigger', className].filter(Boolean).join(' ')}
      type={type}
      {...triggerProps}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  align = 'start',
  children,
  className = '',
  matchTriggerWidth = true,
  sideOffset = 6,
  ...props
}) {
  const { contentId, contentRef, isOpen, setOpen, triggerId, triggerNode } = useDropdownMenuContext('DropdownMenuContent');
  const portalNode = typeof document === 'undefined' ? null : document.body;

  const updatePosition = useCallback(() => {
    if (!triggerNode || !contentRef.current) {
      return;
    }

    applyDropdownMenuPosition({
      align,
      contentNode: contentRef.current,
      matchTriggerWidth,
      sideOffset,
      triggerNode,
    });
  }, [align, contentRef, matchTriggerWidth, sideOffset, triggerNode]);

  const setContentNode = useCallback((node) => {
    contentRef.current = node;

    if (node && triggerNode) {
      applyDropdownMenuPosition({
        align,
        contentNode: node,
        matchTriggerWidth,
        sideOffset,
        triggerNode,
      });
    }
  }, [align, contentRef, matchTriggerWidth, sideOffset, triggerNode]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const firstMenuItem = getFocusableItems(contentRef.current)[0];
      const firstControl = getFocusableControls(contentRef.current)[0];
      (firstMenuItem ?? firstControl)?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [contentRef, isOpen]);

  if (!isOpen || !portalNode) {
    return null;
  }

  return createPortal(
    <div
      aria-labelledby={triggerId}
      className={['dropdown-menu-content', className].filter(Boolean).join(' ')}
      data-align={align}
      id={contentId}
      onKeyDown={(event) => {
        const items = getFocusableItems(contentRef.current);
        const currentIndex = items.indexOf(document.activeElement);

        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          triggerNode?.focus();
          return;
        }

        if (event.key === 'Tab') {
          setOpen(false);
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          items[nextIndex]?.focus();
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          items[nextIndex]?.focus();
        }

        if (event.key === 'Home' || event.key === 'PageUp') {
          event.preventDefault();
          items[0]?.focus();
        }

        if (event.key === 'End' || event.key === 'PageDown') {
          event.preventDefault();
          items[items.length - 1]?.focus();
        }
      }}
      ref={setContentNode}
      role="menu"
      style={{
        '--dropdown-menu-offset': `${sideOffset}px`,
        bottom: 'auto',
        left: 0,
        minWidth: matchTriggerWidth ? triggerNode?.offsetWidth : undefined,
        position: 'fixed',
        right: 'auto',
        top: 0,
        visibility: 'hidden',
      }}
      {...props}
    >
      {children}
    </div>,
    portalNode
  );
}

export function DropdownMenuItem({
  children,
  className = '',
  disabled = false,
  onClick,
  onSelect,
  type = 'button',
  ...props
}) {
  const { setOpen, triggerNode } = useDropdownMenuContext('DropdownMenuItem');

  return (
    <button
      aria-disabled={disabled ? 'true' : undefined}
      className={['dropdown-menu-item', className].filter(Boolean).join(' ')}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        if (disabled) {
          event.preventDefault();
          return;
        }

        onSelect?.(event);

        if (!event.defaultPrevented) {
          setOpen(false);
          window.requestAnimationFrame(() => triggerNode?.focus());
        }
      }}
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuCheckboxItem({
  checked = false,
  children,
  className = '',
  disabled = false,
  onCheckedChange,
  onSelect,
  ...props
}) {
  return (
    <DropdownMenuItem
      aria-checked={checked}
      className={className}
      disabled={disabled}
      onSelect={(event) => {
        onCheckedChange?.(!checked);
        onSelect?.(event);
      }}
      role="menuitemcheckbox"
      {...props}
    >
      {children}
    </DropdownMenuItem>
  );
}

export function DropdownMenuLabel({ children, className = '', ...props }) {
  return (
    <div className={['dropdown-menu-label', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = '', ...props }) {
  return <div className={['dropdown-menu-separator', className].filter(Boolean).join(' ')} role="separator" {...props} />;
}
