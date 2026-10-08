'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Calendar } from 'lucide-react';
import styles from './footer.module.css';

export function PolicyModal({ policy, onClose }) {
  useEffect(() => {
    if (!policy) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [policy, onClose]);

  if (!policy || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderMeta}>
            <div className={styles.modalCategory}>
              <ShieldCheck size={14} className={styles.modalBadgeIcon} />
              <span>{policy.category}</span>
            </div>
            <h2 id="policy-modal-title" className={styles.modalTitle}>
              {policy.title}
            </h2>
            <div className={styles.modalDate}>
              <Calendar size={13} />
              <span>최종 개정일: {policy.lastUpdated}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {policy.content.split('\n\n').map((paragraph, index) => {
            const trimmed = paragraph.trim();
            if (trimmed.startsWith('### ')) {
              return (
                <h3 key={index} className={styles.modalHeading3}>
                  {trimmed.replace('### ', '')}
                </h3>
              );
            }
            if (trimmed.startsWith('- ')) {
              const items = trimmed.split('\n').map((item) => item.replace(/^- /, ''));
              return (
                <ul key={index} className={styles.modalList}>
                  {items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={index} className={styles.modalParagraph}>
                {trimmed}
              </p>
            );
          })}
        </div>

        <div className={styles.modalFooter}>
          <span className={styles.modalFooterNotice}>
            비주오 (VIZUO)는 정보통신망법 및 개인정보보호법 관련 법령을 엄격히 준수합니다.
          </span>
          <button
            type="button"
            className={styles.modalConfirmButton}
            onClick={onClose}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
