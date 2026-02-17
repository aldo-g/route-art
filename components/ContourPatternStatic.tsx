'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { createNoise2D } from 'simplex-noise';

function generateTerrain(width: number, height: number, seed: number) {
    const noise2D = createNoise2D(() => {
        let s = Math.sin(seed) * 10000;
        return s - Math.floor(s);
    });

    const values = new Float64Array(width * height);
    const scale = 0.006;

    for (let j = 0; j < height; ++j) {
        for (let i = 0; i < width; ++i) {
            let value = 0;
            value += noise2D(i * scale, j * scale) * 1.0;
            value += noise2D(i * scale * 2, j * scale * 2) * 0.5;
            value += noise2D(i * scale * 4, j * scale * 4) * 0.25;
            values[j * width + i] = value;
        }
    }

    return values;
}

interface ContourPatternStaticProps {
    seed?: number;
}

export default function ContourPatternStatic({ seed = 42 }: ContourPatternStaticProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 400;
        const height = 400;
        const res = 2;
        const terrWidth = Math.ceil(width / res);
        const terrHeight = Math.ceil(height / res);

        const terrainValues = generateTerrain(terrWidth, terrHeight, seed);

        const contours = d3.contours()
            .size([terrWidth, terrHeight])
            .thresholds(16)
            (Array.from(terrainValues));

        svg.selectAll('path')
            .data(contours)
            .enter()
            .append('path')
            .attr('d', d3.geoPath(d3.geoTransform({
                point: function (x, y) {
                    this.stream.point(x * res, y * res);
                }
            })))
            .attr('fill', 'none')
            .attr('stroke', '#d4d4d4')
            .attr('stroke-width', 0.8);

    }, [seed]);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
            <svg
                ref={svgRef}
                className="w-full h-full"
                viewBox="0 0 400 400"
                preserveAspectRatio="xMidYMid slice"
            />
        </div>
    );
}
