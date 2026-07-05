# NHN SMS 및 KakaoTalk Bizmessage API 목록

확인 기준일: 2026-05-27

이 문서는 NHN Cloud 공식 문서 기준으로 SMS와 KakaoTalk Bizmessage 관련 API를 제품/기능별로 리스트업한다. 코드베이스에서 현재 호출 중인 API 목록이 아니라, NHN 문서에 제공되는 관련 API 전체 목록을 정리한 것이다.

## 범위와 출처

| 제품 | 공식 문서 | API 도메인 |
| --- | --- | --- |
| SMS API v3.0 | [SMS API v3.0 가이드](https://docs.nhncloud.com/ko/Notification/SMS/ko/api-guide/) | `https://sms.api.nhncloudservice.com` |
| KakaoTalk Bizmessage Sender API v2.3 | [Sender API v2.3 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/sender-api-guide-v2.3/) | `https://kakaotalk-bizmessage.api.nhncloudservice.com` |
| KakaoTalk Bizmessage 알림톡 API v2.3 | [알림톡 API v2.3 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/alimtalk-api-guide/) | `https://kakaotalk-bizmessage.api.nhncloudservice.com` |
| KakaoTalk Bizmessage 브랜드 메시지 API v1.0 | [브랜드 메시지 API v1.0 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/friendtalkupgrade-api-guide/) | `https://kakaotalk-bizmessage.api.nhncloudservice.com` |
| KakaoTalk Bizmessage 친구톡 API v2.3 | [친구톡 API v2.3 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/friendtalk-api-guide-v2.3/) | `https://kakaotalk-bizmessage.api.nhncloudservice.com` |
| KakaoTalk Bizmessage Webhook | [Webhook API 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/webhook-api-guide/) | 고객 등록 URL |
| 친구톡 브랜드 메시지 전환 | [브랜드 메시지 전환 가이드](https://docs.nhncloud.com/ko/Notification/KakaoTalk%20Bizmessage/ko/friendtalk-compatible-api-guide/) | - |

## API 도메인 전환 공지

NHN Cloud 공지 기준으로 Notification 카테고리 내 Email, KakaoTalk Bizmessage, Push, SMS 서비스의 이전 API 도메인 지원 종료 일정이 2026-06-01 10:00(UTC+09:00)에서 2026-09-01 10:00(UTC+09:00)로 연기되었다. 이 문서는 SMS와 KakaoTalk Bizmessage만 다루므로 관련 신규 도메인만 정리한다.

| 서비스 | 신규 API 도메인 |
| --- | --- |
| KakaoTalk Bizmessage | `https://kakaotalk-bizmessage.api.nhncloudservice.com` |
| SMS | `https://sms.api.nhncloudservice.com` |

운영 참고:

- 신규 API 도메인은 2026-03-03부터 사용 가능하며, 2026-09-01 10:00(UTC+09:00) 전까지 신규 도메인으로 전환해야 한다.
- 지원 종료 이후 이전 도메인을 통해 API를 호출하면 실패할 수 있다.
- 별도 방화벽(Network ACL)으로 접근을 제어하는 경우 신규 도메인의 VIP에 대한 정책 설정이 필요하다.
- 공지에서 안내한 신규 API 도메인 VIP는 `180.210.64.24`, `180.210.65.24`, `180.210.64.224`, `180.210.65.224`, `117.52.123.41`이다.
- 신규 API 도메인의 API 요청 제한은 300RPS이며, 초과 시 HTTP `429 Too Many Requests` 응답을 받을 수 있다. `429` 응답 시 일정 시간 대기 후 재시도해야 한다.

친구톡은 공식 문서상 2025-12-31 서비스 종료 안내가 있으며, 문서에서는 브랜드 메시지 자유형 발송 API로 전환할 것을 권장한다. 기존 친구톡 API는 레거시/호환 관점에서 함께 정리한다.

## 공통 인증

| 제품 | 인증 헤더 | 비고 |
| --- | --- | --- |
| SMS | `X-Secret-Key` | 콘솔에서 발급한 SMS Secret Key |
| Sender/알림톡/브랜드 메시지/친구톡 | `X-Secret-Key` | 콘솔에서 발급한 KakaoTalk Bizmessage Secret Key |
| 발송 중복 방지 | `X-NC-API-IDEMPOTENCY-KEY` | 일부 발송 API에서 동일 키 중복 요청 방지에 사용 |

응답은 대체로 `header.resultCode`, `header.resultMessage`, `header.isSuccessful`을 포함한다.

## SMS API v3.0

### 단문 SMS

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 단문 SMS 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/sms` | SMS 발송 요청. 템플릿 발송도 이 발송 API를 사용할 수 있다. |
| 단문 SMS 발송 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/sender/sms` | 기간, 요청 ID, 발신/수신 번호 등으로 SMS 발송 목록 조회. |
| 단문 SMS 발송 단일 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/sender/sms/{requestId}` | `requestId`, `recipientSeq` 기준 단일 SMS 결과 조회. |
| 단문 SMS 국제 발송 전환 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/sms/do-convert` | 국내 SMS 발송 요청을 국제 발송으로 전환. |

### 장문 MMS

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 장문 MMS 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/mms` | 첨부 파일 미포함 장문 또는 첨부 파일 포함 MMS 발송. |
| 장문 MMS 발송 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/sender/mms` | MMS 발송 목록 조회. |
| 장문 MMS 발송 단일 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/sender/mms/{requestId}` | `requestId`, `recipientSeq` 기준 단일 MMS 결과 조회. |

### 인증용 SMS

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 인증용 SMS 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/auth/sms` | 인증/긴급 목적 SMS 발송. |
| 인증용 SMS 발송 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/sender/auth/sms` | 인증용 SMS 발송 목록 조회. |
| 인증용 SMS 발송 단일 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/sender/auth/sms/{requestId}` | `requestId`, `recipientSeq` 기준 인증용 SMS 결과 조회. |
| 인증 SMS 국제 발송 전환 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/auth/sms/do-convert` | 인증 SMS를 국제 발송으로 전환. |

### 광고 문자

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 광고성 SMS 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/ad-sms` | 광고 표기/수신거부 정보를 포함한 SMS 발송. |
| 광고성 MMS 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/ad-mms` | 광고 표기/수신거부 정보를 포함한 MMS 발송. |
| 광고 SMS 국제 발송 전환 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/sms/do-convert` | 문서상 광고 SMS 국제 발송 전환에도 동일 전환 API 사용. |

### 결과 조회와 대량 발송 조회

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 결과 업데이트 기준 메시지 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/message-results` | `startUpdateDate`, `endUpdateDate`, `messageType`, 페이지 조건으로 결과 업데이트 목록 조회. |
| 대량 발송 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/mass-sender` | 대량 발송 요청 목록 조회. |
| 대량 발송 수신자 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/mass-sender/receive/{requestId}` | 대량 발송 요청의 수신자 목록 조회. |
| 대량 발송 수신자 목록 상세 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/mass-sender/receive/{requestId}/{recipientSeq}` | 대량 발송 수신자 단건 상세 조회. |

### 태그 발송

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 태그 SMS 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/tag-sender/sms` | UID/태그 기반 SMS 발송. |
| 태그 LMS 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/tag-sender/mms` | UID/태그 기반 장문 발송. |
| 태그 발송 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/tag-sender` | 태그 발송 요청 목록 조회. |
| 태그 발송 수신자 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/tag-sender/{requestId}` | 태그 발송 수신자 목록 조회. |
| 태그 발송 수신자 상세 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/tag-sender/{requestId}/{recipientSeq}` | 태그 발송 수신자 단건 상세 조회. |

### 첨부 파일

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 첨부 파일 업로드 | `POST` | `/sms/v3.0/appKeys/{appKey}/attachfile/binaryUpload` | MMS 첨부 파일을 Base64로 업로드하고 파일 ID를 받는다. |

### 카테고리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 카테고리 등록 | `POST` | `/sms/v3.0/appKeys/{appKey}/categories` | 템플릿 카테고리 등록. |
| 카테고리 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/categories` | 카테고리 목록 조회. |
| 카테고리 단건 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/categories/{categoryId}` | 카테고리 상세 조회. |
| 카테고리 수정 | `PUT` | `/sms/v3.0/appKeys/{appKey}/categories/{categoryId}` | 카테고리 수정. |
| 카테고리 삭제 | `DELETE` | `/sms/v3.0/appKeys/{appKey}/categories/{categoryId}` | 카테고리 삭제. |

### 템플릿

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 템플릿 등록 | `POST` | `/sms/v3.0/appKeys/{appKey}/templates` | SMS/MMS 템플릿 등록. |
| 템플릿 발송 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/sms` 또는 `/sender/mms` | 본문 수정 여부와 메시지 타입에 따라 발송 API에서 템플릿 ID/치환 값을 사용. 별도 템플릿 발송 전용 엔드포인트는 없다. |
| 템플릿 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/templates` | 템플릿 목록 조회. |
| 템플릿 단일 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/templates/{templateId}` | 템플릿 상세 조회. |
| 템플릿 수정 | `PUT` | `/sms/v3.0/appKeys/{appKey}/templates/{templateId}` | 템플릿 수정. |
| 템플릿 삭제 | `DELETE` | `/sms/v3.0/appKeys/{appKey}/templates/{templateId}` | 템플릿 삭제. |

### 080 수신 거부 서비스

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 수신 거부 번호 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/blockservice/unsubscribe-nos` | 080 수신거부 번호 목록 조회. |
| 수신 거부 번호 단일 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/blockservice/unsubscribe-nos/{unsubscribeNo}` | 080 수신거부 번호 상세 조회. |
| 수신 거부 대상자 등록 | `POST` | `/sms/v3.0/appKeys/{appKey}/blockservice/recipients` | 수신거부 대상 번호 등록. |
| 수신 거부 대상자 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/blockservice/recipients` | 수신거부 대상자 목록 조회. |
| 수신 거부 대상자 삭제 | `DELETE` | `/sms/v3.0/appKeys/{appKey}/blockservice/recipients/removes` | `unsubscribeNo`, `updateUser`, `recipientNoList` 조건으로 수신거부 대상자 삭제. |

### 발신 번호

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 등록된 발신 번호 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/sendNos` | 발신 번호, 사용 여부, 차단 여부, 페이지 조건으로 등록 발신 번호 목록 조회. |

### 통계

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 통계 검색 - 이벤트 기반 | `GET` | `/sms/v3.0/appKeys/{appKey}/stats` | 이벤트 발생 시간 기준 통계 조회. |
| 통계 검색 - 요청 시간 기반 | `GET` | `/sms/v3.0/appKeys/{appKey}/stats/legacy` | 발송 요청 시간 기준 통계 조회. |
| 통계 검색 - 국제 발송 | `GET` | `/sms/v3.0/appKeys/{appKey}/stats/international` | 국제 발송 통계 조회. |
| 구 통합 통계 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/statistics/view` | 구 통합 통계 조회. |

### 예약 발송

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 예약 발송 목록 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/reservations` | 예약 발송 목록 조회. |
| 예약 발송 상세 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/reservations/{requestId}/{recipientSeq}` | 예약 발송 수신자 상세 조회. |
| 예약 발송 취소 | `PUT` | `/sms/v3.0/appKeys/{appKey}/reservations/cancel` | 예약 발송 취소. |
| 예약 발송 취소 - 다중 필터 | `PUT` | `/sms/v3.0/appKeys/{appKey}/reservations/search-cancels` | 다중 필터 조건으로 예약 발송 취소. |
| 예약 발송 취소 요청 목록 검색 - 다중 필터 | `GET` | `/sms/v3.0/appKeys/{appKey}/reservations/search-cancels` | 예약 발송 취소 요청 목록 조회. |

### 발송 결과 파일 다운로드

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 검색 파일 생성 요청 | `POST` | `/sms/v3.0/appKeys/{appKey}/sender/download-reservations` | 발송 결과 검색 파일 생성 요청. |
| 발송 결과 파일 생성 요청 내역 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/download-reservations` | 파일 생성 요청 내역 조회. |
| 발송 결과 파일 다운로드 요청 | `GET` | `/sms/v3.0/appKeys/{appKey}/download-reservations/{downloadId}/download` | 생성된 파일 다운로드. |

### 태그 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 태그 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/tags` | 태그 목록 조회. |
| 태그 등록 | `POST` | `/sms/v3.0/appKeys/{appKey}/tags` | 태그 등록. |
| 태그 수정 | `PUT` | `/sms/v3.0/appKeys/{appKey}/tags/{tagId}` | 태그 수정. |
| 태그 삭제 | `DELETE` | `/sms/v3.0/appKeys/{appKey}/tags/{tagId}` | 태그 삭제. |

### UID 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| UID 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/uids` | 조건, offset, limit 기반 UID 목록 조회. |
| UID 단건 검색 | `GET` | `/sms/v3.0/appKeys/{appKey}/uids/{uid}` | UID 상세 조회. |
| UID 등록 | `POST` | `/sms/v3.0/appKeys/{appKey}/uids` | UID 등록. |
| UID 삭제 | `DELETE` | `/sms/v3.0/appKeys/{appKey}/uids/{uid}` | UID 삭제. |
| UID 휴대폰 번호 등록 | `POST` | `/sms/v3.0/appKeys/{appKey}/uids/{uid}/phone-numbers` | UID에 휴대폰 번호 연결. |
| UID 휴대폰 번호 삭제 | `DELETE` | `/sms/v3.0/appKeys/{appKey}/uids/{uid}/phone-numbers/{phoneNumber}` | UID의 휴대폰 번호 연결 삭제. |

## KakaoTalk Bizmessage Sender API v2.3

### 발신 프로필

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 발신 프로필 카테고리 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/sender/categories` | 발신 프로필 등록에 사용할 카테고리 조회. |
| 발신 프로필 등록 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/senders` | 카카오톡 채널 발신 프로필 등록 요청. |
| 발신 프로필 토큰 인증 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/sender/token` | 발신 프로필 등록 토큰 인증. |
| 발신 프로필 삭제 | `DELETE` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}` | 발신 프로필 삭제. |
| 발신 프로필 단건 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}` | 발신 프로필 상세 조회. |
| 발신 프로필 리스트 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/senders` | 발신 프로필 목록 조회. |

### 발신 프로필 그룹

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 발신 프로필 그룹 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/sender-groups/{groupSenderKey}` | 발신 프로필 그룹 조회. |
| 그룹에 발신 프로필 추가 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/sender-groups/{groupSenderKey}/senders/{senderKey}` | 그룹에 발신 프로필 추가. |
| 그룹에 발신 프로필 삭제 | `DELETE` | `/alimtalk/v2.3/appkeys/{appkey}/sender-groups/{groupSenderKey}/senders/{senderKey}` | 그룹에서 발신 프로필 삭제. |

## KakaoTalk Bizmessage 알림톡 API v2.3

### 일반 메시지

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 메시지 치환 발송 요청 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/messages` | 승인 템플릿과 치환 값을 사용해 일반 알림톡 발송. |
| 메시지 전문 발송 요청 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/raw-messages` | 수신자별 본문/버튼 전문을 직접 구성해 발송. |
| 메시지 리스트 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/messages` | 일반 알림톡 발송 목록 조회. |
| 메시지 단건 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/messages/{requestId}/{recipientSeq}` | 일반 알림톡 단건 결과 조회. |

### 인증 메시지

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 메시지 치환 발송 요청 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/auth/messages` | 인증 알림톡 치환 발송. |
| 메시지 전문 발송 요청 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/auth/raw-messages` | 인증 알림톡 전문 발송. |
| 메시지 리스트 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/auth/messages` | 인증 알림톡 목록 조회. |
| 메시지 단건 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/auth/messages/{requestId}/{recipientSeq}` | 인증 알림톡 단건 조회. |

### 메시지 관리와 결과 업데이트

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 메시지 발송 취소 | `DELETE` | `/alimtalk/v2.3/appkeys/{appkey}/messages/{requestId}` | 예약/발송 요청 취소. |
| 메시지 결과 업데이트 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/message-results` | 결과 업데이트 목록 조회. |
| 메시지 결과 업데이트 건수 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/message-results/count` | 결과 업데이트 건수 조회. |

### 대량 발송 조회

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 대량 발송 요청 목록 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appKey}/mass-messages` | 대량 발송 요청 목록 조회. |
| 대량 발송 수신자 목록 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appKey}/mass-messages/{requestId}/recipients` | 대량 발송 수신자 목록 조회. |
| 대량 발송 수신자 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appKey}/mass-messages/{requestId}/recipients/{recipientSeq}` | 대량 발송 수신자 단건 조회. |

### 템플릿

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 템플릿 카테고리 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/template/categories` | 알림톡 템플릿 카테고리 조회. |
| 템플릿 등록 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates` | 알림톡 템플릿 등록/검수 요청. |
| 템플릿 수정 | `PUT` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}` | 템플릿 수정. |
| 템플릿 삭제 | `DELETE` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}` | 템플릿 삭제. |
| 템플릿 문의하기 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}/comments` | 템플릿 심사/상태 관련 문의 등록. |
| 파일 첨부 템플릿 문의하기 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}/comments_file` | 파일 첨부 템플릿 문의 등록. |
| 템플릿 채널 추가형으로 변경 | `PUT` | `/alimtalk/v2.3/appkeys/{appKey}/senders/{senderKey}/templates/{templateCode}/convert-add-channel` | 기존 템플릿을 채널 추가형으로 변경. |
| 템플릿 단건 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}` | 템플릿 상세 조회. |
| 템플릿 리스트 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates` | 템플릿 목록 조회. |
| 템플릿 수정 리스트 조회 | `GET` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}/modifications` | 템플릿 수정 이력 목록 조회. |
| 템플릿 이미지 등록 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/template-image` | 이미지형 템플릿 이미지 업로드. |
| 템플릿 아이템 하이라이트 이미지 등록 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/template-image/item-highlight` | 아이템 하이라이트 이미지 업로드. |
| 템플릿 플러그인 등록 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/plugins` | 알림톡 플러그인 등록. |
| 템플릿 플러그인 수정 | `PUT` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/plugins/{pluginId}` | 플러그인 수정. |
| 템플릿 플러그인 삭제 | `DELETE` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/plugins/{pluginId}` | 플러그인 삭제. |
| 템플릿 플러그인 조회 | `PUT` | `/alimtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/plugins` | 공식 문서 표기 기준 플러그인 조회 API. |

### 대체 발송 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| SMS AppKey 등록 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/failback/appkey` | 알림톡 대체 발송에 사용할 SMS AppKey 등록. |
| 대체 발송 설정 등록 | `POST` | `/alimtalk/v2.3/appkeys/{appkey}/failback` | 발신 프로필별 대체 발송 설정 등록. |

