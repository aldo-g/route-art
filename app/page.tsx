
// app/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import UploadZone from '@/components/UploadZone';
import StravaConnect from '@/components/StravaConnect';
import ImageCarousel from '@/components/ImageCarousel';
import Header from '@/components/Header';

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
      <Header />

      <div className="flex-1 p-6 flex flex-col">
        <div className="max-w-5xl mx-auto mt-12 w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-light text-neutral-800">
              Transform your activities into contour maps.
            </h2>
            <p className="mt-3 text-neutral-500">
              Upload a GPX route, or connect with Strava to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Carousel */}
            <div className="order-2 lg:order-1">
              <ImageCarousel />
            </div>

            {/* Upload options */}
            <div className="order-1 lg:order-2 flex flex-col justify-center">
              <div className="space-y-4">
                <UploadZone onDataLoaded={handleDataLoaded} />
                <StravaConnect onDataLoaded={handleDataLoaded} />
              </div>
              <p className="text-center text-sm text-neutral-400 mt-6">
                Supports GPX files from any device or app
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
