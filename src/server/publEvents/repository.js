import { and, asc, eq, sql } from 'drizzle-orm';

import {
  automationEventDeliveries,
  automationRules,
  publEventDefinitions,
  publEventPropDefinitions,
} from '../../db/schema.js';

const PUBL_EVENT_TYPE = 'publ-event';

export function createPublEventCatalogRepository(db) {
  return {
    async createEventDefinition({ event, props, now = new Date() }) {
      return db.transaction(async (tx) => {
        const [eventRow] = await tx
          .insert(publEventDefinitions)
          .values(toEventRow(event, now))
          .returning();

        for (const prop of props) {
          await tx
            .insert(publEventPropDefinitions)
            .values(toPropRow(eventRow.id, prop, now));
        }

        const savedProps = await tx
          .select()
          .from(publEventPropDefinitions)
          .where(eq(publEventPropDefinitions.eventId, eventRow.id))
          .orderBy(asc(publEventPropDefinitions.sortOrder));

        return {
          event: eventRow,
          props: savedProps.map(fromPropRow),
        };
      });
    },

    async listCatalogEvents({ includeProps = false } = {}) {
      const events = await db
        .select()
        .from(publEventDefinitions)
        .where(eq(publEventDefinitions.eventType, PUBL_EVENT_TYPE))
        .orderBy(asc(publEventDefinitions.eventKey));

      if (!includeProps) return events;

      const withProps = [];

      for (const event of events) {
        withProps.push({
          ...event,
          props: await this.listPropsByEventId(event.id),
        });
      }

      return withProps;
    },

    async listPropsByEventId(eventId) {
      const props = await db
        .select()
        .from(publEventPropDefinitions)
        .where(eq(publEventPropDefinitions.eventId, eventId))
        .orderBy(asc(publEventPropDefinitions.sortOrder));

      return props.map(fromPropRow);
    },

    async findEventByKey(eventKey) {
      const [event] = await db
        .select()
        .from(publEventDefinitions)
        .where(eq(publEventDefinitions.eventKey, eventKey))
        .limit(1);

      return event ?? null;
    },

    async updateEventEditorDraft({ eventKey, event, props, deletedAliases = [], now = new Date() }) {
      return db.transaction(async (tx) => {
        const [eventRow] = await tx
          .update(publEventDefinitions)
          .set(toEventUpdateRow(event, now))
          .where(eq(publEventDefinitions.eventKey, eventKey))
          .returning();

        const deletedAliasSet = new Set(deletedAliases.map((entry) => entry.originalAlias));
        for (const originalAlias of deletedAliasSet) {
          await tx
            .delete(publEventPropDefinitions)
            .where(and(
              eq(publEventPropDefinitions.eventId, eventRow.id),
              eq(publEventPropDefinitions.alias, originalAlias)
            ));
        }

        const existingProps = props.filter((prop) => prop.originalAlias !== null);
        const temporaryAliasByOriginal = new Map();

        for (let index = 0; index < existingProps.length; index += 1) {
          const prop = existingProps[index];
          const temporaryAlias = `__publ_editor_tmp_${index}`;
          temporaryAliasByOriginal.set(prop.originalAlias, temporaryAlias);

          await tx
            .update(publEventPropDefinitions)
            .set({
              alias: temporaryAlias,
              sortOrder: -200000 - index,
              updatedAt: now,
            })
            .where(and(
              eq(publEventPropDefinitions.eventId, eventRow.id),
              eq(publEventPropDefinitions.alias, prop.originalAlias)
            ));
        }

        for (const prop of props) {
          if (prop.originalAlias === null) {
            await tx
              .insert(publEventPropDefinitions)
              .values(toPropRow(eventRow.id, prop, now));
            continue;
          }

          await tx
            .update(publEventPropDefinitions)
            .set(toEditorPropUpdateRow(prop, now))
            .where(and(
              eq(publEventPropDefinitions.eventId, eventRow.id),
              eq(publEventPropDefinitions.alias, temporaryAliasByOriginal.get(prop.originalAlias))
            ));
        }

        const savedProps = await tx
          .select()
          .from(publEventPropDefinitions)
          .where(eq(publEventPropDefinitions.eventId, eventRow.id))
          .orderBy(asc(publEventPropDefinitions.sortOrder));

        return {
          event: eventRow,
          props: savedProps.map(fromPropRow),
        };
      });
    },

    async countEventConnections(eventId) {
      const [ruleRow] = await db
        .select({ count: sql`count(*)::int` })
        .from(automationRules)
        .where(eq(automationRules.eventDefinitionId, eventId));

      const [deliveryRow] = await db
        .select({ count: sql`count(*)::int` })
        .from(automationEventDeliveries)
        .where(eq(automationEventDeliveries.eventDefinitionId, eventId));

      return {
        automationRules: Number(ruleRow?.count ?? 0),
        deliveries: Number(deliveryRow?.count ?? 0),
      };
    },

    async deleteEventDefinition({ eventKey }) {
      const [deletedEvent] = await db
        .delete(publEventDefinitions)
        .where(eq(publEventDefinitions.eventKey, eventKey))
        .returning();

      return deletedEvent ?? null;
    },

    async countCatalog() {
      const [eventRow] = await db
        .select({ count: sql`count(*)::int` })
        .from(publEventDefinitions)
        .where(eq(publEventDefinitions.eventType, PUBL_EVENT_TYPE));

      const [propRow] = await db
        .select({ count: sql`count(*)::int` })
        .from(publEventPropDefinitions)
        .innerJoin(publEventDefinitions, eq(publEventPropDefinitions.eventId, publEventDefinitions.id))
        .where(eq(publEventDefinitions.eventType, PUBL_EVENT_TYPE));

      return {
        events: Number(eventRow?.count ?? 0),
        props: Number(propRow?.count ?? 0),
      };
    },
  };
}

function toEventRow(event, now) {
  return {
    eventKey: event.eventKey,
    eventType: PUBL_EVENT_TYPE,
    displayName: event.displayName,
    serviceStatus: event.serviceStatus,
    locationType: event.locationType,
    locationId: event.locationId,
    sourceType: event.sourceType,
    actionType: event.actionType,
    updatedAt: now,
  };
}

function toEventUpdateRow(event, now) {
  return {
    eventType: PUBL_EVENT_TYPE,
    displayName: event.displayName,
    serviceStatus: event.serviceStatus,
    locationType: event.locationType,
    locationId: event.locationId,
    sourceType: event.sourceType,
    actionType: event.actionType,
    updatedAt: now,
  };
}

function toPropRow(eventId, prop, now) {
  return {
    eventId,
    sortOrder: prop.sortOrder,
    rawPath: prop.rawPath,
    alias: prop.alias,
    label: prop.label,
    propType: prop.type,
    required: prop.required,
    enabled: prop.enabled,
    fallback: prop.fallback,
    sample: prop.sample,
    parserPipelineJson: prop.parserPipeline,
    description: prop.description,
    updatedAt: now,
  };
}

function toEditorPropUpdateRow(prop, now) {
  return {
    sortOrder: prop.sortOrder,
    rawPath: prop.rawPath,
    alias: prop.alias,
    label: prop.label,
    propType: prop.type,
    required: prop.required,
    enabled: prop.enabled,
    fallback: prop.fallback,
    sample: prop.sample,
    parserPipelineJson: prop.parserPipeline,
    description: prop.description,
    updatedAt: now,
  };
}

function fromPropRow(row) {
  return {
    ...row,
    type: row.propType,
    sample: row.sample,
    parserPipeline: row.parserPipelineJson,
  };
}
