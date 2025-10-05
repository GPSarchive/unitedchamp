// src/vantatypestypes/vanta.d.ts
declare module "vanta/dist/vanta.dots.min" {
    import type * as THREE from "three";
  
    export interface VantaEffect {
      destroy: () => void;
    }
  
    export interface VantaDotsOptions {
      el: HTMLElement | string;
      THREE: typeof THREE;
      mouseControls?: boolean;
      touchControls?: boolean;
      gyroControls?: boolean;
      minHeight?: number;
      minWidth?: number;
      scale?: number;
      scaleMobile?: number;
      color?: number;            // hex like 0xc77536
      backgroundColor?: number;  // hex like 0x0b0a0a
      showLines?: boolean;
      [key: string]: unknown;    // allow extra opts without errors
    }
  
    export default function DOTS(options: VantaDotsOptions): VantaEffect;
  }
  