'use client';

import { useEffect, useRef, useState } from 'react';
import { PanelRightClose, Pin } from 'lucide-react';
import { motion } from 'motion/react';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getSide(side) {
  return ['top', 'right', 'bottom', 'left'].includes(side) ? side : 'right';
}

function getRootAnimation(side, expanded, previewOrOverlayOpen, panelSize) {
  const animation = {
    scale: previewOrOverlayOpen ? 0.97 : 1,
    opacity: previewOrOverlayOpen ? 0.87 : 1,
  };
  const expandedSize = panelSize + 80;

  return side === 'top' || side === 'bottom'
    ? { ...animation, height: expanded ? expandedSize : 60 }
    : { ...animation, width: expanded ? expandedSize : 60 };
}

function getTransformOrigin(side) {
  return {
    top: 'center top',
    right: 'right center',
    bottom: 'center bottom',
    left: 'left center',
  }[side];
}

function getPanelAnimation(side, expanded, panelSize) {
  return {
    top: { x: 0, y: expanded ? 16 : -panelSize },
    right: { x: expanded ? -16 : panelSize, y: 0 },
    bottom: { x: 0, y: expanded ? -16 : panelSize },
    left: { x: expanded ? 16 : -panelSize, y: 0 },
  }[side];
}

export function InspectorSidebar({
  children,
  contentSource = 'editor',
  defaultOpen = false,
  defaultPinned = false,
  handleColor = '#191919',
  mode = 'editor',
  onOpenChange,
  overlaySidebar = null,
  panelSize = 320,
  previewSidebarOpen = false,
  side = 'right',
  topbarHeight = '0px',
}) {
  const hoverCloseRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(defaultOpen);
  const [pinned, setPinned] = useState(defaultPinned);
  const resolvedSide = getSide(side);

  useEffect(() => clearHoverClose, []);

  const hidden = mode === 'code' || mode === 'focus' || contentSource === 'api';
  const overlayOpen = overlaySidebar !== null;
  const previewOrOverlayOpen = overlayOpen || previewSidebarOpen;
  const panelOpen = sidebarOpen && !previewSidebarOpen;
  const expanded = !hidden && (panelOpen || previewOrOverlayOpen);
  const pinLabel = pinned ? 'Hide sidebar' : 'Pin sidebar';
  const verticalSide = resolvedSide === 'left' || resolvedSide === 'right';
  const panelPositionStyle = verticalSide
    ? {
        height: 'calc(100vh - var(--editor-topbar-height) - 2rem)',
        top: 'calc(var(--editor-topbar-height) + 1rem)',
      }
    : {};

  useEffect(() => {
    onOpenChange?.(expanded);
  }, [expanded, onOpenChange]);

  if (hidden) {
    return null;
  }

  function clearHoverClose() {
    if (hoverCloseRef.current) {
      clearTimeout(hoverCloseRef.current);
      hoverCloseRef.current = null;
    }
  }

  function openSidebar(nextOpen) {
    setSidebarOpen(nextOpen);
  }

  function closeAfterHover() {
    if (!pinned) {
      hoverCloseRef.current = setTimeout(() => {
        openSidebar(false);
      }, 300);
    }
  }

  function togglePin() {
    if (pinned) {
      openSidebar(false);
      setPinned(false);
      return;
    }

    setPinned(true);
  }

  return (
    <motion.div
      animate={getRootAnimation(resolvedSide, expanded, previewOrOverlayOpen, panelSize)}
      className={cn(
        'inspector-sidebar-root',
        `inspector-sidebar-${resolvedSide}`,
        overlayOpen && 'is-overlay-blocked'
      )}
      initial={verticalSide ? { width: panelSize + 80 } : { height: panelSize + 80 }}
      onMouseEnter={clearHoverClose}
      onMouseLeave={closeAfterHover}
      style={{
        '--editor-topbar-height': topbarHeight,
        '--inspector-panel-size': `${panelSize}px`,
        transformOrigin: getTransformOrigin(resolvedSide),
      }}
      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
    >
      <motion.div
        animate={{ opacity: Number(!panelOpen) }}
        aria-label="Toggle inspector sidebar"
        className={cn(
          'inspector-sidebar-handle',
          "w-1.5 h-24 rounded-full cursor-pointer pointer-events-auto relative after:content-[''] after:absolute after:-inset-4 after:-top-30 after:-bottom-30 after:rounded-full"
        )}
        initial={{ opacity: 0 }}
        onClick={() => openSidebar((current) => !current)}
        onMouseEnter={() => {
          if (!overlayOpen) {
            openSidebar(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openSidebar((current) => !current);
          }
        }}
        role="button"
        style={{ backgroundColor: handleColor }}
        tabIndex={0}
      />

      <motion.div
        animate={getPanelAnimation(resolvedSide, expanded, panelSize)}
        className={cn('inspector-sidebar-panel', previewOrOverlayOpen && 'is-pointer-blocked')}
        data-testid="inspector-sidebar"
        initial={getPanelAnimation(resolvedSide, true, panelSize)}
        style={panelPositionStyle}
        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      >
        <div className="inspector-sidebar-scroll">{children}</div>
        <div className="inspector-sidebar-actions">
          <button
            aria-label={pinLabel}
            className="inspector-sidebar-pin-button"
            onClick={togglePin}
            title={pinLabel}
            type="button"
          >
            {pinned ? <PanelRightClose aria-hidden="true" /> : <Pin aria-hidden="true" />}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
