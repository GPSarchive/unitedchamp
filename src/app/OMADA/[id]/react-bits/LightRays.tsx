'use client';

import { useRef, useEffect, useState } from 'react';
import './LightRays.css';

const DEFAULT_COLOR = '#ffffff';

type Vec2 = [number, number];
type Vec3 = [number, number, number];

type RaysOrigin =
  | 'top-left'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'top-center';

type LogoFit = 'contain' | 'cover' | 'stretch';

interface LightRaysProps {
  raysOrigin?: RaysOrigin;
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  noiseAmount?: number;
  distortion?: number;
  className?: string;
  logoScale?: number;

  logoSrc?: string;
  logoStrength?: number;
  logoFit?: LogoFit;

  popIn?: boolean;
  popDuration?: number;
  popDelay?: number;
  popScaleFrom?: number;
  popRevealSoftness?: number;

  logoOnTop?: boolean;
  logoOpacity?: number;

  /** 🔧 Performance controls */
  maxDpr?: number;      // cap device pixel ratio (default: 1.0 desktop / 0.85 touch)
  maxFps?: number;      // cap animation FPS (default: 45)
  idleDelayMs?: number; // delay init slightly to let main content paint (default: 60)
}

/** ---- Small utils ---- */
const hexToRgb = (hex: string): Vec3 => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? ([parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] as Vec3)
    : [1, 1, 1];
};

const getAnchorAndDir = (
  origin: RaysOrigin,
  w: number,
  h: number
): { anchor: Vec2; dir: Vec2 } => {
  const outside = 0.2;
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case 'top-right':
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case 'left':
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case 'right':
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case 'bottom-left':
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-center':
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-right':
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default:
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
};

/** ---- OGL dynamic import (cached) ---- */
let OGL: {
  Renderer: any;
  Program: any;
  Triangle: any;
  Mesh: any;
  Texture: any;
} | null = null;

const rIC: (cb: () => void) => void =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 800 })
    : (cb) => setTimeout(cb, 60);