## KakaoTalk Bizmessage 브랜드 메시지 API v1.0

### 비친구 메시지 발송 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 마케팅 수신동의 증적 자료 업로드 | `POST` | `/brand-message/v1.0/appkeys/{appKey}/senders/{senderKey}/upload-marketing-agreement` | 타겟팅 `M`, `N` 사용을 위한 마케팅 수신동의 증적 자료 업로드. |
| 비친구 메시지 발송 사용 신청 | `POST` | `/brand-message/v1.0/appkeys/{appKey}/senders/{senderKey}/marketing-agreement` | 비친구 메시지 발송 권한 신청. |

### 메시지 발송과 조회

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 메시지 자유형 발송 요청 | `POST` | `/brand-message/v1.0/appkeys/{appkey}/freestyle-messages` | 템플릿 없이 자유형 브랜드 메시지 발송. 텍스트, 이미지, 와이드 이미지, 와이드 아이템리스트, 프리미엄 동영상, 커머스, 캐러셀 피드, 캐러셀 커머스 유형 포함. |
| 메시지 기본형 발송 요청 | `POST` | `/brand-message/v1.0/appkeys/{appkey}/basic-messages` | 등록된 브랜드 메시지 템플릿으로 발송. |
| 발송 목록 조회 | `GET` | `/brand-message/v1.0/appkeys/{appkey}/messages` | 브랜드 메시지 발송 목록 조회. |
| 발송 단건 조회 | `GET` | `/brand-message/v1.0/appkeys/{appkey}/messages/{requestId}/{recipientSeq}` | 브랜드 메시지 수신자 단건 조회. |
| 메시지 발송 취소 | `DELETE` | `/brand-message/v1.0/appkeys/{appkey}/messages/{requestId}` | 예약/발송 요청 취소. |

