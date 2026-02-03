
// app/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import UploadZone from '@/components/UploadZone';
import StravaConnect from '@/components/StravaConnect';
import ImageCarousel from '@/components/ImageCarousel';

export default function Home() {
  const router = useRouter();

  const handleDataLoaded = (data: unknown, name: string) => {
    // Store data in sessionStorage for the view page
    sessionStorage.setItem('routeArtData', JSON.stringify(data));
    sessionStorage.setItem('routeArtFileName', name);

    // Navigate to view page
    router.push('/view');
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans">
      <header className="p-6 border-b border-neutral-200 bg-white flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">Contour Maps</h1>
      </header>

      <div className="flex-1 p-6 flex flex-col">
        <div className="max-w-5xl mx-auto mt-12 w-full">
          <h2 className="text-3xl font-light mb-8 text-center text-neutral-800">
            Transform your activities into minimalist art.
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Carousel */}
            <div className="order-2 lg:order-1">
              <ImageCarousel />
            </div>

            {/* Upload options */}
            <div className="order-1 lg:order-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                <UploadZone onDataLoaded={handleDataLoaded} />
                <StravaConnect onDataLoaded={handleDataLoaded} />
              </div>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-300" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-neutral-100 px-3 text-sm text-neutral-500">or</span>
                </div>
              </div>
              <p className="text-center text-sm text-neutral-500">
                Upload a GPX file or connect your Strava account to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
