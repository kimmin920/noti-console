'use client';

import {
  FilterSelect,
  SearchField,
} from '../../../components/ui/index.js';

export function TemplateListToolbar({
  onSearchChange,
  onSenderResourceChange,
  onStatusChange,
  searchValue,
  senderResourceOptions,
  senderResourceValue,
  showStatusFilter,
  statusOptions,
  statusValue,
}) {
  return (
    <div className="template-list-toolbar">
      <SearchField
        aria-label="템플릿 이름 검색"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="템플릿 이름 검색"
        value={searchValue}
      />
      {showStatusFilter ? (
        <FilterSelect
          className="template-status-filter"
          label="상태"
          onValueChange={onStatusChange}
          options={statusOptions}
          value={statusValue}
        />
      ) : null}
      {senderResourceOptions.length > 0 ? (
        <FilterSelect
          className="template-sender-filter"
          label="발신 리소스"
          onValueChange={onSenderResourceChange}
          options={senderResourceOptions}
          value={senderResourceValue}
        />
      ) : null}
    </div>
  );
}
