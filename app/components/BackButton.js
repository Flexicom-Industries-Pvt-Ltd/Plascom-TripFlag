'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show on root navigation tabs
  const isRootLevel = pathname === '/' || pathname === '/history' || pathname === '/upload' || pathname === '/rules' || pathname === '/changelog';

  if (isRootLevel) {
    return null;
  }

  return (
    <button 
      onClick={() => router.back()} 
      className="back-btn"
      title="Go Back"
      type="button"
    >
      <ChevronLeft size={18} />
      <span>Back</span>
    </button>
  );
}
