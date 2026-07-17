# Sender Resource Quota Specification

Status: implementation-ready, pre-implementation reviewed  
Last reviewed: 2026-07-17  
Scope: SMS/LMS/MMS, AlimTalk, Brand Message, automation, scheduled sends, SMS bulk runs, resend, and Kakao SMS fallback

## 1. Purpose

발신수단별 발송 한도를 서버에서 일관되게 강제한다.

이 기능의 핵심 목표는 다음과 같다.

- 문자 발신번호마다 월 발송 한도를 둔다.
- 카카오 채널마다 알림톡과 브랜드메시지의 일 발송 한도를 둔다.
- 기본 한도는 `sender_resources.quota_limit = 1000`이다.
- 한도는 NHN 요청 접수 건수가 아니라 최종 성공 건수만 소비한다.
- 아직 최종 결과가 나오지 않은 발송은 `reserved`로 가용 한도를 점유한다.
- 직접 발송, 자동화, 예약 발송, 벌크 발송, 재발송, 카카오 SMS 대체발송이 동일한 규칙을 따른다.
- 웹훅과 결과 보정 폴러가 같은 정산 경로를 사용하며 중복 집계하지 않는다.
- NHN 원본 수신자, 본문, 템플릿 파라미터, 원본 결과 payload를 새로 저장하지 않는다.

## 2. Product Decisions

### 2.1 Canonical limit

`sender_resources.quota_limit`가 발신수단의 현재 한도 설정값이다.

- 문자 발신번호의 기본값: 월 `1,000건`
- 카카오 채널의 기본값: 알림톡 일 `1,000건`, 브랜드메시지 일 `1,000건`
- 카카오 채널은 하나의 `quota_limit`를 공유한다.
- 카카오 채널 한도를 상향하면 알림톡과 브랜드메시지 한도가 함께 같은 값으로 올라간다.
- 알림톡과 브랜드메시지 사용량은 서로 섞지 않는다.
  - 예: 한도 1,000이면 같은 날 알림톡 성공 1,000건과 브랜드메시지 성공 1,000건이 각각 가능하다.
- 설정 UI에서는 카카오 채널 안에 두 개의 상향 항목을 만들지 않고 `일 1,000건` 한 개만 표시한다.

### 2.2 Quota ownership

한도는 사용자 단위가 아니라 발신수단 단위다.

- 문자: `sender_resources.id` 하나, 즉 등록된 발신번호 하나가 한도 소유자다.
- 카카오: `sender_resources.id` 하나, 즉 등록된 카카오 sender key/채널 하나가 한도 소유자다.
- 같은 발신수단이 여러 사용자에게 연결되어 있으면 모든 사용자의 발송이 같은 버킷을 사용한다.
- quota bucket과 reservation에는 소유권 기준으로 `user_id`를 두지 않는다.
- 누가 발송했는지는 기존 `message_send_groups.user_id`로 추적한다.

### 2.3 Admission period

한도 귀속 기간은 최종 콜백 도착 시각이 아니라 발송의 유효 실행 시각으로 고정한다.

```text
effectiveAt = scheduledAt ?? preparedAt
```

- 즉시 발송과 자동화: NHN 호출 직전의 서버 시각
- 예약 발송: `requestDate`
- 예약 벌크 발송: run의 `requestDate`
- 재발송: 재발송 요청 시각
- SMS fallback: 원 카카오 발송의 `effectiveAt`
- 모든 일/월 경계는 `Asia/Seoul` 기준이다.
- 결과가 다음 날 또는 다음 달에 도착해도 최초 선택한 버킷을 이동하지 않는다.

### 2.4 Success-only consumption

한도 카운트는 다음 상태 전이를 따른다.

| 상태 | Bucket 변화 | Reservation 변화 |
| --- | --- | --- |
| 발송 준비 | `reserved += N` | `reservedCount = N` |
| NHN 접수 완료 | 변화 없음 | 전부 pending 유지 |
| 수신자 성공 | `reserved -= 1`, `consumed += 1` | `consumedCount += 1` |
| 수신자 실패 | `reserved -= 1` | `releasedCount += 1` |
| 수신자 취소 | `reserved -= 1` | `releasedCount += 1` |
| 명확한 요청 거절 | 해당 요청의 남은 `reserved` 해제 | 남은 수량 release |
| 요청 결과 불명 | 변화 없음 | pending/reserved 유지 |

`availableCount`는 다음과 같이 계산한다.

```text
availableCount = max(0, quotaLimit - reservedCount - consumedCount)
```

## 3. Scope

### 3.1 Included

- 문자 직접 즉시 발송
- 문자 직접 예약 발송
- 알림톡 직접 즉시/예약 발송
- 브랜드메시지 직접 즉시/예약 발송
- PUBL 자동화 발송
- SMS/LMS/MMS 벌크 즉시/예약 발송
- 발송기록의 SMS/LMS/MMS/알림톡 재발송
- 카카오 실패 시 NHN SMS/LMS 대체발송
- SMS 예약 취소 후 quota 해제
- 웹훅 결과 정산
- 기존 correction worker 결과 정산
- 한도 상향 승인 후 현재/미래 버킷 한도 반영
- 기존 로컬 발송 원장을 기준으로 한 open-period 백필

### 3.2 Explicitly excluded from MVP

- 수신자별 quota row 또는 recipient result 테이블
- quota event-sourcing 테이블
- quota 전용 worker 또는 별도 큐
- NHN 전체 발송 내역을 주기적으로 전수 대조하는 작업
- `unknown` 요청의 grouping key 자동 복구
- `unknown` reservation의 자동 만료/자동 해제
- SMS provider timeout 자동 재시도
- 카카오 예약 취소 UI/API 활성화
- 사용자별 별도 quota override
- 발송 속도 제한 또는 token bucket rate limiter
- 과거 fallback 내역을 위한 일회성 NHN 전수 스캔

## 4. Quota Channels and Periods

quota bucket에는 실제 메시지 채널을 그대로 저장하지 않고 다음 세 quota channel만 사용한다.

