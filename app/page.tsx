// app/page.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, SlidersHorizontal, Download } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import StravaConnect from '@/components/StravaConnect';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { setRouteData } from '@/lib/storage';
import { getAllPresets, loadPresetRoute, PosterPreset } from '@/lib/presets';

const features = [
  'Hikers, runners, cyclists',
  'Print-ready at A1–A4',
  'Gallery-quality minimalism',
  'Automatic landmark detection',
];

const steps = [
  { icon: Upload, title: 'Upload GPX', description: 'Drop in a file from Strava, Garmin, or Komoot.' },
  { icon: SlidersHorizontal, title: 'Customize your map', description: 'Adjust style, landmarks, and layout.' },
  { icon: Download, title: 'Download or print', description: 'Export a high-res PNG ready for framing.' },
];

export default function Home() {
  const router = useRouter();
  const uploadRef = useRef<HTMLDivElement>(null);
  const [presets, setPresets] = useState<PosterPreset[]>([]);
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null);

  useEffect(() => {
    getAllPresets().then(setPresets).catch(() => {});
  }, []);

  const handleDataLoaded = async (data: unknown, name: string) => {
    await setRouteData('routeArtData', data);
    sessionStorage.setItem('routeArtFileName', name);
    router.push('/view');
  };

  const handlePresetClick = async (presetId: string) => {
    setLoadingPresetId(presetId);
    const success = await loadPresetRoute(presetId);
    if (success) {
      router.push('/view');
    }
    setLoadingPresetId(null);
  };

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-background text-ink flex flex-col">
      <Header onCtaClick={scrollToUpload} />

      <div className="w-full max-w-[1180px] mx-auto border-x-0 lg:border-x-2 border-ink">
        {/* Hero — split: copy panel against a hard rule, poster photograph beside it */}
        <section className="grid grid-cols-1 lg:grid-cols-[460px_1fr] border-b-2 border-ink">
          <div className="bg-paper px-6 py-14 sm:px-10 sm:py-[72px] flex flex-col justify-center border-b-2 lg:border-b-0 lg:border-r-2 border-ink">
            <p className="text-[12px] font-semibold tracking-[0.16em] uppercase text-accent-700">
              GPX in, print out
            </p>
            <h1 className="mt-5 text-[40px] sm:text-[52px] lg:text-[60px] leading-[0.98] font-bold tracking-[-0.035em]">
              Your route,<br />on the wall.
            </h1>
            <p className="mt-6 text-[17px] leading-[1.5] text-muted max-w-[22em]">
              Upload a GPX file and generate a print-ready contour map of your adventure in seconds.
            </p>
            <div className="mt-9 flex flex-col items-start gap-3.5">
              <button
                onClick={scrollToUpload}
                className="px-6 py-4 min-h-[44px] bg-accent text-white text-[15px] font-semibold tracking-[0.04em] uppercase hover:bg-accent-700 transition-colors"
              >
                Create your poster
              </button>
              <a
                href="#examples"
                className="text-[14px] text-muted border-b-2 border-ink pb-0.5 hover:text-accent hover:border-accent transition-colors"
              >
                See iconic routes
              </a>
            </div>
            <div className="mt-11 pt-5 border-t-2 border-divider grid grid-cols-3 gap-4">
              <div>
                <div className="text-[22px] font-bold">Free</div>
                <div className="mt-0.5 text-[12px] text-muted">to download</div>
              </div>
              <div>
                <div className="text-[22px] font-bold">A1–A4</div>
                <div className="mt-0.5 text-[12px] text-muted">print-ready</div>
              </div>
              <div>
                <div className="text-[22px] font-bold">{presets.length || 9}</div>
                <div className="mt-0.5 text-[12px] text-muted">iconic routes</div>
              </div>
            </div>
          </div>

          <div className="relative h-[380px] sm:h-[520px] lg:h-[660px] overflow-hidden">
            <Image
              src="/images/mock_ups/Brown Modern Minimal Living Room Horizontal Wall Art Poster Frame Mockup Instagram Post.png"
              alt="Contour poster framed above a sideboard"
              fill
              sizes="(max-width: 1024px) 100vw, 720px"
              className="object-cover"
              priority
            />
            <div className="absolute left-0 bottom-0 bg-paper px-[18px] py-3 text-[12px] tracking-[0.1em] uppercase border-t-2 border-r-2 border-ink">
              West Highland Way · A2 · matte
            </div>
          </div>
        </section>

        {/* Feature strip — four cells, hairline dividers */}
        <section className="grid grid-cols-2 lg:grid-cols-4 bg-paper border-b-2 border-ink">
          {features.map((feature, i) => (
            <div
              key={feature}
              className={`px-6 py-5 text-[13px] text-muted border-divider ${
                i < features.length - 1 ? 'border-r-2' : ''
              } ${i < 2 ? 'border-b-2 lg:border-b-0' : ''} ${i === 1 ? 'border-r-0 lg:border-r-2' : ''}`}
            >
              {feature}
            </div>
          ))}
        </section>

        {/* Iconic routes */}
        <section id="examples" className="px-6 sm:px-8 pt-16 pb-[72px] scroll-mt-20">
          <div className="flex items-end justify-between gap-6 pb-4 border-b-2 border-ink">
            <div>
              <h2 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em]">Iconic routes</h2>
              <p className="mt-1.5 text-[15px] text-muted">Click any trail to open it in the editor.</p>
            </div>
            <span className="hidden sm:block label-meta whitespace-nowrap">
              {presets.length || 9} trails
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                disabled={loadingPresetId !== null}
                className="group flex flex-col gap-3.5 text-left disabled:opacity-60"
              >
                <div className="relative aspect-[3/4] bg-paper border-2 border-ink p-[18px] transition-colors group-hover:border-accent">
                  <div className="relative w-full h-full">
                    <Image
                      src={preset.preview.thumbnail}
                      alt={preset.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
                      className="object-contain"
                      loading="lazy"
                    />
                  </div>
                  {loadingPresetId === preset.id && (
                    <div className="absolute inset-0 bg-paper/80 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-end justify-start opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-accent text-white px-3 py-2 text-[11px] font-semibold tracking-[0.1em] uppercase">
                      Customize in editor
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-3 pb-2.5 border-b-2 border-divider">
                  <div>
                    <div className="text-[16px] font-semibold group-hover:text-accent transition-colors">
                      {preset.name}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">{preset.location}</div>
                  </div>
                  <div className="text-[12px] tracking-[0.06em] text-muted whitespace-nowrap">
                    {preset.stats.distanceKm} km
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* How it works — numbered columns */}
        <section id="how-it-works" className="bg-paper border-t-2 border-ink px-6 sm:px-8 pt-16 pb-[72px] scroll-mt-20">
          <h2 className="text-[15px] font-bold tracking-[0.14em] uppercase pb-3.5 border-b-2 border-ink">
            How it works
          </h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className={`py-6 sm:py-0 border-divider ${
                  i < steps.length - 1 ? 'border-b-2 sm:border-b-0 sm:border-r-2' : ''
                } ${i === 0 ? 'sm:pr-8' : i === steps.length - 1 ? 'sm:pl-8' : 'sm:px-8'}`}
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-[34px] font-bold tracking-[-0.02em] text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <step.icon className="w-5 h-5 text-ink" />
                </div>
                <div className="mt-3.5 text-[20px] font-semibold">{step.title}</div>
                <p className="mt-2 text-[15px] leading-[1.5] text-muted max-w-[20em]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Start with your route */}
        <section ref={uploadRef} className="border-t-2 border-ink px-6 sm:px-8 pt-16 pb-[72px]">
          <div className="flex items-end justify-between gap-6 pb-4 border-b-2 border-ink">
            <div>
              <h2 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em]">Start with your route</h2>
              <p className="mt-1.5 text-[15px] text-muted">Drop a file, or pull it straight from Strava.</p>
            </div>
            <span className="hidden sm:block label-meta whitespace-nowrap">GPX · GeoJSON</span>
          </div>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-8 items-stretch">
            <UploadZone onDataLoaded={handleDataLoaded} />

            {/* "or" — a rule through the gutter, vertical on desktop, horizontal once stacked */}
            <div
              aria-hidden="true"
              className="flex lg:flex-col items-center gap-4 lg:gap-3"
            >
              <span className="flex-1 h-0.5 lg:h-auto lg:w-0.5 bg-divider" />
              <span className="text-[12px] font-semibold tracking-[0.12em] uppercase text-faint">
                or
              </span>
              <span className="flex-1 h-0.5 lg:h-auto lg:w-0.5 bg-divider" />
            </div>

            <StravaConnect onDataLoaded={handleDataLoaded} />
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
