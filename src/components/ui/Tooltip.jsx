'use client';

import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip';
import {
  Children,
  forwardRef,
  isValidElement,
  useId,
} from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const TooltipProvider = BaseTooltip.Provider;
export const TooltipRoot = BaseTooltip.Root;

export const TooltipTrigger = forwardRef(function TooltipTrigger(
  { asChild = false, children, delay = 0, ...props },
  ref
) {
  if (asChild && isValidElement(children)) {
    return <BaseTooltip.Trigger delay={delay} ref={ref} render={Children.only(children)} {...props} />;
  }

  return (
    <BaseTooltip.Trigger delay={delay} ref={ref} {...props}>
      {children}
    </BaseTooltip.Trigger>
  );
});

export function TooltipContent({
  align = 'center',
  alignOffset,
  anchor,
  arrowPadding,
  children,
  className = '',
  collisionAvoidance,
  collisionBoundary,
  collisionPadding,
  disableAnchorTracking,
  id,
  maxWidth = 250,
  positionMethod,
  side = 'top',
  sideOffset = 6,
  sticky,
  style,
  ...props
}) {
  const popupStyle = {
    ...style,
    maxWidth: style?.maxWidth ?? maxWidth,
  };

  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        arrowPadding={arrowPadding}
        className="tooltip-positioner"
        collisionAvoidance={collisionAvoidance}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        disableAnchorTracking={disableAnchorTracking}
        positionMethod={positionMethod}
        side={side}
        sideOffset={sideOffset}
        sticky={sticky}
      >
        <BaseTooltip.Popup
          className={cx('tooltip-content', className)}
          id={id}
          style={popupStyle}
          {...props}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

export const TooltipPopup = BaseTooltip.Popup;
export const TooltipPositioner = BaseTooltip.Positioner;
export const TooltipPortal = BaseTooltip.Portal;

export const Tooltip = forwardRef(function Tooltip(
  {
    align = 'center',
    children,
    className = '',
    content,
    contentClassName = '',
    contentId,
    delay = 0,
    disabled = false,
    maxWidth = 250,
    side = 'top',
    sideOffset = 6,
    type = 'label',
    ...props
  },
  ref
) {
  const generatedId = useId();
  const tooltipId = contentId ?? generatedId;
  const hasContent = content !== null && content !== undefined && content !== false && content !== '';
  const child = isValidElement(children) ? Children.only(children) : children;
  const triggerProps = {
    ...props,
    ...(type === 'description' && hasContent ? { 'aria-describedby': tooltipId } : null),
  };

  return (
    <TooltipRoot disabled={disabled || !hasContent}>
      <TooltipTrigger
        asChild={isValidElement(child)}
        className={className}
        delay={delay}
        ref={ref}
        {...triggerProps}
      >
        {child}
      </TooltipTrigger>
      <TooltipContent
        align={align}
        className={contentClassName}
        id={tooltipId}
        maxWidth={maxWidth}
        side={side}
        sideOffset={sideOffset}
      >
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
});
