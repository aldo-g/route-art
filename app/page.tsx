
// app/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import UploadZone from '@/components/UploadZone';

export default function Home() {
  const router = useRouter();

  const handleDataLoaded = (data: any, name: string) => {
    // Store data in sessionStorage for the view page
    sessionStorage.setItem('routeArtData', JSON.stringify(data));
    sessionStorage.setItem('routeArtFileName', name);

    // Navigate to view page
    router.push('/view');
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans">
      <header className="p-6 border-b border-neutral-200 bg-white flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">Route Art</h1>
      </header>

      <div className="flex-1 p-6 flex flex-col">
        <div className="max-w-2xl mx-auto mt-20">
          <h2 className="text-3xl font-light mb-8 text-center text-neutral-800">
            Transform your activities into minimalist art.
          </h2>
          <UploadZone onDataLoaded={handleDataLoaded} />
        </div>
      </div>
    </main>
  );
}
