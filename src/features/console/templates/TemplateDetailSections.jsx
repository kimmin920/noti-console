'use client';

import { BrandMessageTemplateCardPreview } from '../../../components/ui/BrandMessageTemplateCardPreview.jsx';
import { KakaoTemplateCardPreview } from '../../../components/ui/KakaoTemplateCardPreview.jsx';
import { DataTableV2 } from '../../../components/ui/index.js';
import {
  buildActionRows,
  buildContentRows,
  buildParameterRows,
  buildPayloadRows,
} from './templateDetailModel.js';

const valueCell = ({ value }) => <span className="template-detail-table-value">{value || '-'}</span>;
const monoCell = ({ value }) => <code className="template-detail-table-mono">{value || '-'}</code>;

export function TemplateContentPanel({ detail }) {
  const contentRows = buildContentRows(detail);
  const actionRows = buildActionRows(detail);

  return (
    <>
      <TemplatePreview detail={detail} />
      <TemplateSubsection title="Content fields">
        <TemplateTable
          columns={[
            { accessor: 'field', cell: monoCell, header: 'Field' },
            { accessor: 'value', cell: valueCell, header: 'Value' },
          ]}
          data={contentRows}
          empty="표시할 콘텐츠 필드가 없습니다."
          rowPrefix="content"
        />
      </TemplateSubsection>
      <TemplateSubsection title="Buttons and quick replies">
        <TemplateTable
          columns={[
            { accessor: 'group', header: 'Group' },
            { accessor: 'order', header: 'Order' },
            { accessor: 'type', cell: monoCell, header: 'Type' },
            { accessor: 'name', cell: valueCell, header: 'Name' },
            { accessor: 'link', cell: valueCell, header: 'Link' },
          ]}
          data={actionRows}
          empty="등록된 버튼 또는 바로 연결 응답이 없습니다."
          rowPrefix="action"
        />
      </TemplateSubsection>
    </>
  );
}

export function TemplateParametersPanel({ detail }) {
  const parameterRows = buildParameterRows(detail);

  return (
    <TemplateSubsection title="Template parameters">
      <TemplateTable
        columns={[
          { accessor: 'key', cell: monoCell, header: 'Key' },
          { accessor: 'token', cell: monoCell, header: 'Token' },
          { accessor: 'required', header: 'Required' },
          { accessor: 'fallback', cell: valueCell, header: 'Fallback' },
        ]}
        data={parameterRows}
        empty="이 템플릿에는 입력할 변수가 없습니다."
        rowPrefix="parameter"
      />
    </TemplateSubsection>
  );
}

export function TemplatePayloadPanel({ detail, senderResourceId }) {
  const payloadRows = buildPayloadRows(detail, senderResourceId);

  return (
    <TemplateSubsection title="Normalized payload">
      <TemplateTable
        columns={[
          { accessor: 'field', cell: monoCell, header: 'Field' },
          { accessor: 'value', cell: valueCell, header: 'Value' },
        ]}
        data={payloadRows}
        empty="표시할 payload 메타데이터가 없습니다."
        rowPrefix="payload"
      />
    </TemplateSubsection>
  );
}

function TemplatePreview({ detail }) {
  const body = detail.template?.body ?? detail.template?.content ?? detail.body ?? '';
  const isBrand = detail.channelView?.apiChannel === 'brand-message';
  const isAlimtalk = detail.channelView?.apiChannel === 'alimtalk';

  return (
    <TemplateSubsection title="Preview">
      <div className="template-detail-preview-stage">
        {isBrand ? (
          <div className="template-detail-brand-preview">
            <BrandMessageTemplateCardPreview template={detail.template} />
          </div>
        ) : null}
        {isAlimtalk ? (
          <div className="template-detail-kakao-preview">
            <KakaoTemplateCardPreview body={body} template={detail.template} />
          </div>
        ) : null}
        {!isBrand && !isAlimtalk ? (
          <div className="template-detail-sms-preview">
            <span>SMS</span>
            <p>{body || '본문이 없습니다.'}</p>
          </div>
        ) : null}
      </div>
    </TemplateSubsection>
  );
}

function TemplateSubsection({ children, title }) {
  return (
    <div className="resend-record-subsection template-detail-subsection">
      <h3 className="resend-record-title">{title}</h3>
      {children}
    </div>
  );
}

function TemplateTable({ columns, data, empty, rowPrefix }) {
  return (
    <DataTableV2
      columns={columns}
      data={data}
      empty={empty}
      fixed
      getRowId={(row, index) => `${rowPrefix}-${row.field ?? row.key ?? row.name ?? index}`}
      scrollBaseClassName=""
      scrollClassName="resend-dns-table-shell template-detail-table-shell"
      tableBaseClassName=""
      tableClassName="resend-dns-table template-detail-table"
      withShell={false}
    />
  );
}
