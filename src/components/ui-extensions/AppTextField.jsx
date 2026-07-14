import { Input } from '../../ui-kits/resend/primitives/input';

export function AppTextFieldRoot({ children, className = '', ...props }) {
  return <div className={['app-rui-text-field', className].filter(Boolean).join(' ')} {...props}>{children}</div>;
}

export function AppTextFieldSlot({ children, className = '', ...props }) {
  return <span className={['app-rui-text-field__slot', className].filter(Boolean).join(' ')} {...props}>{children}</span>;
}

export const AppTextFieldInput = Input;

export const AppTextField = {
  Input: AppTextFieldInput,
  Root: AppTextFieldRoot,
  Slot: AppTextFieldSlot,
};