### 템플릿 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 템플릿 리스트 조회 | `GET` | `/brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates` | 브랜드 메시지 템플릿 목록 조회. |
| 템플릿 단건 조회 | `GET` | `/brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}` | 브랜드 메시지 템플릿 상세 조회. |
| 템플릿 등록 | `POST` | `/brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates` | 텍스트, 이미지, 와이드 이미지, 와이드 아이템리스트, 프리미엄 동영상, 커머스, 캐러셀 피드, 캐러셀 커머스 템플릿 등록. |
| 템플릿 수정 | `PUT` | `/brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}` | 브랜드 메시지 템플릿 수정. |
| 템플릿 삭제 | `DELETE` | `/brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates/{templateCode}` | 브랜드 메시지 템플릿 삭제. |

### 이미지 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 이미지 업로드 | `POST` | `/brand-message/v1.0/appkeys/{appKey}/images` | 브랜드 메시지 이미지 업로드. |
| 이미지 조회 | `GET` | `/brand-message/v1.0/appkeys/{appKey}/images` | 업로드 이미지 조회. |
| 이미지 삭제 | `DELETE` | `/brand-message/v1.0/appkeys/{appKey}/images` | 업로드 이미지 삭제. |

### 업로드와 발신 프로필 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 비즈폼 키 업로드 | `POST` | `/brand-message/v1.0/appkeys/{appKey}/senders/{senderKey}/biz-form` | 카카오 비즈폼 ID를 업로드해 비즈폼 키를 받는다. |
| 발신 프로필 조회 | `GET` | `/brand-message/v1.0/appkeys/{appKey}/senders/{senderKey}` | 브랜드 메시지용 발신 프로필 조회. |
| 발신 프로필 080 수신거부번호 수정 | `PUT` | `/brand-message/v1.0/appkeys/{appKey}/senders/{senderKey}/unsubscribe-content` | 발신 프로필의 080 수신거부 정보 수정. |

