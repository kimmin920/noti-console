import { describe, expect, it } from 'vitest';

import {
  APP_DIALOG_SIZES,
  AppDialog,
  AppDialogBody,
  AppDialogClose,
  AppDialogContent,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogTrigger,
} from '../../components/ui-extensions/AppDialog.jsx';

describe('application dialog extension', () => {
  it('exposes the fixed modal sizes and compound component surface', () => {
    expect(APP_DIALOG_SIZES).toEqual(['sm', 'md', 'lg', 'workspace']);
    expect([
      AppDialog,
      AppDialogBody,
      AppDialogClose,
      AppDialogContent,
      AppDialogDescription,
      AppDialogFooter,
      AppDialogHeader,
      AppDialogTitle,
      AppDialogTrigger,
    ].every(Boolean)).toBe(true);
  });
});