| 실제 발송 채널 | quota channel | 주기 | 발신수단 타입 |
| --- | --- | --- | --- |
| `sms` | `sms` | 월 | `sms_send_no` |
| `lms` | `sms` | 월 | `sms_send_no` |
| `mms` | `sms` | 월 | `sms_send_no` |
| `alimtalk` | `alimtalk` | 일 | `kakao_sender_key` |
| `brand-message` | `brand-message` | 일 | `kakao_sender_key` |

### 4.1 SMS monthly period

예: `2026-07-01 00:00:00+09:00 <= effectiveAt < 2026-08-01 00:00:00+09:00`

SMS/LMS/MMS는 같은 발신번호의 같은 월 버킷을 함께 사용한다.

### 4.2 Kakao daily period

예: `2026-07-17 00:00:00+09:00 <= effectiveAt < 2026-07-18 00:00:00+09:00`

같은 카카오 sender resource라도 `alimtalk`과 `brand-message` 버킷은 별개다. 두 버킷의 `quotaLimit`는 모두 같은 `sender_resources.quota_limit`에서 읽는다.

## 5. Database Schema

기존 `sms_quota_buckets`, `sms_quota_reservations`는 벌크 run 전용이므로 발신수단 공통 구조로 교체한다.

### 5.1 Enum: `sender_resource_quota_channel`

```text
sms
alimtalk
brand-message
```

### 5.2 Enum: `sender_resource_quota_reservation_kind`

```text
primary
fallback
```

- `primary`: 발송 요청의 원 채널 quota
- `fallback`: 카카오 실패 시 실행될 수 있는 SMS/LMS quota

### 5.3 Table: `sender_resource_quota_buckets`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | uuid | PK, random default |
| `sender_resource_id` | uuid | NOT NULL, FK `sender_resources.id`, delete restrict |
| `quota_channel` | enum | NOT NULL |
| `period_start_at` | timestamptz | NOT NULL, inclusive |
| `period_end_at` | timestamptz | NOT NULL, exclusive |
| `quota_limit` | integer | NOT NULL, positive |
| `reserved_count` | integer | NOT NULL, default 0, nonnegative |
| `consumed_count` | integer | NOT NULL, default 0, nonnegative |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

Indexes and constraints:

```text
UNIQUE(sender_resource_id, quota_channel, period_start_at, period_end_at)
INDEX(sender_resource_id, quota_channel, period_end_at)
CHECK(period_end_at > period_start_at)
CHECK(quota_limit > 0)
CHECK(reserved_count >= 0)
CHECK(consumed_count >= 0)
```

`reserved_count + consumed_count <= quota_limit` check constraint는 만들지 않는다. 과거 결과가 authoritative correction에서 실패→성공으로 정정되면 실제 성공량이 한도를 초과할 수 있기 때문이다. 정정은 사실대로 반영하고 이후 신규 예약을 차단한다.

### 5.4 Table: `sender_resource_quota_reservations`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | uuid | PK, random default |
| `bucket_id` | uuid | NOT NULL, FK quota bucket, delete cascade |
| `provider_request_id` | uuid | nullable, FK local `message_send_provider_requests.id`, delete set null |
| `kind` | enum | NOT NULL, `primary` or `fallback` |
| `reserved_count` | integer | NOT NULL, positive |
| `consumed_count` | integer | NOT NULL, default 0, nonnegative |
| `released_count` | integer | NOT NULL, default 0, nonnegative |
| `settlement_snapshot_json` | jsonb | fallback 전용 compact `{ states, resultCodes }` snapshot, primary는 null |
| `fallback_opened_at` | timestamptz | primary 실패로 fallback 결과 조회가 필요해진 최초 시각, primary는 null |
| `result_synced_at` | timestamptz | fallback 조회 결과를 마지막으로 반영한 시각 |
| `result_finalized_at` | timestamptz | fallback 자동 보정 종료 시각 |
| `settled_at` | timestamptz | 현재 fully settled이면 최초 정산 시각, correction으로 reopen되면 null |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

Indexes and constraints:

```text
UNIQUE(provider_request_id, kind) WHERE provider_request_id IS NOT NULL
INDEX(bucket_id)
INDEX(provider_request_id)
INDEX(kind, result_finalized_at)
CHECK(reserved_count > 0)
CHECK(consumed_count >= 0)
CHECK(released_count >= 0)
CHECK(consumed_count + released_count <= reserved_count)
```

Reservation 상태 enum은 별도로 저장하지 않는다.

```text
remainingCount = reservedCount - consumedCount - releasedCount
settled = remainingCount === 0
```

이 방식은 부분 성공/부분 실패 요청을 `consumed` 또는 `released` 하나로 잘못 단순화하지 않는다.

provider request는 기존 보존 정책에 따라 hard delete될 수 있으므로 quota reservation이 함께 삭제되면 안 된다. 생성·정산 경로에서는 항상 `provider_request_id`가 있어야 하지만, 보존기간이 끝난 뒤에만 FK가 null이 될 수 있다. bucket 합계와 quota audit row는 별도 quota 보존 정책이 정해질 때까지 유지한다.

fallback snapshot은 request 내부 수신자 순서와 같은 길이의 bounded state/result-code 배열만 허용한다. 전화번호, recipient sequence, grouping key, provider raw payload는 저장하지 않는다.

### 5.5 `message_send_provider_requests` changes

`client_request_id`는 로컬 발송 멱등키로 사용한다.

```text
UNIQUE(client_request_id)
```

기존 non-unique index는 unique index로 교체한다.

동일한 `clientRequestId`가 다시 들어오면:

- 새 quota를 예약하지 않는다.
- NHN을 다시 호출하지 않는다.
- 기존 local provider request의 상태를 반환한다.
- 재발송을 원하면 새 `clientRequestId`를 사용해야 한다.

provider 요청을 NHN 호출 전에 생성하며 초기값은 다음과 같다.

```text
providerState = sending
resultState = not_synced
pendingCount = recipientCount
resultSnapshotJson = all P
providerRequestId = null
```

### 5.6 Canonical aggregate invariant

각 bucket의 집계값은 해당 reservation의 합과 일치해야 한다.

```text
bucket.reservedCount
  = SUM(reservation.reservedCount - reservation.consumedCount - reservation.releasedCount)

bucket.consumedCount
  = SUM(reservation.consumedCount)
```

