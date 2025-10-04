// app/OMADA/[id]/react-bits/LightRays.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { Renderer, Program, Triangle, Mesh, Texture } from 'ogl';
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

  /** URL of the logo image (e.g. team.logo) */
  logoSrc?: string;
  /** Strength of lighting in the logo area (used only in screen-blend mode) */
  logoStrength?: number; // default 1.0
  /** object-fit-like behavior for the logo */
  logoFit?: LogoFit; // default 'contain'

  /** IMAGE-ONLY pop-in (expands upward) */
  popIn?: boolean;              // default true
  popDuration?: number;         // ms, default 600
  popDelay?: number;            // ms, default 0
  popScaleFrom?: number;        // 0..1 start scale, default 0.92
  popRevealSoftness?: number;   // 0..0.3 softness of bottom reveal edge, default 0.06

  /** NEW: place the logo above rays using alpha-over */
  logoOnTop?: boolean;          // default true (Option A)
  /** NEW: how opaque the logo is when on top */
  logoOpacity?: number;         // 0..1, default 1.0
}

interface Uniforms {
  iTime: { value: number };
  iResolution: { value: Vec2 };
  rayPos: { value: Vec2 };
  rayDir: { value: Vec2 };
  raysColor: { value: Vec3 };
  raysSpeed: { value: number };
  lightSpread: { value: number };
  rayLength: { value: number };
  pulsating: { value: number };
  fadeDistance: { value: number };
  saturation: { value: number };
  mousePos: { value: Vec2 };
  mouseInfluence: { value: number };
  noiseAmount: { value: number };
  distortion: { value: number };

  // Logo uniforms
  uLogo: { value: Texture | null };
  logoEnabled: { value: number };
  logoStrength: { value: number };
  logoUV: { value: [number, number, number, number] }; // scaleX, scaleY, offsetX, offsetY

  // IMAGE-ONLY pop animation
  introProgress: { value: number };       // 0..1
  logoPopScaleFrom: { value: number };    // 0..1
  logoRevealSoftness: { value: number };  // ~0..0.2

  // NEW (Option A)
  logoOnTop: { value: number };
  logoOpacity: { value: number };
}

const hexToRgb = (hex: string): Vec3 => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? ([
        parseInt(m[1], 16) / 255,
        parseInt(m[2], 16) / 255,
        parseInt(m[3], 16) / 255,
      ] as Vec3)
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

  // image-only pop defaults
  popIn = true,
  popDuration = 600,
  popDelay = 0,
  popScaleFrom = 0.92,
  popRevealSoftness = 0.06,

  // NEW (Option A) defaults so TeamSidebar works without changes
  logoOnTop = true,
  logoOpacity = 1.0,
}: LightRaysProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uniformsRef = useRef<Uniforms | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const animationIdRef = useRef<number | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasStartedIntro, setHasStartedIntro] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Logo texture & metadata
  const logoTexRef = useRef<Texture | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const logoAspectRef = useRef<number | null>(null); // width / height

  // Timing for image-only intro
  const introStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => setIsVisible(entries[0].isIntersecting),
      { threshold: 0.01, rootMargin: '0px 0px -10% 0px' }
    );
    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  /** Recompute UV for contain/cover/stretch (+ safe center & optional zoom-out) */
  const updateLogoUV = () => {
    const u = uniformsRef.current;
    if (!u) return;

    if (!logoAspectRef.current || !u.iResolution.value) {
      u.logoUV.value = [1, 1, 0, 0];
      return;
    }

    const [w, h] = u.iResolution.value;
    const canvasAspect = w / h;
    const imageAspect = logoAspectRef.current;

    let scaleX = 1,
      scaleY = 1;

    if (logoFit === 'stretch') {
      scaleX = 1;
      scaleY = 1;
    } else if (logoFit === 'contain') {
      if (imageAspect > canvasAspect) {
        // image is wider than canvas -> letterbox top/bottom
        scaleX = 1;
        scaleY = canvasAspect / imageAspect;
      } else {
        // image is taller than canvas -> letterbox left/right
        scaleX = imageAspect / canvasAspect;
        scaleY = 1;
      }
    } else {
      // 'cover'
      if (imageAspect > canvasAspect) {
        // image is wider -> crop left/right
        scaleX = canvasAspect / imageAspect;
        scaleY = 1;
      } else {
        // image is taller -> crop top/bottom
        scaleX = 1;
        scaleY = imageAspect / canvasAspect;
      }
    }

    // Optional “zoom-out” so edges never get clipped by rounding
    const s = Math.min(Math.max(logoScale ?? 1, 0.1), 1.0) * 0.995; // 0.5% safety margin
    scaleX *= s;
    scaleY *= s;

    // Center the image in the remaining letterbox area
    const offsetX = (1 - scaleX) * 0.5;
    const offsetY = (1 - scaleY) * 0.5;

    u.logoUV.value = [scaleX, scaleY, offsetX, offsetY];
  };

  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    cleanupFunctionRef.current?.();

    const initializeWebGL = async () => {
      if (!containerRef.current) return;
      await new Promise((r) => setTimeout(r, 10));
      if (!containerRef.current) return;

      const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true,
      });
      rendererRef.current = renderer;

      const gl = renderer.gl;
      gl.canvas.style.width = '100%';
      gl.canvas.style.height = '100%';

      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      containerRef.current.appendChild(gl.canvas);

      const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

      const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