### 대체 발송 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| SMS AppKey 등록 | `POST` | `/brand-message/v1.0/appkeys/{appkey}/failback/appkey` | 브랜드 메시지 대체 발송에 사용할 SMS AppKey 등록. |
| 대체 발송 설정 등록 | `POST` | `/brand-message/v1.0/appkeys/{appkey}/failback` | 브랜드 메시지 대체 발송 설정 등록. |

## KakaoTalk Bizmessage Webhook

| 이벤트 | Method | Target URL | 설명 |
| --- | --- | --- | --- |
| 메시지 발송 결과 코드 업데이트 | `POST` | 고객이 등록한 URL | `MESSAGE_RESULT_UPDATE` 이벤트. 결과 hook에는 `kakaoMessageType`, `requestId`, `recipientSeq`, `resultCode`, `senderGroupingKey`, `recipientGroupingKey`, `_links` 등이 포함된다. |

현재 릴레이에서 결과 스냅샷 대상으로 사용하는 hook 타입은
`ALIMTALK_NORMAL`과 `BRAND_MESSAGE_NORMAL`이다. `ALIMTALK_AUTH`,
`ALIMTALK_MASS`, `FRIENDTALK_NORMAL`, `FRIENDTALK_MASS`,
`BRAND_MESSAGE_MASS`는 해당 발송 흐름이 명시적으로 추가되기 전까지
무시한다.