일반 요청에서는 이 값을 매번 재계산하지 않고 같은 트랜잭션에서 delta로 갱신한다. 백필과 운영 점검용 SQL에서만 재계산한다.

## 6. Repository Contracts

구체적인 함수명은 코드 스타일에 맞춰 조정할 수 있지만 다음 계약은 유지한다.

### 6.1 Build quota descriptors

```js
buildPrimaryQuotaDescriptor({ channel, effectiveAt, senderResource })
buildFallbackQuotaDescriptor({ effectiveAt, smsSenderResource })
```

Return shape:

```js
{
  senderResourceId,
  quotaChannel,
  periodStartAt,
  periodEndAt,
}
```

descriptor는 client payload의 limit 값을 받지 않는다. 인증된 사용자가 접근 가능한 active sender resource를 기존 repository로 먼저 해석하며, 최종 limit는 reserve transaction 안에서 `sender_resources.quota_limit`를 다시 읽는다.

### 6.2 Prepare direct request with quota

```js
prepareProviderRequestWithQuota({
  group,
  providerRequest,
  primaryQuota,
  fallbackQuota,
  now,
})
```

하나의 DB 트랜잭션 안에서:

1. 기존 `clientRequestId`를 확인한다.
2. 기존 요청이면 기존 row를 반환하고 아무 카운트도 바꾸지 않는다.
3. group과 local provider request를 `sending` 상태로 생성한다.
4. primary/fallback sender resource row를 정렬된 순서로 잠그고 현재 `quota_limit`를 읽는다.
5. 필요한 bucket을 lazy upsert한다.
6. bucket의 `quota_limit`를 `GREATEST(bucket.quota_limit, sender_resources.quota_limit)`로 동기화한다.
7. 다음 조건을 만족할 때만 `reserved_count += N` 한다.

```text
bucket.reservedCount + bucket.consumedCount + N <= quotaLimit
```

8. primary reservation을 생성한다.
9. fallback 사용 시 fallback reservation도 생성한다.
10. 둘 중 하나라도 예약할 수 없으면 전체 트랜잭션을 rollback한다.

fallback SMS quota가 부족하면 카카오 요청 자체를 NHN에 보내지 않는다.

동시성 구현 규칙:

- bucket은 `INSERT ... ON CONFLICT DO NOTHING` 후 조회해 lazy-create race를 흡수한다.
- 예약은 조건부 `UPDATE ... WHERE reserved_count + consumed_count + N <= quota_limit RETURNING ...` 또는 동등한 row-lock 방식으로 처리한다.
- 여러 resource/bucket을 다룰 때는 먼저 sender resource id 오름차순, 그 다음 `sender_resource_id`, `quota_channel`, `period_start_at` 오름차순으로 항상 같은 lock order를 사용한다.
- quota 부족은 트랜잭션 오류가 아니라 domain result로 반환하되, 함께 준비하던 ledger와 다른 reservation은 모두 rollback한다.

### 6.3 Settle reservation targets

quota 정산 함수는 증분 이벤트가 아니라 목표 합계를 받는다.

```js
settleQuotaReservationTx(tx, {
  reservationId,
  targetConsumedCount,
  targetReleasedCount,
  now,
})
```

계산:

```text
oldRemaining = reserved - oldConsumed - oldReleased
newRemaining = reserved - targetConsumed - targetReleased

bucket.consumed += targetConsumed - oldConsumed
bucket.reserved += newRemaining - oldRemaining
reservation.settledAt = newRemaining === 0 ? (oldSettledAt ?? now) : null
```

이 함수는 reservation row와 bucket row를 `FOR UPDATE`로 잠근다. 같은 웹훅을 여러 번 처리해도 target 값이 같으므로 두 번째 호출은 delta 0이다.

### 6.4 Release prepared/unsent requests

```js
releaseQuotaReservationsForProviderRequestsTx(tx, {
  providerRequestIds,
  now,
})
```

- 이미 consumed/released 된 수량은 유지한다.
- 남은 수량만 release한다.
- definite rejection, local failure before provider call, bulk unsent cancellation에 사용한다.

## 7. Direct Send Flow

문자, 알림톡, 브랜드메시지가 같은 흐름을 사용한다.

### 7.1 Before provider call

```text
validate payload/auth/resource
-> derive effectiveAt and quota descriptors
-> DB transaction: create local ledger + reserve quota
-> if quota insufficient: stop, NHN call count = 0
```

### 7.2 Provider acceptance

NHN 응답에 정상 `requestId`가 있으면:

```text
providerState = accepted
providerRequestId = NHN requestId
pendingCount = recipientCount
quota remains reserved
```

같은 동기 응답에서 일부 수신자가 명시적으로 거절되었다면 해당 수신자는 즉시 `F`로 snapshot에 병합하고 그 수량만 release한다. 나머지 수신자는 `P`로 유지한다. 응답 해석이 모호한 수신자는 release하지 않는다.

HTTP 성공이더라도 `requestId`가 없으면 `unknown`으로 처리하고 quota를 유지한다.

### 7.3 Definite rejection

다음은 명확한 거절로 본다.

- NHN 호출 전 local validation 실패
- 명시적인 NHN 4xx validation/rejection
- 명시적인 NHN 429 rate-limit 응답
- NHN 응답이 요청 미접수를 명확히 나타내는 provider code

처리:

```text
providerState = rejected or failed
pendingCount = 0
failedCount = recipientCount
resultFinalizedAt = now
release all remaining primary/fallback quota
```

### 7.4 Unknown result

다음은 `unknown`으로 본다.

- timeout
- connection reset/network disconnect after request dispatch
- 처리 여부가 불명확한 5xx
- 성공 응답을 받았지만 provider request id를 로컬에 확정하지 못함
- provider 성공 후 local DB update 실패

처리:

```text
providerState = unknown
quota remains reserved
do not auto-retry
```

provider call 전에 준비된 local row는 이미 commit되어 있다. provider acceptance를 기록하는 후속 DB update가 실패하면 API는 unknown을 반환하고 best-effort로 `providerState = unknown`을 기록한다. DB 자체가 불가해 그 기록도 실패하면 row는 `sending`으로 남을 수 있지만 reservation은 유지된다. 이 경우 자동 재발송하지 않고 운영 점검 대상으로 분류한다.

