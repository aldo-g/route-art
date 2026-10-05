
// components/UploadZone.tsx
'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as toGeoJSON from '@mapbox/togeojson';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

interface UploadZoneProps {
    onDataLoaded: (data: unknown, fileName: string) => void;
}

export default function UploadZone({ onDataLoaded }: UploadZoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            const content = e.target?.result;
            if (!content) return;

            try {
                if (file.name.endsWith('.gpx')) {
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(content as string, 'text/xml');
                    const geojson = toGeoJSON.gpx(xml);
                    onDataLoaded(geojson, file.name);
                } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
                    const geojson = JSON.parse(content as string);
                    onDataLoaded(geojson, file.name);
                }
            } catch (error) {
                console.error("Error parsing file:", error);
                toast.error("Failed to parse file. Please ensure it is a valid GPX or GeoJSON file.");
            }
        };

        reader.readAsText(file);
    }, [onDataLoaded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/gpx+xml': ['.gpx'],
            'application/json': ['.json', '.geojson']
        },
        multiple: false
    });

    return (
        <div
            {...getRootProps()}
            className={`
        h-full border-2 bg-paper p-8 sm:p-10 cursor-pointer transition-colors
        flex flex-col items-start gap-4
        ${isDragActive ? 'border-accent' : 'border-ink hover:border-accent'}
      `}
        >
            <input {...getInputProps()} />
            <Upload className="w-7 h-7 text-ink" />
            <div>
                <p className="text-[20px] font-semibold text-ink">Drop your GPX activity here</p>
                <p className="mt-1.5 text-[14px] text-muted">Or click to browse. GPX, JSON and GeoJSON accepted.</p>
            </div>
            <div
                className={`mt-1 w-full border-2 border-dashed p-7 text-[13px] tracking-[0.08em] uppercase transition-colors ${
                    isDragActive ? 'border-accent text-accent' : 'border-divider text-faint'
                }`}
            >
                Drag a file into this area
            </div>
        </div>
    );
}