릴레이 수신 URL은 `/api/nhn/webhooks/kakao-bizmessage`이고, NHN 콘솔의
Webhook 서명 값은 `NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE`와 동일해야
한다. 문서 기준 서명 헤더는 `X-Toast-Webhook-Signature`이며, 릴레이는
SMS 수신기와의 운영 일관성을 위해 `X-Nhn-Webhook-Signature`도 허용한다.

## KakaoTalk Bizmessage 친구톡 API v2.3

친구톡은 공식 문서상 서비스 종료 안내가 있으므로 신규 구현은 브랜드 메시지 전환을 우선 검토한다. 아래 목록은 문서에 남아 있는 레거시/호환 API 기준이다.

### 메시지 발송과 조회

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 메시지 발송 | `POST` | `/friendtalk/v2.3/appkeys/{appkey}/messages` | 친구톡 메시지 발송. 텍스트, 이미지, 와이드 이미지, 와이드 아이템리스트, 캐러셀 피드 유형 포함. |
| 발송 목록 조회 | `GET` | `/friendtalk/v2.3/appkeys/{appkey}/messages` | 친구톡 발송 목록 조회. |
| 발송 단건 조회 | `GET` | `/friendtalk/v2.3/appkeys/{appkey}/messages/{requestId}/{recipientSeq}` | 친구톡 발송 수신자 단건 조회. |
| 메시지 발송 취소 | `DELETE` | `/friendtalk/v2.3/appkeys/{appkey}/messages/{requestId}` | 친구톡 발송 취소. |
| 메시지 결과 업데이트 조회 | `GET` | `/friendtalk/v2.3/appkeys/{appkey}/message-results` | 친구톡 결과 업데이트 조회. |

