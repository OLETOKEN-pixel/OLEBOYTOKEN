import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

export default function PaymentCancel() {
  return (
    <MainLayout showChat={false}>
      <div className="max-w-md mx-auto py-8">
        <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] text-center p-8">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-[36px] font-bold uppercase mb-2">Payment Cancelled</h1>
          <p className="text-gray-400 mb-6">
            Your payment was cancelled. No charges were made to your account.
          </p>
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full btn-premium h-12">
              <Link to="/buy">Try Again</Link>
            </Button>
            <Button asChild className="w-full btn-premium-secondary h-12">
              <Link to="/">Go Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
