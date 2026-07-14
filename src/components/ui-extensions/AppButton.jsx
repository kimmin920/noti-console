import { forwardRef } from "react";

import { Button as ResendButton } from "../../ui-kits/resend/primitives/button";

const variantMap = {
  default: "interactive",
  primary: "accent",
  secondary: "interactive",
};

export const AppButton = forwardRef(function AppButton(
  { className = "", variant = "secondary", ...props },
  ref,
) {
  const resendVariant = variantMap[variant] ?? "interactive";
  const classes = [
    variant === "danger" ? "app-rui-button--danger" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ResendButton
      className={classes}
      ref={ref}
      variant={resendVariant}
      {...props}
    />
  );
});
