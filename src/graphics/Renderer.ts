import * as THREE from "three";
import { COLORS } from "../config/graphicsConfig";

export class Renderer {
  readonly instance: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement, lowPerformance: boolean) {
    this.instance = new THREE.WebGLRenderer({ canvas, antialias: !lowPerformance, powerPreference: "high-performance" });
    this.instance.setClearColor(COLORS.background, 1);
    this.instance.setPixelRatio(Math.min(devicePixelRatio, lowPerformance ? 1 : 1.75));
    this.resize();
  }

  resize(): void {
    this.instance.setSize(innerWidth, innerHeight, false);
  }

  dispose(): void {
    this.instance.dispose();
  }
}
