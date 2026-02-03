'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselImage {
  src: string;
  alt: string;
}

const images: CarouselImage[] = [
  { src: '/images/Peaks-Por-Da.png', alt: 'Peaks - Dark theme' },
  { src: '/images/Ove-Por-Li.png', alt: 'Ove - Light theme' },
  { src: '/images/Laug-Por-Da.png', alt: 'Laug - Dark theme' },
  { src: '/images/Trig-Por-Li.png', alt: 'Trig - Light theme' },
];

export default function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(goToNext, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, goToNext]);

  const handleManualNav = (action: () => void) => {
    setIsAutoPlaying(false);
    action();
    // Resume autoplay after 10 seconds of no interaction
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-neutral-200 shadow-lg">
        {images.map((image, index) => (
          <div
            key={image.src}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-contain"
              priority={index === 0}
            />
          </div>
        ))}

        {/* Navigation arrows */}
        <button
          onClick={() => handleManualNav(goToPrev)}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-700" />
        </button>
        <button
          onClick={() => handleManualNav(goToNext)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="w-5 h-5 text-neutral-700" />
        </button>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => handleManualNav(() => setCurrentIndex(index))}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-neutral-700' : 'bg-neutral-300'
            }`}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
