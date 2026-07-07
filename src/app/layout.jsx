import { ClerkProvider } from '@clerk/nextjs';

import './globals.css';
import '../resend-ui/resend-ui.css';
import '../styles/components.css';
import '../styles/data-table-v2.css';
import '../styles/domain-detail.css';
import '../styles/resend-automation.css';
import '../styles/template-detail.css';
import '../styles/publ-event-detail.css';
import { AppProviders } from './AppProviders.jsx';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { ConsoleRootFrame } from '../features/console/ConsoleRootFrame.jsx';

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
    <html lang="ko">
      <body>
        <ClerkProvider dynamic>
          <AppProviders>
            <ToastProvider>
              <ConsoleRootFrame>{children}</ConsoleRootFrame>
            </ToastProvider>
          </AppProviders>
        </ClerkProvider>
      </body>
    </html>
  );
}
