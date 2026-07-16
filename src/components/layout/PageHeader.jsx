import {
  PageHeaderActions,
  PageHeaderPrimaryButton,
} from '../../ui-kits/resend/layout/page-header-actions';

export function PageHeader({ action, actions, onAction, title }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {actions ?? (action ? (
        <PageHeaderActions>
          <PageHeaderPrimaryButton onClick={onAction}>{action}</PageHeaderPrimaryButton>
        </PageHeaderActions>
      ) : null)}
    </div>
  );
}
