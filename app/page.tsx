
// app/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import UploadZone from '@/components/UploadZone';
import StravaConnect from '@/components/StravaConnect';
import ImageCarousel from '@/components/ImageCarousel';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
    <main className="h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans overflow-hidden">
      <Header />

      <div className="flex-1 p-4 flex flex-col min-h-0">
        <div className="max-w-5xl mx-auto w-full flex flex-col justify-center flex-1">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-light text-neutral-800">
              Transform your activities into contour maps.
            </h2>
            <p className="mt-2 text-neutral-500 text-sm">
              Upload a GPX route, or connect with Strava to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center">
            {/* Carousel */}
            <div className="order-2 lg:order-1">
              <ImageCarousel />
            </div>

            {/* Upload options */}
            <div className="order-1 lg:order-2 flex flex-col justify-center">
              <div className="space-y-3">
                <UploadZone onDataLoaded={handleDataLoaded} />
                <StravaConnect onDataLoaded={handleDataLoaded} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
