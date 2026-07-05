CREATE TYPE "public"."sender_number_application_type" AS ENUM('personal', 'company');--> statement-breakpoint
CREATE TYPE "public"."sender_resource_evidence_document_type" AS ENUM('telecom_certificate', 'consent_document', 'id_card_copy', 'business_registration', 'relationship_proof');--> statement-breakpoint
ALTER TABLE "sender_resource_application_evidence_files" ADD COLUMN "document_type" "sender_resource_evidence_document_type";--> statement-breakpoint
ALTER TABLE "sender_resource_applications" ADD COLUMN "sender_number_type" "sender_number_application_type";