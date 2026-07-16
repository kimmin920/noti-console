import { ClerkProvider } from '@clerk/nextjs';

import './globals.css';
import '../styles/components.css';
import '../styles/data-table-v2.css';
import '../styles/domain-detail.css';
import '../styles/audience.css';
import '../styles/resend-automation.css';
import '../styles/template-detail.css';
import '../styles/publ-event-detail.css';
import '../ui-kits/resend/styles/index.css';
import '../styles/rui-extensions.css';
import { AppProviders } from './AppProviders.jsx';
import { AppToastProvider as ToastProvider } from '../components/ui-extensions/AppToast.jsx';

export const metadata = {
  title: 'NOTI',
  description: 'SMS, 알림톡, 브랜드 메시지 운영 콘솔',
  icons: {
    icon: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '762x762',
        url: '/static/icons/001_NOTI.png',
      },
    ],
    apple: [
      {
        rel: 'apple-touch-icon',
        type: 'image/png',
        sizes: '762x762',
        url: '/static/icons/001_NOTI.png',
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html data-resend-ui-theme="light" lang="ko">
      <body>
        <ClerkProvider dynamic>
          <AppProviders>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AppProviders>
        </ClerkProvider>
      </body>
    </html>
  );
}
