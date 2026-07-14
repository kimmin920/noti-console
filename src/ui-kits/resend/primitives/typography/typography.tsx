import type { ComponentPropsWithoutRef } from 'react';

type TextSize = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type TextColor = 'gray' | 'red' | 'white' | 'yellow';
type TextWeight = 'bold' | 'medium' | 'normal' | 'semibold';
type TextElement = 'div' | 'label' | 'p' | 'span';
type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

type TextProps = ComponentPropsWithoutRef<'span'> & {
  readonly as?: TextElement;
  readonly color?: TextColor;
  readonly size?: TextSize;
  readonly weight?: TextWeight;
};

type HeadingProps = ComponentPropsWithoutRef<'h1'> & {
  readonly as?: HeadingElement;
  readonly color?: 'gray' | 'white';
  readonly size?: Exclude<TextSize, '9'>;
  readonly weight?: Exclude<TextWeight, 'normal'>;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function Text({ as: Component = 'span', className, color = 'gray', size = '2', weight = 'normal', ...props }: TextProps) {
  return (
    <Component
      className={cx('resend-ui-text', className)}
      data-color={color}
      data-size={size}
      data-weight={weight}
      {...props}
    />
  );
}

function Heading({ as: Component = 'h1', className, color = 'white', size = '3', weight = 'bold', ...props }: HeadingProps) {
  return (
    <Component
      className={cx('resend-ui-heading', className)}
      data-color={color}
      data-size={size}
      data-weight={weight}
      {...props}
    />
  );
}

export { Heading, Text };
export type { HeadingProps, TextColor, TextProps, TextSize, TextWeight };