MVP에서는 unknown reservation을 자동 해제하지 않는다. 이는 가용량 누수보다 중복 발송/한도 초과 방지를 우선하는 정책이다.

### 7.5 Error boundary requirement

`executeProviderSend`의 provider 호출 오류와 provider 성공 후 local DB 오류를 같은 catch에서 거절로 처리하면 안 된다.

```text
provider call failed definitely -> reject/release
provider call outcome uncertain -> unknown/keep
provider accepted, local persistence failed -> unknown/keep
```

## 8. Result Merge and Quota Settlement

기존 웹훅과 correction worker가 공통으로 호출하는 `mergeProviderRequestResultSnapshot...` 트랜잭션을 quota 정산의 유일한 진입점으로 사용한다.

### 8.1 Primary settlement

provider request의 merge 전후 snapshot counts를 사용한다.

```text
targetConsumed = successCount
targetReleased = failedCount + canceledCount
remaining = pendingCount
```

같은 트랜잭션 안에서:

1. provider request row lock
2. snapshot merge
3. primary quota reservation row lock
4. bucket row lock
5. reservation target counts 반영
6. group aggregate rollup
7. commit

웹훅 처리 후 별도 quota update를 호출하면 중간 장애 시 영구 불일치가 생기므로 금지한다.

cutover backfill 전 기존 request에는 reservation이 없을 수 있다. 이때 result merge 자체는 정상 반영하고 quota 정산만 no-op하며 safe warning을 남긴다. backfill이 잠긴 provider row의 최신 snapshot으로 reservation을 만든다. send gate 해제 후 생성된 in-scope request에 reservation이 없으면 invariant violation이지만 webhook은 실패시키지 않는다.

### 8.2 Duplicate and race behavior

- 중복 웹훅: snapshot 변화 0, quota delta 0
- 웹훅과 폴러 동시 실행: provider request row lock으로 직렬화
- 비권위 웹훅은 기존 terminal state를 덮지 않음
- authoritative correction은 기존 terminal state를 정정할 수 있음
- 정정 S→F: consumed 감소
- 정정 F→S: consumed 증가
- 정정 때문에 bucket이 limit를 넘더라도 사실대로 기록하고 신규 예약을 차단

### 8.3 Unresolved final correction

2시간 final correction 후에도 `P`가 남을 수 있다.

- message ledger는 기존대로 `resultFinalizedAt`을 설정할 수 있다.
- quota reservation의 unresolved 수량은 계속 `reserved`로 남긴다.
- 자동 만료하거나 실패로 간주하지 않는다.
- 뒤늦은 웹훅이 오면 동일한 merge 경로로 정산한다.

### 8.4 Reconciliation cadence

별도 quota 동기화 cron은 만들지 않는다. 기존 result correction worker가 60초마다 due candidate를 찾고 provider 조회는 요청당 최대 두 correction stage를 사용한다.

- primary first correction: `max(effectiveAt, providerAcceptedAt) + 30분`
- primary final correction: `max(effectiveAt, providerAcceptedAt) + 2시간`
- 예약 발송은 row 생성 시각이 아니라 미래 `effectiveAt` 이후부터 시간을 센다.
- webhook은 stage를 기다리지 않고 도착 즉시 같은 merge/settle transaction을 실행한다.
- provider 조회 실패는 현재 stage를 성공 처리하지 않으며 quota를 release하지 않는다.
- final correction 뒤 P는 reserved로 남고, late webhook은 계속 받을 수 있다.

fallback reservation은 primary가 F로 확인돼 P fallback이 처음 열릴 때 `fallback_opened_at`을 기록한다. fallback lookup은 같은 worker에서 `fallback_opened_at + 30분`, `fallback_opened_at + 2시간` 두 stage로 수행한다. 새 worker, 고빈도 polling, NHN 전수 스캔은 추가하지 않는다.

## 9. SMS Bulk Send Flow

### 9.1 Run creation transaction

벌크 run 생성은 다음을 하나의 트랜잭션으로 처리한다.

1. `sms_bulk_send_runs` 생성
2. `sms_bulk_send_batches` 생성
3. `message_send_groups` 생성
4. batch마다 local `message_send_provider_requests` 생성
5. 전체 수신자 수를 bucket에서 원자적으로 예약
6. batch provider request마다 primary quota reservation 생성

전체 한도가 부족하면 run, batch, ledger, reservation을 하나도 남기지 않는다.

현재처럼 run/quota 생성 후 ledger를 별도 트랜잭션에서 만드는 구조는 금지한다.

### 9.2 Accepted batch

```text
batch/provider request = accepted
providerRequestId 저장
quota remains reserved
next batch 진행
```

NHN 접수 완료 시 quota를 consumed로 바꾸지 않는다.

### 9.3 Definite rejected/failed batch

현재 제품 정책대로 이후 batch를 중단한다.

- 현재 실패 batch: 남은 reservation release
- 아직 provider에 보내지 않은 queued batch: canceled/failed 처리 후 release
- 이전 accepted batch: 최종 결과가 나올 때까지 reserved 유지
- run: `failed`

### 9.4 Unknown batch

- 현재 unknown batch: reservation 유지
- 이전 accepted batch: reservation 유지
- 이후 아직 보내지 않은 queued batch: canceled 처리 후 release
- run: `blocked`
- 자동 재시도 금지

현재처럼 run의 남은 reservation 전체를 release하면 unknown batch까지 풀리므로 금지한다.

### 9.5 Scheduled bulk

- run 생성 시 전체 quota를 미래 `requestDate` 버킷에 예약한다.
- worker는 기존처럼 NHN에 `requestDate`를 포함해 batch를 제출한다.
- 실제 예약 시각까지 quota는 reserved 상태로 유지한다.
- 현재 기간의 available count에는 미래 버킷 예약을 포함하지 않는다.

## 10. Automation Flow

자동화는 별도 quota 구현을 만들지 않고 기존 `messageSendService`를 사용한다.