### 대량 발송 조회

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 대량 발송 요청 목록 조회 | `GET` | `/friendtalk/v2.3/appkeys/{appKey}/mass-messages` | 대량 친구톡 요청 목록 조회. |
| 대량 발송 수신자 목록 조회 | `GET` | `/friendtalk/v2.3/appkeys/{appKey}/mass-messages/{requestId}/recipients` | 대량 친구톡 수신자 목록 조회. |
| 대량 발송 수신자 조회 | `GET` | `/friendtalk/v2.3/appkeys/{appKey}/mass-messages/{requestId}/recipients/{recipientSeq}` | 대량 발송 수신자 단건 조회. |

### 이미지와 업로드

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| 이미지 등록 | `POST` | `/friendtalk/v2.3/appkeys/{appkey}/images` | 친구톡 이미지 등록. |
| 와이드 아이템 리스트 이미지 등록 | `POST` | `/friendtalk/v2.3/appkeys/{appkey}/wide-itemlist/images` | 친구톡 와이드 아이템 리스트 이미지 등록. |
| 캐러셀 이미지 등록 | `POST` | `/friendtalk/v2.3/appkeys/{appkey}/carousel/images` | 친구톡 캐러셀 이미지 등록. |
| 이미지 조회 | `GET` | `/friendtalk/v2.3/appkeys/{appkey}/images` | 친구톡 이미지 조회. |
| 이미지 삭제 | `DELETE` | `/friendtalk/v2.3/appkeys/{appkey}/images` | 친구톡 이미지 삭제. |
| 비즈니스폼 등록 | `POST` | `/friendtalk/v2.3/appkeys/{appkey}/senders/{senderKey}/biz-form` | 친구톡 비즈니스폼 등록. |

