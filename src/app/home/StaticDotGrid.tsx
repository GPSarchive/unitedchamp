"use client";

import React, { useRef, useEffect } from "react";

type Props = {
  className?: string;
  baseColor?: string;
  dotSize?: number;
  gap?: number;
};

export default function StaticDotGrid({
  className = "",
  baseColor = "#1F1B2E",
  dotSize = 2,
  gap = 15,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, rect.width, rect.height);

      const cols = Math.ceil(rect.width / gap) + 1;
      const rows = Math.ceil(rect.height / gap) + 1;
      const radius = dotSize / 2;

      ctx.fillStyle = baseColor;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.arc(c * gap, r * gap, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [baseColor, dotSize, gap]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