/* Logo uniforms */
uniform sampler2D uLogo;
uniform float logoEnabled;
uniform float logoStrength;
uniform vec4  logoUV; // scaleX, scaleY, offsetX, offsetY

/* Image-only pop uniforms */
uniform float introProgress;       // 0..1
uniform float logoPopScaleFrom;    // 0..1
uniform float logoRevealSoftness;  // ~0..0.2

/* NEW (Option A) */
uniform float logoOnTop;    // 0 = screen blend (old), 1 = alpha-over
uniform float logoOpacity;  // used when logoOnTop = 1

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  vec4 rays = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    rays.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  rays.r *= 0.1 + brightness * 0.8;
  rays.g *= 0.3 + brightness * 0.6;
  rays.b *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(rays.rgb, vec3(0.299, 0.587, 0.114));
    rays.rgb = mix(vec3(gray), rays.rgb, saturation);
  }

  rays.rgb *= raysColor;

  vec3 outColor = rays.rgb;

  if (logoEnabled > 0.5) {
    // Scale only the logo sampling UV around center for the pop effect
    float s = mix(logoPopScaleFrom, 1.0, clamp(introProgress, 0.0, 1.0));
    vec2 centered = vUv - 0.5;
    vec2 vUvScaled = centered * s + 0.5;

    // Apply letterboxing/cropping after the scale
    vec2 uv = vUvScaled * logoUV.xy + logoUV.zw;
    vec4 logo = texture2D(uLogo, uv);

    // Bottom-up reveal with softness; vUv.y=0 bottom, 1 top
    float reveal = smoothstep(-logoRevealSoftness, logoRevealSoftness, introProgress - vUv.y);

    // Mask + fade-in with progress
    float mask = logo.a * reveal * clamp(introProgress, 0.0, 1.0);

    // Two blending modes:
    //  - logoOnTop = 1.0 -> pure alpha-over (logo above rays)
    //  - logoOnTop = 0.0 -> legacy "screen-ish" mix that brightens rays with logoStrength
    vec3 logoRGB = clamp(logo.rgb, 0.0, 1.0);
    vec3 boosted = rays.rgb * (1.0 + clamp(logoStrength, 0.0, 2.0));
    vec3 screenWithLogo = 1.0 - (1.0 - logoRGB) * (1.0 - boosted);

    vec3 inside = (logoOnTop > 0.5)
      ? mix(rays.rgb, logoRGB, clamp(logoOpacity, 0.0, 1.0))   // alpha-over
      : mix(boosted, screenWithLogo, 0.5);                      // legacy screen-ish

    outColor = mix(rays.rgb, inside, mask);
  }

  fragColor = vec4(outColor, 1.0);
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

      const uniforms: Uniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },
        rayPos: { value: [0, 0] },
        rayDir: { value: [0, 1] },
        raysColor: { value: hexToRgb(raysColor) },
        raysSpeed: { value: raysSpeed },
        lightSpread: { value: lightSpread },
        rayLength: { value: rayLength },
        pulsating: { value: pulsating ? 1.0 : 0.0 },
        fadeDistance: { value: fadeDistance },
        saturation: { value: saturation },
        mousePos: { value: [0.5, 0.5] },
        mouseInfluence: { value: mouseInfluence },
        noiseAmount: { value: noiseAmount },
        distortion: { value: distortion },

        uLogo: { value: null },
        logoEnabled: { value: logoSrc ? 1 : 0 },
        logoStrength: { value: logoStrength },
        logoUV: { value: [1, 1, 0, 0] },

        // image-only pop uniforms
        introProgress: { value: popIn ? 0 : 1 },
        logoPopScaleFrom: { value: Math.max(0.0, Math.min(popScaleFrom ?? 0.92, 1.0)) },
        logoRevealSoftness: { value: Math.max(0.0, Math.min(popRevealSoftness ?? 0.06, 0.3)) },

        // NEW (Option A)
        logoOnTop: { value: logoOnTop ? 1.0 : 0.0 },
        logoOpacity: { value: Math.max(0, Math.min(logoOpacity ?? 1.0, 1)) },
      };
      uniformsRef.current = uniforms;

      const geometry = new Triangle(gl);
      const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
      const mesh = new Mesh(gl, { geometry, program });
      meshRef.current = mesh;

      // Load the logo (with safe defaults for NPOT textures)
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
        img.crossOrigin = 'anonymous'; // requires CORS if remote
        img.onload = () => {
          if (!logoTexRef.current) return;
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            console.warn('[LightRays] Logo loaded but has zero size:', logoSrc);
            uniforms.logoEnabled.value = 0;
            return;
          }
          logoTexRef.current.image = img;
          logoImageRef.current = img;
          logoAspectRef.current = img.naturalWidth / img.naturalHeight;
          updateLogoUV();
        };
        img.onerror = (e) => {
          console.warn('[LightRays] Failed to load logo (CORS?):', logoSrc, e);
          uniforms.logoEnabled.value = 0;
        };
        img.src = logoSrc;
      }

      const updatePlacement = () => {
        if (!containerRef.current || !renderer) return;

        renderer.dpr = Math.min(window.devicePixelRatio, 2);
        const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
        renderer.setSize(wCSS, hCSS);

        const dpr = renderer.dpr;
        const w = wCSS * dpr;
        const h = hCSS * dpr;

        uniforms.iResolution.value = [w, h];

        const { anchor, dir } = getAnchorAndDir(raysOrigin, w, h);
        uniforms.rayPos.value = anchor;
        uniforms.rayDir.value = dir;

        updateLogoUV();
      };

      const loop = (t: number) => {
        if (!rendererRef.current || !uniformsRef.current || !meshRef.current) return;

        // Animate introProgress for image only
        if (popIn && uniforms.introProgress.value < 1.0) {
          if (!hasStartedIntro) {
            setHasStartedIntro(true);
          }
          if (introStartRef.current == null) {
            introStartRef.current = t + (popDelay || 0);
          }
          const elapsed = Math.max(0, t - introStartRef.current);
          const p = Math.max(0, Math.min(1, popDuration > 0 ? elapsed / popDuration : 1));
          // ease-out cubic
          const eased = 1.0 - Math.pow(1.0 - p, 3.0);
          uniforms.introProgress.value = eased;
        } else if (!popIn) {
          uniforms.introProgress.value = 1.0;
        }

        uniforms.iTime.value = t * 0.001;

        if (followMouse && mouseInfluence > 0.0) {
          const smoothing = 0.92;
          smoothMouseRef.current.x =
            smoothMouseRef.current.x * smoothing + mouseRef.current.x * (1 - smoothing);
          smoothMouseRef.current.y =
            smoothMouseRef.current.y * smoothing + mouseRef.current.y * (1 - smoothing);
          uniforms.mousePos.value = [smoothMouseRef.current.x, smoothMouseRef.current.y];
        }

        try {
          rendererRef.current.render({ scene: meshRef.current });
          animationIdRef.current = requestAnimationFrame(loop);
        } catch (error) {
          console.warn('WebGL rendering error:', error);
          return;
        }
      };

      window.addEventListener('resize', updatePlacement);
      updatePlacement();
      animationIdRef.current = requestAnimationFrame(loop);

      cleanupFunctionRef.current = () => {
        if (animationIdRef.current != null) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }
        window.removeEventListener('resize', updatePlacement);

        if (renderer) {
          try {
            const canvas = renderer.gl.canvas as HTMLCanvasElement;
            const ext = renderer.gl.getExtension('WEBGL_lose_context');
            ext?.loseContext();
            canvas.parentNode?.removeChild(canvas);
          } catch (error) {
            console.warn('Error during WebGL cleanup:', error);
          }
        }

        rendererRef.current = null;
        uniformsRef.current = null;
        meshRef.current = null;
        logoTexRef.current = null;
        logoImageRef.current = null;
        logoAspectRef.current = null;
        introStartRef.current = null;
      };
    };

    initializeWebGL();

    return () => {
      cleanupFunctionRef.current?.();
      cleanupFunctionRef.current = null;
    };
  }, [
    isVisible,
    raysOrigin,
    raysColor,
    raysSpeed,
    lightSpread,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    followMouse,
    mouseInfluence,
    noiseAmount,
    distortion,
    logoSrc,
    logoStrength,
    logoFit,
    logoScale,
    popIn,
    popDuration,
    popDelay,
    popScaleFrom,
    popRevealSoftness,
    // NEW (Option A)
    logoOnTop,
    logoOpacity,
  ]);

  // Prop changes (runtime)
  useEffect(() => {
    if (!uniformsRef.current || !containerRef.current || !rendererRef.current) return;
    const u = uniformsRef.current;
    const renderer = rendererRef.current;

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

    // NEW (Option A)
    u.logoOnTop.value = logoOnTop ? 1.0 : 0.0;
    u.logoOpacity.value = Math.max(0, Math.min(logoOpacity ?? 1.0, 1));

    u.logoPopScaleFrom.value = Math.max(0.0, Math.min(popScaleFrom ?? 0.92, 1.0));
    u.logoRevealSoftness.value = Math.max(0.0, Math.min(popRevealSoftness ?? 0.06, 0.3));

    const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
    const dpr = renderer.dpr;
    const { anchor, dir } = getAnchorAndDir(raysOrigin, wCSS * dpr, hCSS * dpr);
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
    // NEW (Option A)
    logoOnTop,
    logoOpacity,
  ]);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !rendererRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current = { x, y };
    };
    if (followMouse) {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [followMouse]);

  // Container is now plain; animation happens purely in-shader on the logo
  const classes = ['light-rays-container', className || ''].filter(Boolean).join(' ');

  return <div ref={containerRef} className={classes} />;
};

export default LightRays;