### 대체 발송 관리

| 기능 | Method | Path | 설명 |
| --- | --- | --- | --- |
| SMS 앱키 등록 | `POST` | `/friendtalk/v2.3/appkeys/{appkey}/failback/appkey` | 친구톡 대체 발송에 사용할 SMS AppKey 등록. |
| 대체 발송 설정 등록 | `POST` | `/friendtalk/v2.3/appkeys/{appkey}/failback` | 친구톡 대체 발송 설정 등록. |

## 빠른 범위 요약

| 영역 | 포함된 주요 기능 |
| --- | --- |
| SMS | SMS/MMS/인증/광고 발송, 국제 전환, 결과 조회, 대량 조회, 태그 발송, 첨부 파일, 카테고리, 템플릿, 080 수신거부, 발신 번호, 통계, 예약, 결과 파일 다운로드, 태그 관리, UID 관리 |
| Sender | 발신 프로필 카테고리, 발신 프로필 등록/인증/삭제/조회/목록, 발신 프로필 그룹 조회/추가/삭제 |
| 알림톡 | 일반/인증 메시지 발송, 원문 발송, 결과 조회, 취소, 대량 조회, 템플릿 등록/수정/삭제/문의/이미지/플러그인, 대체 발송 |
| 브랜드 메시지 | 비친구 발송 신청, 자유형/기본형 발송, 조회/취소, 템플릿 관리, 이미지 관리, 비즈폼 키, 발신 프로필 080 정보, 대체 발송 |
| 친구톡 | 레거시 메시지 발송/조회/취소, 대량 조회, 이미지 관리, 비즈니스폼, 대체 발송 |
