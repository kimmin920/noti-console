'use client';

import { useState } from 'react';
import { MessageSquare, Mail, Cpu, Activity, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import styles from './landing.module.css';

export function LandingConsolePreview() {
  const [activeTab, setActiveTab] = useState('kakao');

  return (
    <section className={styles.consoleSection} aria-label="noti 콘솔 미리보기">
      <div className={styles.container}>
        <div className={styles.consoleWindow}>
          {/* 윈도우 상단 바 */}
          <div className={styles.windowBar}>
            <div className={styles.windowDots}>
              <span className={`${styles.windowDot} ${styles.dotRed}`} />
              <span className={`${styles.windowDot} ${styles.dotYellow}`} />
              <span className={`${styles.windowDot} ${styles.dotGreen}`} />
            </div>
            <div className={styles.windowTitle}>
              noti console &mdash; https://home.vizuo.work/message-send
            </div>
            <div style={{ width: 40 }} />
          </div>

          {/* 탭 네비게이션 */}
          <div className={styles.windowTabRow}>
            <button
              type="button"
              className={`${styles.windowTab} ${activeTab === 'kakao' ? styles.windowTabActive : ''}`}
              onClick={() => setActiveTab('kakao')}
            >
              <MessageSquare size={14} />
              <span>카카오 알림톡 발송</span>
            </button>
            <button
              type="button"
              className={`${styles.windowTab} ${activeTab === 'sms' ? styles.windowTabActive : ''}`}
              onClick={() => setActiveTab('sms')}
            >
              <Mail size={14} />
              <span>SMS / LMS 대체 발송</span>
            </button>
            <button
              type="button"
              className={`${styles.windowTab} ${activeTab === 'automation' ? styles.windowTabActive : ''}`}
              onClick={() => setActiveTab('automation')}
            >
              <Cpu size={14} />
              <span>이벤트 자동화 트리거</span>
            </button>
            <button
              type="button"
              className={`${styles.windowTab} ${activeTab === 'logs' ? styles.windowTabActive : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <Activity size={14} />
              <span>실시간 감사 로그 (Audit Stream)</span>
            </button>
          </div>

          {/* 탭 내용 영역 */}
          <div className={styles.windowContentGrid}>
            {/* 좌측 콘솔 폼 시뮬레이터 */}
            <div className={styles.consoleLeftPane}>
              {activeTab === 'kakao' && (
                <>
                  <div className={styles.paneTitle}>
                    <span>알림톡 템플릿 발송 구성</span>
                    <span style={{ fontSize: 11, color: '#38bdf8' }}>카카오 비즈니스 공식 인증</span>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>발신 채널 프로필</label>
                    <div className={styles.fieldMockInput}>
                      <span>@vizuo_official (비주오 공식 알림)</span>
                      <span className={styles.varPill}>CHANNEL_KEY_VERIFIED</span>
                    </div>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>템플릿 코드</label>
                    <div className={styles.fieldMockInput}>
                      <span>ORDER_PAYMENT_CONFIRM_V2</span>
                      <span className={styles.varPill}>승인 완료 (Approved)</span>
                    </div>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>메시지 본문 (변수 자동 치환)</label>
                    <div className={styles.fieldMockTextarea}>
                      [비주오] 결제가 정상 완료되었습니다.{'\n'}
                      &bull; 고객명: <span className={styles.varPill}>#&#123;고객명&#125;</span>{'\n'}
                      &bull; 주문번호: <span className={styles.varPill}>#&#123;주문번호&#125;</span>{'\n'}
                      &bull; 결제금액: <span className={styles.varPill}>#&#123;결제금액&#125;</span>{'\n'}
                      &bull; 안내: 배송 준비 중이며 운송장 등록 시 알림을 보내드립니다.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#10b981' }}>
                    <ShieldCheck size={14} />
                    <span>알림톡 미수신 시 SMS(LMS) 자동 Fallback 발송 활성화됨</span>
                  </div>
                </>
              )}

              {activeTab === 'sms' && (
                <>
                  <div className={styles.paneTitle}>
                    <span>통신 3사 SMS/LMS 직접 발송</span>
                    <span style={{ fontSize: 11, color: '#10b981' }}>SKT / KT / LGU+ 직연동</span>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>사전등록 발신번호</label>
                    <div className={styles.fieldMockInput}>
                      <span>02-1588-0000 (통신서비스이용증명원 인증완료)</span>
                      <span className={styles.varPill}>KISA 검증필</span>
                    </div>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>메시지 유형</label>
                    <div className={styles.fieldMockInput}>
                      <span>LMS (장문 메시지 &middot; 최대 2,000 바이트)</span>
                      <span className={styles.varPill}>142 / 2000 Bytes</span>
                    </div>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>발송 페이로드 구성</label>
                    <div className={styles.fieldMockTextarea}>
                      [VIZUO 알림]{'\n'}
                      회원님의 계정 보안 설정이 성공적으로 업데이트되었습니다.{'\n'}
                      - 처리일시: 2026-10-08 18:30 KST{'\n'}
                      - 본인이 아닌 경우 고객센터(contact@vizuo.work)로 문의해 주세요.
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'automation' && (
                <>
                  <div className={styles.paneTitle}>
                    <span>웹훅 이벤트 파이프라인 트리거</span>
                    <span style={{ fontSize: 11, color: '#f59e0b' }}>실시간 이벤트 리스너</span>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>수신 트리거 이벤트</label>
                    <div className={styles.fieldMockInput}>
                      <span>order.payment.completed (Publ / Toss Payments)</span>
                      <span className={styles.varPill}>INCOMING WEBHOOK</span>
                    </div>
                  </div>

                  <div className={styles.formFieldGroup}>
                    <label className={styles.fieldLabel}>자동화 처리 룰 (Rule Graph)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className={styles.fieldMockInput}>
                        <span>Step 1: 페이로드 암호화 복호화 및 유효성 검증</span>
                        <Check size={14} color="#10b981" />
                      </div>
                      <div className={styles.fieldMockInput}>
                        <span>Step 2: 카카오 알림톡 우선 전송 (50ms)</span>
                        <Check size={14} color="#10b981" />
                      </div>
                      <div className={styles.fieldMockInput}>
                        <span>Step 3: 전송 실패 코드 감지 시 즉시 LMS 자동 대체 전송</span>
                        <Check size={14} color="#10b981" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'logs' && (
                <>
                  <div className={styles.paneTitle}>
                    <span>엔터프라이즈 감사 로그 &middot; 추적성 (Provenance)</span>
                    <span style={{ fontSize: 11, color: '#38bdf8' }}>실시간 스트림</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>
                    <div style={{ padding: '8px 12px', backgroundColor: '#131d2e', borderRadius: 6, border: '1px solid #23354e' }}>
                      <div style={{ color: '#10b981', display: 'flex', justifyContent: 'space-between' }}>
                        <span>[2026-10-08 18:28:44] REQ_94819_KAKAO</span>
                        <span>DELIVERED (200)</span>
                      </div>
                      <div style={{ color: '#94a3b8', marginTop: 4 }}>
                        to: 010-****-1234 | template: ORDER_PAYMENT_CONFIRM | latency: 118ms
                      </div>
                    </div>

                    <div style={{ padding: '8px 12px', backgroundColor: '#131d2e', borderRadius: 6, border: '1px solid #23354e' }}>
                      <div style={{ color: '#fbbf24', display: 'flex', justifyContent: 'space-between' }}>
                        <span>[2026-10-08 18:28:12] REQ_94818_FAILOVER</span>
                        <span>SMS_FALLBACK_OK (200)</span>
                      </div>
                      <div style={{ color: '#94a3b8', marginTop: 4 }}>
                        Kakao 3008 (친구아님/번호미존재) &rarr; SKT LMS 대체발송 완료 (164ms)
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 우측 스마트 뷰어 / 모바일 카카오톡 목업 */}
            <div className={styles.consoleRightPane}>
              <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                실제 수신자 화면 미리보기 (Live Device Preview)
              </div>

              <div className={styles.kakaoPhonePreview}>
                <div className={styles.kakaoBubble}>
                  <div className={styles.kakaoHeader}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: '#090d16', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                      N
                    </div>
                    <div className={styles.kakaoChannelName}>비주오 (VIZUO)</div>
                    <span className={styles.kakaoBadge}>알림톡</span>
                  </div>

                  <div className={styles.kakaoBody}>
                    <strong>[비주오] 결제 완료 안내</strong><br /><br />
                    홍길동 고객님, 주문하신 상품의 결제가 정상 완료되었습니다.<br /><br />
                    &bull; 주문번호: ORD-20261008-8831<br />
                    &bull; 결제금액: 45,000원<br />
                    &bull; 처리일시: 2026-10-08 18:25:00<br /><br />
                    영수증 및 주문 상세는 아래 버튼에서 확인하실 수 있습니다.
                  </div>

                  <div className={styles.kakaoButton}>
                    주문 내역 &amp; 영수증 보기
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                단일 API 호출 &rarr; 템플릿 자동 렌더링 &rarr; 실시간 수신 완료
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
