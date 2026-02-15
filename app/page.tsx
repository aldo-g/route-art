
// app/page.tsx
'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Printer, Palette, Mountain, Upload, SlidersHorizontal, Download } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import StravaConnect from '@/components/StravaConnect';
import ImageCarousel from '@/components/ImageCarousel';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { setRouteData } from '@/lib/storage';

const mockups = [
  { src: '/images/mock_ups/Brown Modern Minimal Living Room Horizontal Wall Art Poster Frame Mockup Instagram Post.png', alt: 'West Highland Way - living room' },
  { src: '/images/mock_ups/Brown Modern Interior Living Room Gallery Wall Art Poster Frame Mockup Instagram Post.png', alt: 'Gallery wall with multiple maps' },
  { src: '/images/mock_ups/White and Blue Minimalist Wall Frame Mockup Instagram Post.png', alt: 'West Highland Way - modern interior' },
  { src: '/images/mock_ups/Brown Minimalist 3D Illustration Wall Frame Mockup Instagram Post.png', alt: 'Melbourne to Adelaide - dark theme' },
];

const features = [
  { icon: Mountain, text: 'Perfect for hikers, runners, and cyclists' },
  { icon: Printer, text: 'Print-ready at A1, A2, A3, A4' },
  { icon: Palette, text: 'Minimalist, gallery-quality design' },
  { icon: MapPin, text: 'Automatic landmark detection' },
];

const steps = [
  { icon: Upload, title: 'Upload GPX', description: 'Drop in a file from Strava, Garmin, or Komoot' },
  { icon: SlidersHorizontal, title: 'Customize your map', description: 'Adjust style, landmarks, and layout' },
  { icon: Download, title: 'Download or print', description: 'Export a high-res PNG ready for framing' },
];

export default function Home() {
  const router = useRouter();
  const uploadRef = useRef<HTMLDivElement>(null);

  const handleDataLoaded = async (data: unknown, name: string) => {
    await setRouteData('routeArtData', data);
    sessionStorage.setItem('routeArtFileName', name);
    router.push('/view');
  };

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans">
      <Header onCtaClick={scrollToUpload} />

      {/* Hero Section */}
      <section className="flex-shrink-0 px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left - Copy */}
          <div className="order-2 lg:order-1">
            <h1 className="text-3xl lg:text-5xl font-semibold tracking-tight text-neutral-900 leading-tight">
              Turn your hikes and rides into beautiful wall art.
            </h1>
            <p className="mt-5 text-lg text-neutral-500 leading-relaxed max-w-lg">
              Upload a GPX file and generate a print-ready contour map of your adventure in seconds.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={scrollToUpload}
                className="px-8 py-3.5 bg-neutral-900 text-white rounded-lg text-base font-medium hover:bg-neutral-800 active:bg-neutral-950 transition-colors"
              >
                Create your poster
              </button>
              <a
                href="#examples"
                className="px-4 py-3.5 text-neutral-500 hover:text-neutral-800 transition-colors text-base"
              >
                See examples
              </a>
            </div>
            <p className="mt-4 text-xs text-neutral-400">
              Free to use. Download instantly as a high-res PNG.
            </p>
          </div>

          {/* Right - Carousel */}
          <div className="order-1 lg:order-2">
            <ImageCarousel />
          </div>
        </div>

        {/* Trust signal */}
        <p className="mt-16 text-center text-sm text-neutral-400">
          Used by hikers, runners, and cyclists worldwide
        </p>
      </section>

      {/* Feature Row */}
      <section className="px-6 py-8 border-y border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <feature.icon className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                <span className="text-sm text-neutral-600">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="px-6 pt-20 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-neutral-900 text-center">
            Real adventures turned into wall art
          </h2>
          <p className="mt-2 text-neutral-500 text-center text-sm">
            Every map is unique to your route.
          </p>
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {mockups.map((mockup) => (
              <div
                key={mockup.src}
                className="relative aspect-square rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <Image
                  src={mockup.src}
                  alt={mockup.alt}
                  fill
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 pt-20 pb-20 border-t border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-neutral-900 text-center">
            How it works
          </h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-100 mb-4">
                  <step.icon className="w-5 h-5 text-neutral-600" />
                </div>
                <p className="text-xs text-neutral-400 mb-1">Step {i + 1}</p>
                <h3 className="font-medium text-neutral-900">{step.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section ref={uploadRef} className="px-6 pt-20 pb-20 border-t border-neutral-200">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-semibold text-neutral-900 text-center">
            Start with your GPX file
          </h2>
          <p className="mt-2 text-neutral-500 text-center text-sm">
            Export GPX from Strava, Garmin, Komoot, or any GPS device.
          </p>
          <div className="mt-8 space-y-3">
            <UploadZone onDataLoaded={handleDataLoaded} />
            <StravaConnect onDataLoaded={handleDataLoaded} />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