/** ---- Component ---- */
const LightRays = ({
  raysOrigin = 'top-center',
  raysColor = DEFAULT_COLOR,
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1.0,
  saturation = 1.0,
  followMouse = true,
  mouseInfluence = 0.1,
  noiseAmount = 0.0,
  distortion = 0.0,
  className = '',
  logoScale = 1,
  logoSrc,
  logoStrength = 1.0,
  logoFit = 'contain',

  popIn = true,
  popDuration = 600,
  popDelay = 0,
  popScaleFrom = 0.92,
  popRevealSoftness = 0.06,

  logoOnTop = true,
  logoOpacity = 1.0,

  // 🔧 perf defaults
  maxDpr,
  maxFps = 45,
  idleDelayMs = 60,
}: LightRaysProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // All runtime uniforms live behind this ref (avoid rerenders)
  const uniformsRef = useRef<any | null>(null);
  const rendererRef = useRef<any | null>(null);
  const meshRef = useRef<any | null>(null);

  // Mouse + animation refs
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef(0); // for FPS cap
  const introStartRef = useRef<number | null>(null);

  // Visibility / lifecycle
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Logo texture & metadata
  const logoTexRef = useRef<any | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const logoAspectRef = useRef<number | null>(null); // width / height

  /** Observe visibility (init when in view, tear down when out) */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const onScreen = entries[0]?.isIntersecting ?? false;
        setIsVisible(onScreen);
        // Auto-tear-down when off-screen
        if (!onScreen) cleanup();
      },
      { threshold: 0.02, rootMargin: '0px 0px -10% 0px' }
    );
    observerRef.current.observe(el);
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Helper: cleanup GL + listeners */
  const cleanup = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;

    const renderer = rendererRef.current;
    if (renderer) {
      try {
        const canvas = renderer.gl.canvas as HTMLCanvasElement;
        const ext = renderer.gl.getExtension('WEBGL_lose_context');
        ext?.loseContext();
        canvas.parentNode?.removeChild(canvas);
      } catch {}
    }

    rendererRef.current = null;
    uniformsRef.current = null;
    meshRef.current = null;
    logoTexRef.current = null;
    logoImageRef.current = null;
    logoAspectRef.current = null;
    introStartRef.current = null;

    // Remove any pointer listeners attached to container
    const el = containerRef.current;
    if (el) el.onpointermove = null;
    document.removeEventListener('visibilitychange', onVisibility);
  };

  /** Apply DPR cap to OGL renderer */
  const applyDpr = (renderer: any) => {
    if (!renderer) return;
    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const cap = (typeof maxDpr === 'number' ? maxDpr : (isTouch ? 0.85 : 1.0));
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    renderer.dpr = dpr;
  };

  /** Update logo UV for contain/cover/stretch */
  const updateLogoUV = () => {
    const u = uniformsRef.current;
    if (!u) return;

    if (!logoAspectRef.current || !u.iResolution.value) {
      u.logoUV.value = [1, 1, 0, 0];
      return;
    }

    const [w, h] = u.iResolution.value as Vec2;
    const canvasAspect = w / h;
    const imageAspect = logoAspectRef.current;

    let scaleX = 1, scaleY = 1;
    if (logoFit === 'stretch') {
      scaleX = 1;
      scaleY = 1;
    } else if (logoFit === 'contain') {
      if (imageAspect > canvasAspect) {
        scaleX = 1;
        scaleY = canvasAspect / imageAspect;
      } else {
        scaleX = imageAspect / canvasAspect;
        scaleY = 1;
      }
    } else {
      // cover
      if (imageAspect > canvasAspect) {
        scaleX = canvasAspect / imageAspect;
        scaleY = 1;
      } else {
        scaleX = 1;
        scaleY = imageAspect / canvasAspect;
      }
    }

    const s = Math.min(Math.max(logoScale ?? 1, 0.1), 1.0) * 0.995;
    scaleX *= s;
    scaleY *= s;
    const offsetX = (1 - scaleX) * 0.5;
    const offsetY = (1 - scaleY) * 0.5;

    u.logoUV.value = [scaleX, scaleY, offsetX, offsetY];
  };

  /** Pause/restart when tab visibility changes */
  const onVisibility = () => {
    const hidden = document.visibilityState === 'hidden';
    if (hidden) {
      cleanup(); // simplest + clean
    } else if (isVisible) {
      // re-init when visible again
      rIC(() => init());
    }
  };

  /** Initialize WebGL scene */
  const init = async () => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const el = containerRef.current;
    if (!el || uniformsRef.current || rendererRef.current) return;

    // Small idle delay so main content paints first
    await new Promise((r) => setTimeout(r, idleDelayMs));

    // Load OGL lazily (and cache)
    if (!OGL) {
      const mod = await import('ogl');
      OGL = {
        Renderer: mod.Renderer,
        Program: mod.Program,
        Triangle: mod.Triangle,
        Mesh: mod.Mesh,
        Texture: mod.Texture,
      };
    }
    const { Renderer, Program, Triangle, Mesh, Texture } = OGL!;

    const renderer = new Renderer({ dpr: 1, alpha: true }); // we'll set dpr below
    rendererRef.current = renderer;

    const gl = renderer.gl;
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';

    // Clear existing children and mount canvas
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(gl.canvas);

    // Shaders (unchanged functionally)
    const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

    const frag = `precision highp float;
uniform float iTime; uniform vec2 iResolution;
uniform vec2 rayPos; uniform vec2 rayDir; uniform vec3 raysColor;
uniform float raysSpeed; uniform float lightSpread; uniform float rayLength;
uniform float pulsating; uniform float fadeDistance; uniform float saturation;
uniform vec2 mousePos; uniform float mouseInfluence; uniform float noiseAmount; uniform float distortion;
uniform sampler2D uLogo; uniform float logoEnabled; uniform float logoStrength; uniform vec4 logoUV;
uniform float introProgress; uniform float logoPopScaleFrom; uniform float logoRevealSoftness;
uniform float logoOnTop; uniform float logoOpacity;
varying vec2 vUv;
float noise(vec2 st){return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);}
float rayStrength(vec2 rS, vec2 rD, vec2 c, float a, float b, float sp){
  vec2 s2c = c - rS; vec2 dn = normalize(s2c); float ca = dot(dn, rD);
  float da = ca + distortion * sin(iTime * 2.0 + length(s2c) * 0.01) * 0.2;
  float spread = pow(max(da, 0.0), 1.0 / max(lightSpread, 0.001));
  float dist = length(s2c); float maxD = iResolution.x * rayLength;
  float lenFall = clamp((maxD - dist) / maxD, 0.0, 1.0);
  float fadeFall = clamp((iResolution.x * fadeDistance - dist) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * sp * 3.0)) : 1.0;
  float base = clamp((0.45 + 0.15 * sin(da * a + iTime * sp)) + (0.3 + 0.2 * cos(-da * b + iTime * sp)), 0.0, 1.0);
  return base * lenFall * fadeFall * spread * pulse;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 fDir = rayDir;
  if(mouseInfluence > 0.0){
    vec2 m = mousePos * iResolution.xy;
    vec2 md = normalize(m - rayPos);
    fDir = normalize(mix(rayDir, md, mouseInfluence));
  }
  vec4 r1 = vec4(1.0) * rayStrength(rayPos, fDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  vec4 r2 = vec4(1.0) * rayStrength(rayPos, fDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  vec4 rays = r1 * 0.5 + r2 * 0.4;
  if(noiseAmount > 0.0){ float n = noise(coord * 0.01 + iTime * 0.1); rays.rgb *= (1.0 - noiseAmount + noiseAmount * n); }
  float br = 1.0 - (coord.y / iResolution.y);
  rays.r *= 0.1 + br * 0.8; rays.g *= 0.3 + br * 0.6; rays.b *= 0.5 + br * 0.5;
  if(saturation != 1.0){ float gray = dot(rays.rgb, vec3(0.299,0.587,0.114)); rays.rgb = mix(vec3(gray), rays.rgb, saturation); }
  rays.rgb *= raysColor;
  vec3 outC = rays.rgb;
  if(logoEnabled > 0.5){
    float s = mix(logoPopScaleFrom, 1.0, clamp(introProgress, 0.0, 1.0));
    vec2 centered = vUv - 0.5; vec2 vUvScaled = centered * s + 0.5;
    vec2 uv = vUvScaled * logoUV.xy + logoUV.zw;
    vec4 logo = texture2D(uLogo, uv);
    float reveal = smoothstep(-logoRevealSoftness, logoRevealSoftness, introProgress - vUv.y);
    float mask = logo.a * reveal * clamp(introProgress, 0.0, 1.0);
    vec3 logoRGB = clamp(logo.rgb, 0.0, 1.0);
    vec3 boosted = rays.rgb * (1.0 + clamp(logoStrength, 0.0, 2.0));
    vec3 screenWithLogo = 1.0 - (1.0 - logoRGB) * (1.0 - boosted);
    vec3 inside = (logoOnTop > 0.5) ? mix(rays.rgb, logoRGB, clamp(logoOpacity, 0.0, 1.0)) : mix(boosted, screenWithLogo, 0.5);
    outC = mix(rays.rgb, inside, mask);
  }
  fragColor = vec4(outC, 1.0);
}
void main(){ vec4 c; mainImage(c, gl_FragCoord.xy); gl_FragColor = c; }`;

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] as Vec2 },
      rayPos: { value: [0, 0] as Vec2 },
      rayDir: { value: [0, 1] as Vec2 },
      raysColor: { value: hexToRgb(raysColor) as Vec3 },
      raysSpeed: { value: raysSpeed },
      lightSpread: { value: lightSpread },
      rayLength: { value: rayLength },
      pulsating: { value: pulsating ? 1.0 : 0.0 },
      fadeDistance: { value: fadeDistance },
      saturation: { value: saturation },
      mousePos: { value: [0.5, 0.5] as Vec2 },
      mouseInfluence: { value: mouseInfluence },
      noiseAmount: { value: noiseAmount },
      distortion: { value: distortion },

      uLogo: { value: null },
      logoEnabled: { value: logoSrc ? 1 : 0 },
      logoStrength: { value: logoStrength },
      logoUV: { value: [1, 1, 0, 0] as [number, number, number, number] },

      introProgress: { value: popIn ? 0 : 1 },
      logoPopScaleFrom: { value: Math.max(0.0, Math.min(popScaleFrom ?? 0.92, 1.0)) },
      logoRevealSoftness: { value: Math.max(0.0, Math.min(popRevealSoftness ?? 0.06, 0.3)) },

      logoOnTop: { value: logoOnTop ? 1.0 : 0.0 },
      logoOpacity: { value: Math.max(0, Math.min(logoOpacity ?? 1.0, 1)) },
    };
    uniformsRef.current = uniforms;

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
    const mesh = new Mesh(gl, { geometry, program });
    meshRef.current = mesh;

    // Logo texture
    if (logoSrc) {
      const tex = new Texture(gl);
      tex.flipY = true;
      tex.minFilter = gl.LINEAR;
      tex.magFilter = gl.LINEAR;
      tex.wrapS = gl.CLAMP_TO_EDGE;
      tex.wrapT = gl.CLAMP_TO_EDGE;
      logoTexRef.current = tex;
      uniforms.uLogo.value = tex;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!logoTexRef.current) return;
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          uniforms.logoEnabled.value = 0;
          return;
        }
        logoTexRef.current.image = img;
        logoImageRef.current = img;
        logoAspectRef.current = img.naturalWidth / img.naturalHeight;
        updatePlacement();
      };
      img.onerror = () => {
        uniforms.logoEnabled.value = 0;
      };
      img.src = logoSrc;
    }

    // Size & DPR
    const updatePlacement = () => {
      if (!rendererRef.current || !uniformsRef.current || !containerRef.current) return;
      const r = rendererRef.current;
      applyDpr(r);

      const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
      r.setSize(wCSS, hCSS);

      const w = wCSS * r.dpr;
      const h = hCSS * r.dpr;

      uniforms.iResolution.value = [w, h];
      const { anchor, dir } = getAnchorAndDir(raysOrigin, w, h);
      uniforms.rayPos.value = anchor;
      uniforms.rayDir.value = dir;

      updateLogoUV();
    };

    // Efficiently observe size changes
    resizeObserverRef.current = new ResizeObserver(() => {
      // throttle via rAF
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          updatePlacement();
        });
      }
    });
    resizeObserverRef.current.observe(el);

    // Initial placement
    updatePlacement();

    // Pointer tracking only on the container
    if (followMouse) {
      el.onpointermove = (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        mouseRef.current = { x, y };
      };
    }

    // Cap FPS by skipping frames
    const frameInterval = Math.max(1000 / Math.max(1, maxFps), 8); // clamp

    const loop = (tMs: number) => {
      const u = uniformsRef.current;
      const r = rendererRef.current;
      const m = meshRef.current;
      if (!u || !r || !m) return;

      // FPS cap
      const last = lastFrameMsRef.current || 0;
      if (tMs - last < frameInterval) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastFrameMsRef.current = tMs;

      // Intro progress (no state writes)
      if (popIn && u.introProgress.value < 1.0) {
        if (introStartRef.current == null) {
          introStartRef.current = tMs + (popDelay || 0);
        }
        const elapsed = Math.max(0, tMs - introStartRef.current);
        const p = Math.max(0, Math.min(1, popDuration > 0 ? elapsed / popDuration : 1));
        const eased = 1.0 - Math.pow(1.0 - p, 3.0);
        u.introProgress.value = eased;
      } else if (!popIn) {
        u.introProgress.value = 1.0;
      }

      u.iTime.value = tMs * 0.001;

      if (followMouse && mouseInfluence > 0.0) {
        const smoothing = 0.92;
        smoothMouseRef.current.x =
          smoothMouseRef.current.x * smoothing + mouseRef.current.x * (1 - smoothing);
        smoothMouseRef.current.y =
          smoothMouseRef.current.y * smoothing + mouseRef.current.y * (1 - smoothing);
        u.mousePos.value = [smoothMouseRef.current.x, smoothMouseRef.current.y];
      }

      try {
        r.render({ scene: m });
      } catch {
        // If render fails, tear down to avoid loops
        cleanup();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    document.addEventListener('visibilitychange', onVisibility);

    // Start animation after idle (lets main thread breathe)
    rIC(() => {
      rafRef.current = requestAnimationFrame(loop);
    });
  };

  /** Init when visible; tear down when not */
  useEffect(() => {
    if (isVisible) {
      rIC(() => init());
    } else {
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, raysOrigin, raysColor, raysSpeed, lightSpread, rayLength, pulsating, fadeDistance, saturation, followMouse, mouseInfluence, noiseAmount, distortion, logoSrc, logoStrength, logoFit, logoScale, popIn, popDuration, popDelay, popScaleFrom, popRevealSoftness, logoOnTop, logoOpacity, maxDpr, maxFps, idleDelayMs]);

  /** Runtime prop updates (no re-init) */
  useEffect(() => {
    const u = uniformsRef.current;
    const r = rendererRef.current;
    const el = containerRef.current;
    if (!u || !r || !el) return;

    u.raysColor.value = hexToRgb(raysColor);
    u.raysSpeed.value = raysSpeed;
    u.lightSpread.value = lightSpread;
    u.rayLength.value = rayLength;
    u.pulsating.value = pulsating ? 1.0 : 0.0;
    u.fadeDistance.value = fadeDistance;
    u.saturation.value = saturation;
    u.mouseInfluence.value = mouseInfluence;
    u.noiseAmount.value = noiseAmount;
    u.distortion.value = distortion;
    u.logoStrength.value = logoStrength;
    u.logoOnTop.value = logoOnTop ? 1.0 : 0.0;
    u.logoOpacity.value = Math.max(0, Math.min(logoOpacity ?? 1.0, 1));
    u.logoPopScaleFrom.value = Math.max(0.0, Math.min(popScaleFrom ?? 0.92, 1.0));
    u.logoRevealSoftness.value = Math.max(0.0, Math.min(popRevealSoftness ?? 0.06, 0.3));

    // Update ray origin on-the-fly
    const { clientWidth: wCSS, clientHeight: hCSS } = el;
    const w = wCSS * (r.dpr || 1), h = hCSS * (r.dpr || 1);
    const { anchor, dir } = getAnchorAndDir(raysOrigin, w, h);
    u.rayPos.value = anchor;
    u.rayDir.value = dir;

    updateLogoUV();
  }, [
    raysColor,
    raysSpeed,
    lightSpread,
    raysOrigin,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    mouseInfluence,
    noiseAmount,
    distortion,
    logoStrength,
    logoFit,
    logoScale,
    popScaleFrom,
    popRevealSoftness,
    logoOnTop,
    logoOpacity,
  ]);

  const classes = ['light-rays-container', className || ''].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      className={classes}
      aria-hidden="true"
      style={{
        contain: 'strict',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
      }}
    />
  );
};

export default LightRays;