- 자동화 delivery의 deterministic `clientRequestId`를 유지한다.
- 같은 delivery 재시도는 같은 `clientRequestId`를 사용한다.
- 이미 local provider request가 있으면 quota/NHN 호출을 반복하지 않는다.
- quota 부족 시 automation delivery를 `unsent`로 표시한다.
- automation reason code `quota_exceeded`를 추가한다.
- 사용자는 한도 상향 또는 다음 기간 시작 후 기존 unsent 재시도 기능을 사용할 수 있다.
- unknown provider result는 중복 발송 방지를 위해 재시도 가능한 unsent로 되돌리지 않는다.

## 11. Scheduled Send Cancellation

현재 활성화된 SMS 예약 취소 경로에 quota 정산을 연결한다.

### 11.1 Full confirmed cancellation

provider가 요청한 recipient sequence 전체 취소를 확인하면 같은 요청 처리 안에서 compact snapshot에 `C`를 merge한다.

```text
provider cancel success
-> merge recipient sequences as C
-> primary reservation release
```

### 11.2 Partial/ambiguous cancellation

provider 응답이 `canceledCount < requestedCount`이지만 정확한 recipient sequence를 주지 않으면 임의로 해제하지 않는다.

- 확인된 sequence만 `C` 처리
- 식별할 수 없는 나머지는 reserved 유지
- 이후 웹훅 또는 correction 결과로 정산

카카오 예약 취소는 현재 UI/API에서 비활성 상태를 유지한다.

## 12. Resend Flow

발송기록 재발송은 현재처럼 NHN client를 직접 호출하지 않는다.

```text
authorize original failed row
-> fetch raw detail from NHN
-> create new clientRequestId
-> call message send service resend method
-> prepare local ledger + quota
-> call provider
-> settle through normal webhook/poller path
```

- 원 발송의 quota 상태는 바꾸지 않는다.
- 재발송은 새로운 성공 가능성이 있는 새 발송이므로 새 quota를 예약한다.
- SMS/LMS/MMS와 raw AlimTalk 재발송 모두 공통 quota preparation을 사용한다.
- Brand Message resend 미지원 정책은 유지한다.
- 별도 `sendKind = resend` 또는 새 ledger enum은 이번 범위에 추가하지 않는다.

## 13. Kakao SMS Fallback

fallback은 이미 provider가 자동 실행하는 실제 문자 발송이므로 SMS quota에 포함한다.

### 13.1 Admission

fallback이 활성화된 카카오 요청은 NHN 호출 전에 두 quota를 함께 예약한다.

```text
primary Kakao reservation: Kakao sender resource/day/channel
fallback SMS reservation: SMS sender resource/month
```

둘 중 하나라도 부족하면 전체 요청을 거절한다.

### 13.2 Primary result mapping

| Primary result | Kakao reservation | 아직 P 또는 primary-success 해제 상태인 SMS fallback reservation |
| --- | --- | --- |
| `S` | consume | `C(PRIMARY_SUCCESS)`로 release; fallback 미실행 |
| `F` | release | P는 유지하고 최초 F에 `fallback_opened_at` 기록; authoritative S→F correction이면 `C(PRIMARY_SUCCESS)`를 P로 reopen |
| `C` | release | release |

이미 provider가 terminal fallback 결과를 준 항목은 primary correction만으로 되돌리지 않는다. fallback authoritative result가 따로 정정한다.

fallback snapshot은 수신자별 상태와 bounded result code를 함께 저장한다. synthetic `PRIMARY_SUCCESS`는 provider의 `RSC01`과 구분하며, authoritative primary S→F correction에서 이 상태만 P로 되돌린다. 그 사이 해제된 capacity가 다른 발송에 사용됐다면 bucket의 reserved + consumed가 limit를 초과할 수 있다. 실제 provider 상태를 그대로 반영하고 이후 신규 예약을 차단한다.

### 13.3 Fallback result mapping

fallback reservation의 `settlement_snapshot_json`은 수신자별 compact 상태와 bounded result code만 저장한다.

| NHN resend status | Fallback snapshot | SMS quota |
| --- | --- | --- |
| `RSC01` no target | `C` | release |
| `RSC02` target | `P` | keep reserved |
| `RSC03` in progress | `P` | keep reserved |
| `RSC04` success | `S` | consume |
| `RSC05` failed | `F` | release |
| missing/unknown | no change | keep reserved |

`resendResultCode`가 명확한 SMS 최종 결과를 제공하면 SMS success/failure result-code mapping도 함께 사용한다.

### 13.4 Webhook and polling

Kakao webhook에는 primary result만 있고 fallback 최종 결과가 없으므로:

- 웹훅은 primary reservation을 즉시 정산한다.
- fallback reservation이 open이면 기존 correction worker가 provider message lookup에서 `resendStatus`, `resendResultCode`, `resendRequestId`를 읽는다.
- 별도 fallback worker는 만들지 않는다.
- 기존 30분/2시간 correction 주기를 사용한다.
- primary pending이 0이고 message result가 finalized여도 open fallback reservation이 있으면 correction candidate로 선택한다.
- 2시간 final correction 후 fallback이 여전히 P이면 `result_finalized_at`만 설정하고 quota는 reserved로 남긴다.

## 14. Limit Increase Approval

승인 시 기존 동작대로 `sender_resources.quota_limit`를 갱신한다.

같은 승인 트랜잭션에서 아직 종료되지 않은 bucket도 갱신한다.

```text
UPDATE sender_resource_quota_buckets
SET quota_limit = requestedLimit
WHERE sender_resource_id = target
  AND period_end_at > now
```

- 문자 resource: 현재 월/미래 예약 월 bucket에 반영
- 카카오 resource: 알림톡/브랜드메시지의 현재 일/미래 예약 일 bucket에 모두 반영
- 과거 종료 bucket의 historical limit는 변경하지 않는다.
- 한도 상향만 지원하므로 consumed가 새 limit를 초과하는 감소 시나리오는 다루지 않는다.
- 승인 repository는 sender resource row를 먼저 잠그고 `requestedLimit > currentLimit`를 다시 확인한 뒤 resource와 bucket을 같은 transaction에서 갱신한다.
- reserve transaction과 같은 resource-before-bucket lock order를 사용한다.

