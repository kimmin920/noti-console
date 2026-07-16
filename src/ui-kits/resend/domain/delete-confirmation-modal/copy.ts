import type { DeleteConfirmationEntity } from './types';

type DeleteConfirmationCopy = {
  readonly confirmation: string;
  readonly description: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly successTitle: string;
  readonly title: string;
};

const defaultNames: Record<DeleteConfirmationEntity, string> = {
  broadcast: 'Product launch',
  domain: 'new.vizuo.work',
};

function pluralize(entity: DeleteConfirmationEntity, count: number) {
  return count === 1 ? entity : `${entity}s`;
}

export function getDeleteConfirmationCopy(
  entity: DeleteConfirmationEntity,
  count: number,
  name = defaultNames[entity]
): DeleteConfirmationCopy {
  const safeCount = Math.max(1, count);
  const plural = pluralize(entity, safeCount);
  const confirmation = safeCount === 1 ? name : `DELETE ${safeCount} ${plural.toUpperCase()}`;
  return {
    confirmation,
    description: safeCount === 1
      ? `Are you sure you want to delete this ${entity}?`
      : `Are you sure you want to delete ${safeCount} ${plural}?`,
    placeholder: safeCount === 1 ? `Enter ${entity} name` : 'Enter confirmation text',
    submitLabel: `Delete ${plural}`,
    successTitle: safeCount === 1
      ? `This ${entity} has been deleted.`
      : `${safeCount} ${plural} have been deleted.`,
    title: `Delete ${plural}`,
  };
}
