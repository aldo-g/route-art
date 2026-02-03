
// components/UploadZone.tsx
'use client';

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as toGeoJSON from '@mapbox/togeojson';
import { Upload } from 'lucide-react';

interface UploadZoneProps {
    onDataLoaded: (data: any, fileName: string) => void;
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
                alert("Failed to parse file. Please ensure it is a valid GPX or GeoJSON file."); // Simple alert for now
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
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-neutral-800 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}
      `}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4 text-neutral-500">
                <Upload className="w-8 h-8 opacity-50" />
                <div className="space-y-1">
                    <p className="font-medium text-neutral-800">Drop your GPX activity here</p>
                    <p className="text-sm opacity-60">or click to browse</p>
                </div>
            </div>
        </div>
    );
}
