'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const images = [
  { src: '/images/mock_ups/Brown Modern Minimal Living Room Horizontal Wall Art Poster Frame Mockup Instagram Post.png', alt: 'West Highland Way - living room' },
  { src: '/images/mock_ups/Brown Modern Interior Living Room Gallery Wall Art Poster Frame Mockup Instagram Post.png', alt: 'Gallery wall with multiple maps' },
  { src: '/images/mock_ups/White and Blue Minimalist Wall Frame Mockup Instagram Post.png', alt: 'West Highland Way - modern interior' },
  { src: '/images/mock_ups/Brown Minimalist 3D Illustration Wall Frame Mockup Instagram Post.png', alt: 'Melbourne to Adelaide - dark theme' },
];

export default function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || isHovered) return;
    const interval = setInterval(goToNext, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, isHovered, goToNext]);

  const handleManualNav = (action: () => void) => {
    setIsAutoPlaying(false);
    action();
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <div
      className="relative w-full max-w-xl mx-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl shadow-lg">
        {images.map((image, index) => (
          <div
            key={image.src}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}

        {/* Navigation arrows */}
        <button
          onClick={() => handleManualNav(goToPrev)}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-colors z-10"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-700" />
        </button>
        <button
          onClick={() => handleManualNav(goToNext)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-colors z-10"
          aria-label="Next image"
        >
          <ChevronRight className="w-5 h-5 text-neutral-700" />
        </button>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-3">
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