## 15. API and UI Contract

### 15.1 Quota error

새 relay error code를 추가한다.

```text
SENDER_RESOURCE_QUOTA_EXCEEDED
HTTP 429
source = relay
retryable = false
```

기본 사용자 메시지:

```text
발송 가능한 한도가 부족합니다. 발신수단 관리에서 한도를 확인하거나 상향 신청해 주세요.
```

fallback SMS quota가 부족한 경우:

```text
문자 대체발송에 사용할 발신번호의 월 한도가 부족합니다.
```

quota 부족 응답에는 recipient number, content, grouping key 또는 provider payload를 포함하지 않는다.

### 15.2 Success response compatibility

기존 성공 응답 shape는 변경하지 않는다.

- direct: 기존 send result 유지
- bulk create: 기존 `202`와 run DTO 유지
- unknown: 기존 `unknown_after_provider_call` 유지
- reservation cancel: 기존 DTO 유지
- limit increase: 기존 DTO 유지

### 15.3 Settings UI

- 문자 발신번호: `월 1,000건`
- 카카오 채널: 한 줄로 `일 1,000건`
- 카카오 카드 안에서 알림톡/브랜드메시지 한도 항목을 두 개로 나누지 않는다.
- section title은 `한도 상향 신청`으로 하고 `내역` 단어는 쓰지 않는다.
- 신청 목록은 자동화 화면의 data table과 같은 밀도·toolbar·row 상태 스타일을 사용한다.
- CTA label은 `상향신청`이며 `자동화 추가`와 같은 primary action 크기/아이콘 스타일로 table toolbar에 배치한다.
- sender resource 카드 상단에는 별도 상향 버튼을 중복 배치하지 않는다.
- quota 사용량 상세 UI는 이번 구현 범위에 추가하지 않는다.
- 내부 `reserved` 수량은 API/UI에 별도 필드나 라벨로 노출하지 않는다. 메트릭에는 `consumed + reserved` 합계만 `한도 반영` 수량으로 제공한다.
- quota error toast는 위 사용자 메시지를 보여준다.

## 16. Migration and Backfill

### 16.1 Migration strategy

현재 baseline은 `drizzle/0020_fresh_captain_cross.sql` 이후다.

다음 migration은 destructive rename/drop을 한 번에 하지 않는다.

1. 새 enum과 `sender_resource_quota_*` 테이블 생성
2. `message_send_provider_requests.client_request_id` unique index 생성 전 중복 검사
3. open-period 로컬 원장 백필
4. 새 코드가 새 테이블만 사용하도록 배포
5. staging/production 검증
6. 기존 `sms_quota_*` 테이블은 별도 후속 migration에서 제거

기존 테이블을 즉시 drop하지 않는 이유는 rollback 가능성을 남기기 위해서다.

### 16.2 Duplicate client request preflight

unique index 생성 전에 다음을 검사한다.

```text
GROUP BY client_request_id HAVING COUNT(*) > 1
```

중복이 있으면 자동 삭제하지 않는다. 각 row의 group/provider 상태를 확인해 보존할 row를 결정한 뒤 migration을 진행한다.

### 16.3 Open-period backfill

NHN 전수 조회 없이 로컬 ledger만 사용한다.

백필 대상:

- 현재 KST 월의 SMS/LMS/MMS provider requests
- 현재 KST 일의 AlimTalk/Brand Message provider requests
- 미래 `scheduledAt`에 해당하는 provider requests
- 아직 pending/unknown인 open-period requests

primary reservation 계산:

```text
reservedCount = recipientCount
consumedCount = successCount
releasedCount = failedCount + canceledCount
remainingCount = recipientCount - consumedCount - releasedCount
```

명확한 rejected/failed-before-provider 요청은 모두 released 상태이므로 bucket aggregate에 영향을 주지 않는다. 필요하면 reservation row 자체를 생략할 수 있다.

기존 SMS bulk acceptance 기반 consumed count는 그대로 복사하지 않는다. `sms_bulk_send_batches.client_request_id`와 local provider request를 연결해 최종 snapshot counts로 다시 계산한다.

bucket aggregate는 새 reservation을 넣은 뒤 합계로 재계산한다.

### 16.4 Historical fallback limitation

현재 local ledger에는 과거 카카오 요청의 fallback SMS sender resource와 fallback result snapshot이 없다. 따라서 배포 이전 fallback 사용량은 로컬 데이터만으로 정확히 복구할 수 없다.

MVP 정책:

- 배포 이후 생성되는 fallback만 예약/집계한다.
- 과거 fallback을 위한 NHN 전수 스캔은 하지 않는다.
- 운영상 첫 기간의 완전한 연속성이 필수라면 별도 운영 작업으로 다루며 이번 구현에 섞지 않는다.

### 16.5 Cutover and rollback

백필과 새 quota enforcement 활성화 사이에 새 provider 발송이 끼면 집계에서 빠질 수 있다. MVP는 dual-write를 추가하지 않고 짧은 send gate와 기존 provider-request row lock으로 전환한다.

1. additive migration 적용
2. 직접 발송 ingress와 automation/bulk worker의 새 provider call 일시 중지
3. quota-aware send/result-merge 코드를 모든 app/worker instance에 배포
4. open-period backfill을 idempotent batch로 실행
5. aggregate invariant와 app/worker readiness 점검
6. send gate 해제 후 각 채널 controlled smoke test와 즉시 모니터링

필수 안전 조건은 2~5 사이 새 NHN provider call이 0건이고, 4 이전에 모든 result merge instance가 새 코드인 것이다. 이미 접수된 예약발송의 실행과 webhook/correction은 계속 허용한다.

backfill은 각 provider request를 기존 merge transaction과 같은 순서로 `FOR UPDATE` 잠근 뒤 현재 snapshot으로 missing reservation을 insert한다. 동시 result merge가 먼저 commit되면 backfill이 새 snapshot을 읽고, backfill이 먼저 잠그면 result merge가 기다렸다가 reservation 생성 후 delta를 적용한다. 따라서 raw webhook 재처리나 별도 webhook 저장소가 필요하지 않다. backfill batch가 끝날 때 bucket row를 잠그고 영향받은 bucket aggregate를 reservation 합계로 재계산·검증한다.

