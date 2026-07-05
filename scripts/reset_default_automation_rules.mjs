import { and, eq, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../src/db/client.js';
import {
  publEventDefinitions,
  senderResources,
  userSenderResources,
  users,
} from '../src/db/schema.js';
import { createDefaultAutomationService } from '../src/server/automations/service.js';

const DEFAULT_USER_EMAIL = 'vvee1253@gmail.com';
const PUBL_TEMPLATE_SOURCE = 'GROUP';
const PUBL_TEMPLATE_SOURCE_KEY = '954b4486e661a019badabd5ebe15d7ef7e27cb31';

const DEFAULT_AUTOMATIONS = [
  {
    eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
    name: '회원 채널 가입 기본 자동화',
    templateCode: 'CHANNEL_REGISTER',
    variableMapping: {
      닉네임: 'targetName',
      채널제목: 'channelTitle',
      채널주소: 'connectedDomain',
      채널코드: 'channelCode',
    },
  },
  {
    eventKey: 'MEMBER_GENERAL_CHANNEL_ORDER_CREATE',
    name: '채널 상품 결제 기본 자동화',
    templateCode: 'GENERAL_CHANNEL_ORDE',
    variableMapping: {
      채널제목: 'channelTitle',
      상품명: 'productName',
      결제금액: 'priceAmount',
      결제통화: 'priceCurrency',
      결제일시: 'eventOccurredAt',
      채널주소: 'connectedDomain',
      채널코드: 'channelCode',
      하위주소: 'linkWeb',
    },
  },
  {
    eventKey: 'SYSTEM_GENERAL_CHANNEL_REFUND_REQUEST_ACCEPT',
    name: '채널 환불 승인 기본 자동화',
    templateCode: 'CHANNEL_ORDER_REFUND',
    variableMapping: {
      채널제목: 'channelTitle',
      상품명: 'refundProductName',
      환불승인금액: 'refundRequestAmount',
      환불승인통화: 'refundRequestCurrency',
      환불승인일시: 'eventOccurredAt',
      채널주소: 'connectedDomain',
      채널코드: 'channelCode',
      하위주소: 'linkWeb',
    },
  },
];

async function main() {
  const db = getDb();
  const user = await findUserByEmail(db, DEFAULT_USER_EMAIL);

  if (!user) {
    throw new Error(`User not found: ${DEFAULT_USER_EMAIL}`);
  }

  const senderResource = await findDefaultKakaoSenderResource(db, user.id);

  if (!senderResource) {
    throw new Error(`Active Kakao sender resource not found for ${DEFAULT_USER_EMAIL}`);
  }

  const beforeCounts = await countAutomationRows(db);

  await hardDeleteAutomationRows(db);

  const automationService = createDefaultAutomationService();
  const createdRules = [];

  for (const automation of DEFAULT_AUTOMATIONS) {
    const eventDefinition = await findEventDefinition(db, automation.eventKey);

    if (!eventDefinition) {
      throw new Error(`PUBL event not found: ${automation.eventKey}`);
    }

    const createResult = await automationService.createAutomationRule({
      actorUserId: user.id,
      payload: {
        condition: { all: [] },
        cooldownPolicy: { enabled: false },
        eventDefinitionId: eventDefinition.id,
        name: automation.name,
        recipientMapping: { type: 'event_alias', alias: 'targetPhoneNumber' },
        sendChannel: 'alimtalk',
        senderResourceId: senderResource.id,
        templateCode: automation.templateCode,
        templateSource: PUBL_TEMPLATE_SOURCE,
        templateSourceKey: PUBL_TEMPLATE_SOURCE_KEY,
        variableMapping: automation.variableMapping,
      },
    });
    const enableResult = await automationService.enableAutomationRule({
      actorUserId: user.id,
      ruleId: createResult.rule.id,
    });

    createdRules.push({
      eventKey: automation.eventKey,
      id: enableResult.rule.id,
      name: enableResult.rule.name,
      status: enableResult.rule.status,
      templateCode: enableResult.rule.templateCode,
      templateSource: enableResult.rule.templateSource,
      templateSourceKey: enableResult.rule.templateSourceKey,
    });
  }

  const afterCounts = await countAutomationRows(db);

  console.log(JSON.stringify({
    afterCounts,
    beforeCounts,
    createdRules,
    senderResource: {
      displayName: senderResource.displayName,
      id: senderResource.id,
      value: senderResource.value,
    },
    user: {
      email: user.email,
      id: user.id,
    },
  }, null, 2));
}

async function findUserByEmail(db, email) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user ?? null;
}

async function findDefaultKakaoSenderResource(db, userId) {
  const rows = await db
    .select({
      link: userSenderResources,
      resource: senderResources,
    })
    .from(userSenderResources)
    .innerJoin(senderResources, eq(userSenderResources.senderResourceId, senderResources.id))
    .where(
      and(
        eq(userSenderResources.userId, userId),
        eq(userSenderResources.status, 'active'),
        eq(senderResources.type, 'kakao_sender_key'),
        eq(senderResources.status, 'active')
      )
    );

  const sendableRows = rows.filter(({ link }) => link.role === 'owner' || link.role === 'sender');

  return (
    sendableRows.find(({ resource }) => resource.displayName === '@비주오')?.resource
    ?? sendableRows.find(({ link }) => link.isDefault)?.resource
    ?? sendableRows[0]?.resource
    ?? null
  );
}

async function findEventDefinition(db, eventKey) {
  const [eventDefinition] = await db
    .select()
    .from(publEventDefinitions)
    .where(eq(publEventDefinitions.eventKey, eventKey))
    .limit(1);

  return eventDefinition ?? null;
}

async function countAutomationRows(db) {
  const [counts] = await db.execute(sql`
    select
      (select count(*)::int from automation_rules) as rules,
      (select count(*)::int from automation_rule_revisions) as revisions,
      (select count(*)::int from automation_event_deliveries) as deliveries,
      (select count(*)::int from message_send_groups where source_automation_rule_id is not null) as send_groups_with_rule_ref
  `);

  return counts;
}

async function hardDeleteAutomationRows(db) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update message_send_groups
      set
        source_automation_rule_id = null,
        source_automation_delivery_id = null
      where source_automation_rule_id is not null
        or source_automation_delivery_id is not null
    `);
    await tx.execute(sql`delete from automation_rule_revisions`);
    await tx.execute(sql`delete from automation_event_deliveries`);
    await tx.execute(sql`delete from automation_rules`);
  });
}

try {
  await main();
} finally {
  await closeDb();
}
