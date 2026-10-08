'use client';

import { Sparkles, Check, Terminal, Cpu, ShieldAlert, Bot } from 'lucide-react';
import styles from './landing.module.css';

export function LandingClaudeSection() {
  return (
    <section id="ai-engine" className={styles.claudeSection} aria-labelledby="claude-heading">
      <div className={styles.container}>
        <div className={styles.claudeBox}>
          {/* 좌측 설명 */}
          <div>
            <div className={styles.claudeBadgeRow}>
              <Sparkles size={13} aria-hidden="true" />
              <span>Anthropic Claude 3.7 &middot; Claude Code Powered</span>
            </div>

            <h3 id="claude-heading" className={styles.claudeH3}>
              Claude AI로 완성된<br />
              지능형 템플릿 &amp; 규제 검증 가드
            </h3>

            <p className={styles.claudeBodyText}>
              noti는 Anthropic의 최신 Claude 모델을 코어 아키텍처에 직접 결합하여, 
              단순한 텍스트 전송 파이프라인을 넘어 지능적으로 템플릿을 생성하고 
              법적 규제 및 스팸 위험을 실시간으로 사전 예방하는 AI 메시징 OS입니다.
            </p>

            <div className={styles.claudeFeaturesList}>
              <div className={styles.claudeItem}>
                <Bot size={18} className={styles.claudeItemIcon} aria-hidden="true" />
                <div className={styles.claudeItemText}>
                  <strong>AI 템플릿 자동 초안 생성:</strong> 비즈니스 목적(결제 완료, 배송 안내, 예약 확인)을 입력하면 
                  통신사 규격(90바이트/2,000바이트) 및 카카오 승인 가이드라인에 완벽히 부합하는 템플릿을 3초 만에 생성합니다.
                </div>
              </div>

              <div className={styles.claudeItem}>
                <ShieldAlert size={18} className={styles.claudeItemIcon} aria-hidden="true" />
                <div className={styles.claudeItemText}>
                  <strong>정보통신망법 컴플라이언스 가드:</strong> 광고성 메시지의 (광고) 필수 표기, 전송자 명칭, 
                  080 무료 수신거부 번호 누락 및 야간(20시~08시) 발송 제한 위반을 사전에 100% 감지하여 과태료 위험을 원천 차단합니다.
                </div>
              </div>

              <div className={styles.claudeItem}>
                <Cpu size={18} className={styles.claudeItemIcon} aria-hidden="true" />
                <div className={styles.claudeItemText}>
                  <strong>통신사 스팸 필터 사전 시뮬레이션:</strong> 이동통신 3사의 지능형 스팸 필터링 알고리즘을 
                  Claude가 사전 시뮬레이션하여 스팸함으로 오분류될 확률이 높은 단어를 안전한 비즈니스 용어로 자동 치환 추천합니다.
                </div>
              </div>
            </div>
          </div>

          {/* 우측 터미널 시뮬레이터 */}
          <div className={styles.claudeTerminal}>
            <div className={styles.terminalHeader}>
              <span>CLAUDE_COMPLIANCE_ENGINE.ts</span>
              <span>LIVE EVALUATION</span>
            </div>

            <div>
              <span className={styles.terminalPrompt}>$ </span>
              <span className={styles.terminalCode}>noti ai:validate-template --channel=kakao</span>
            </div>

            <div className={styles.terminalOutput}>
              [Claude 3.7 Evaluator] 템플릿 구문 및 규제 검사 시작...{'\n'}
              &gt; 수신 페이로드: &quot;[특가할인] 오늘만 50% 세일 이벤트&quot;{'\n\n'}
              <span style={{ color: '#ef4444' }}>[경고 감지] 광고성 메시지 필수 표기 누락</span>{'\n'}
              &bull; 사유: 정보통신망법 제50조에 따른 (광고) 문구 및 080 수신거부 번호 미포함{'\n'}
              &bull; 카카오 알림톡 규정: 순수 정보성 알림이 아니므로 심사 반려 대상{'\n\n'}
              <span style={{ color: '#10b981' }}>[Claude 자동 교정 제안 적용 완료]</span>{'\n'}
              &gt; 변경 채널: 카카오 친구톡 or MMS{'\n'}
              &gt; 교정 문구:{'\n'}
              &quot;(광고)[VIZUO] 고객님만을 위한 깜짝 혜택{'\n'}
              무료수신거부: 080-888-0000&quot;{'\n\n'}
              <span style={{ color: '#38bdf8' }}>✓ 통신사 스팸 점수: 0.02 / 1.0 (안전함)</span>{'\n'}
              ✓ 최종 검증 통과: READY_FOR_DISPATCH
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