기존 `sms_quota_*` 테이블을 남기는 것은 schema rollback을 위한 것이며 traffic 이후의 자동 data rollback을 보장하지 않는다. 새 코드 활성화 뒤 rollback이 필요하면 send gate를 다시 닫고 새 quota reservation 기준으로 기존 bulk quota 상태를 재구성하거나 수정 배포를 먼저 적용한다. 상태 동기화 없이 구버전으로 되돌린 채 발송을 재개하지 않는다.

## 17. Privacy and Audit

새 quota 테이블에 저장 가능한 데이터:

- sender resource id
- local provider request id
- quota channel
- 기간 시작/종료
- limit/reserved/consumed/released counts
- compact P/S/F/C snapshot
- sync/finalized timestamps

저장 금지:

- recipient number
- message body/title/content
- template parameter
- fallback content
- grouping key
- raw NHN response/webhook payload

quota 부족과 unknown 상태는 기존 audit 경로로 기록한다. audit metadata에는 sender resource id, quota channel, 요청 건수, safe count만 포함할 수 있다.

quota history가 연결된 sender resource는 기존 soft-delete 방식을 유지한다. 영구 삭제가 필요하면 quota 보존기간과 anonymization 정책을 먼저 정한 뒤 별도 cleanup으로 처리하며 일반 발신수단 삭제 요청에서 cascade하지 않는다.

### 17.1 Operational checks

새 전용 worker는 만들지 않지만 다음 read-only 점검 SQL은 migration/runbook에 둔다.

- bucket `reserved_count`와 reservation remaining 합계 불일치
- bucket `consumed_count`와 reservation consumed 합계 불일치
- `sending`/`unknown` 상태로 오래 남은 provider request와 open reservation
- final correction 이후에도 remaining이 있는 reservation
- `reserved_count + consumed_count > quota_limit`인 authoritative correction 초과 bucket

애플리케이션 로그에는 `clientRequestId`, local provider request id, sender resource id, quota channel, period, count만 남긴다. sender resource id를 metrics label로 사용해 고카디널리티 시계열을 만들지는 않는다.

## 18. Test Specification

### 18.1 Period tests

- SMS 즉시 발송이 KST 현재 월 bucket을 선택한다.
- SMS 예약 발송이 `requestDate`의 미래 월 bucket을 선택한다.
- 월말 23:59와 다음 달 00:00이 서로 다른 bucket이다.
- Kakao 즉시 발송이 KST 현재 일 bucket을 선택한다.
- Kakao 예약 발송이 `requestDate`의 미래 일 bucket을 선택한다.
- AlimTalk과 Brand Message가 같은 resource/일자에서도 서로 다른 bucket이다.
- SMS/LMS/MMS가 같은 resource/월 bucket을 공유한다.
- 예약 발송 correction 시계가 row 생성 시각이 아니라 `effectiveAt` 이후 시작한다.

### 18.2 Atomic reserve tests

- available 1,000에서 1,000 예약 성공
- 추가 1건 예약 실패, provider call 0회
- reserved 400 + consumed 500 상태에서 100 성공, 101 실패
- 서로 다른 sender resource는 독립
- concurrent reserve 두 건의 합이 limit를 넘지 않음
- fallback primary 성공/SMS 실패 시 전체 transaction rollback
- duplicate `clientRequestId`가 bucket count를 늘리지 않음

### 18.3 Provider outcome tests

- accepted response가 quota를 consume하지 않음
- provider 4xx rejection이 reservation을 release
- provider 429가 reservation을 release하고 자동 재시도하지 않음
- timeout/network disconnect가 reservation을 유지
- ambiguous 5xx가 reservation을 유지
- success response without request id가 unknown/reserved
- provider success 후 local update 실패가 reservation을 유지
- provider 동기 응답의 일부 수신자 명시 거절만 즉시 release

### 18.4 Webhook/poller settlement tests

- P→S: reserved 감소, consumed 증가
- P→F: reserved 감소, consumed 변화 없음
- P→C: reserved 감소, consumed 변화 없음
- mixed S/F/P 결과의 aggregate 정합성
- 동일 webhook 두 번 처리 시 두 번째 delta 0
- webhook과 poller 동시 merge에서 중복 소비 없음
- authoritative S→F 보정
- authoritative F→S 보정
- F→S로 bucket이 limit 초과해도 정정 성공, 이후 신규 reserve 실패
- correction으로 reservation이 reopen되면 `settled_at`이 null로 돌아감
- final correction 후 P는 reserved 유지
- late webhook이 finalized request의 P를 정산

### 18.5 Bulk tests

- run/batches/ledger/reservations가 한 transaction에서 생성
- 전체 quota 부족 시 관련 row가 하나도 생성되지 않음
- accepted batch가 consume하지 않음
- batch final success만 consume
- definite failed batch와 unsent later batches만 release
- unknown batch는 유지하고 later unsent batches만 release
- scheduled run이 미래 월 bucket 사용

### 18.6 Automation tests

- 자동화가 일반 발송 quota 경로 사용
- 같은 delivery 재시도에서 NHN 호출/예약 중복 없음
- quota 부족 시 delivery `unsent`, reason `quota_exceeded`
- 다음 기간 또는 상향 후 unsent retry 성공

### 18.7 Cancellation and resend tests

- SMS 예약 전체 취소가 C snapshot 및 release 반영
- partial ambiguous cancellation이 확인되지 않은 수량을 해제하지 않음
- SMS/LMS/MMS resend가 새 quota 예약
- raw AlimTalk resend가 새 quota 예약
- original request quota는 resend로 변경되지 않음

### 18.8 Fallback tests

- fallback-enabled Kakao send가 Kakao + SMS 두 reservation 생성
- SMS quota 부족 시 NHN Kakao 호출 없음
- primary S가 Kakao consume, pending fallback release
- primary F가 Kakao release, fallback reserved 유지
- RSC04가 SMS consume
- RSC05/RSC01이 SMS release
- duplicate fallback poll delta 0
- primary S→F correction이 `PRIMARY_SUCCESS` fallback만 P로 reopen
- provider terminal fallback 상태는 primary correction만으로 reopen하지 않음
- primary finalized 후에도 open fallback이 correction candidate
- fallback final correction 후 미확인 P는 reserved 유지

