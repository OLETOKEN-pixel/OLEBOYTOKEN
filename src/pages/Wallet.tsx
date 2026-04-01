import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', 'payments');

    navigate(
      {
        pathname: '/profile',
        search: `?${nextSearchParams.toString()}`,
      },
      { replace: true }
    );
  }, [navigate, searchParams]);

  return <LoadingPage />;
}
