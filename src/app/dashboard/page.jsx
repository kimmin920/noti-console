import { redirect } from 'next/navigation';

export const metadata = {
  title: '대시보드 이동 - NOTI',
  description: 'NOTI 콘솔로 이동합니다.',
};

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const search = params && Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
  redirect(`/message-send${search}`);
}