### 18.9 Migration/schema tests

- 새 table/enum/column/index/constraint 존재
- bucket에 `user_id`가 없음
- reservation 합계 check 존재
- provider `client_request_id` unique
- provider request hard delete 시 reservation은 남고 FK만 null
- forbidden recipient/content columns가 없음
- open-period backfill aggregate가 snapshot counts와 일치
- webhook merge와 backfill의 양쪽 race order에서 최종 aggregate가 동일

### 18.10 Limit increase and UI tests

- 승인 transaction이 sender resource와 active/future bucket을 같은 값으로 갱신
- SMS 상향이 해당 발신번호 bucket에만 반영
- Kakao 상향이 같은 채널의 AlimTalk/Brand Message bucket에 모두 반영
- 종료된 historical bucket limit는 유지
- stale reserve descriptor가 상향된 bucket limit를 낮추지 않음
- settings Kakao card는 `일 N건` 한 줄만 표시
- 상향신청 버튼은 신청 table 상단에만 존재
- quota 429 error가 안전한 사용자 toast로 매핑

## 19. Verification Commands

구현 완료 전 최소 검증:

```bash
npm run test:server
npm run test:settings-usage-contract
npm run test:message-log-detail-resend-content-contract
npm run test:metrics-console-contract
npm run db:migration:verify
npm run db:migration:check
npm run lint
npm run build
```

DB 자격증명이 필요한 migration check/apply는 staging migration URL로 별도 검증한다.

## 20. Implementation Order

### Expected change map

최종 함수 배치가 기존 경계에 맞춰 조금 달라질 수는 있지만 예상 변경 범위는 아래와 같다.

| Area | Primary files | Responsibility |
| --- | --- | --- |
| Schema/migration | `src/db/schema.js`, `drizzle/0021_*.sql`, `drizzle/0022_*.sql`, `drizzle/meta/*` | enum, bucket/reservation, unique/FK/check, additive migration and legacy rollback guard |
| Quota rules | new `src/server/messages/quota.js` | channel mapping, KST period, available/settlement pure functions |
| Send ledger | `src/server/messages/repository.js`, `src/server/messages/service.js` | atomic prepare/reserve, outcome classification, direct/bulk flow |
| Result settlement | `src/server/messageLogs/repository.js`, `src/server/messageLogs/service.js`, `scripts/worker.js` | shared snapshot merge, primary/fallback settle, correction eligibility |
| Webhooks | `src/server/nhn/smsWebhookReceiver.js`, `src/server/nhn/kakaoBizmessageWebhookReceiver.js` | existing merge path에 필요한 result metadata 전달 |
| Automation/resend/cancel | `src/server/automations/service.js`, `src/server/messageLogs/service.js`, `src/server/messageReservations/service.js` | common send path, quota reason, C merge |
| Limit/metrics | `src/server/limitIncreaseRequests/repository.js`, `src/server/metrics/repository.js` | active bucket limit update, new bucket aggregate reads |
| API/error/UI | `src/server/relay/constants.js`, `src/server/relay/errors.js`, `src/features/console/messageSend/statusToast.js`, `src/features/console/settings/UsageSettingsContent.jsx` | stable 429 error, toast, Kakao 한 줄 한도 표시 |
| Tests/docs | `src/server/__tests__/*`, contract tests, `docs/NHN_RELAY_SERVER_DESIGN.md` | concurrency, all send paths, old design wording replacement |

`src/ui-kits/resend`는 생성 코드 경계이므로 직접 수정하지 않는다. 새 범용 상태관리 라이브러리, quota 전용 queue/worker, 수신자별 DB row도 추가하지 않는다.

### Phase 1: Schema and pure quota rules

- enum/table/index/check 추가
- KST period helpers 추가
- quota channel mapping 추가
- atomic reserve/settle repository primitives 추가
- schema/period/concurrency tests

### Phase 2: Direct, automation, resend

- provider 호출 전 ledger/quota preparation
- provider outcome classification 분리
- client request idempotency
- automation quota reason
- resend 공통 send service 연결

### Phase 3: Bulk

- run/batch/ledger/reservation 단일 transaction
- acceptance consumption 제거
- failed/unknown별 정확한 release
- bulk tests 갱신

### Phase 4: Webhook, correction, cancel, fallback

- snapshot merge transaction 안에서 primary quota 정산
- fallback compact snapshot/폴러 병합
- open fallback correction eligibility
- SMS reservation cancel C merge
- webhook/poller/fallback tests

### Phase 5: Migration, UI, docs, rollout

- migration 생성/검토
- open-period backfill
- settings Kakao limit 한 줄 표시
- quota error toast
- metrics repository의 새 bucket table 연결
- 기존 설계 문서의 `per-user`, `consume on acceptance`, `Kakao out of scope` 문구 수정
- staging migration 및 전체 acceptance 실행

## 21. Definition of Done

다음 조건을 모두 만족해야 완료다.

- 모든 in-scope 발송 경로가 NHN 호출 전에 quota를 예약한다.
- quota 부족 시 NHN 호출이 발생하지 않는다.
- provider acceptance만으로 consumed가 증가하지 않는다.
- 최종 성공만 consumed를 증가시킨다.
- 실패/취소/명확한 거절은 정확한 수량만 release한다.
- pending/unknown은 자동 해제되지 않는다.
- duplicate webhook/poller/automation retry가 중복 집계 또는 중복 발송을 만들지 않는다.
- SMS/LMS/MMS는 발신번호별 월 quota를 공유한다.
- AlimTalk/Brand Message는 카카오 채널별 일 quota를 각각 사용하며 한도 설정값은 함께 오른다.
- scheduled sends는 `requestDate` 기간을 사용한다.
- fallback SMS 성공이 SMS quota에 포함된다.
- 새 DB 구조에 recipient/content/provider raw payload가 저장되지 않는다.
- migration 검증, server tests, lint, build가 모두 통과한다.
