import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import type { WebGLRenderer } from "three";

const VectorScreenShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    damage: { value: 0 },
    scan: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    lowQuality: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float damage;
    uniform float scan;
    uniform float lowQuality;
    uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float wave = sin(uv.y * 32.0 + time * 15.0) * damage * 0.006;
      uv.x += wave;
      vec3 color = texture2D(tDiffuse, uv).rgb;
      float lines = lowQuality > 0.5 ? 0.96 : 0.88 + 0.12 * sin(uv.y * resolution.y * 0.55);
      float noise = (hash(uv + fract(time)) - 0.5) * (lowQuality > 0.5 ? 0.015 : 0.035);
      float vignette = smoothstep(0.85, 0.18, length(uv - 0.5));
      color *= lines * (0.78 + vignette * 0.28);
      color += noise + scan * vec3(0.08, 0.2, 0.18);
      color.r += damage * 0.13;
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export class PostProcessing {
  private readonly composer: EffectComposer;
  private readonly finalPass: ShaderPass;
  private readonly bloom: UnrealBloomPass;
  private damage = 0;
  private scan = 0;

  constructor(renderer: WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, private readonly lowPerformance: boolean) {
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(Math.min(devicePixelRatio, lowPerformance ? 0.8 : 1.35));
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), lowPerformance ? 0.45 : 0.82, 0.38, 0.42);
    this.composer.addPass(this.bloom);
    if (!lowPerformance) {
      const afterimage = new AfterimagePass(0.86);
      this.composer.addPass(afterimage);
    }
    this.finalPass = new ShaderPass(VectorScreenShader);
    this.finalPass.uniforms.lowQuality!.value = lowPerformance ? 1 : 0;
    this.composer.addPass(this.finalPass);
    this.resize();
  }

  render(dt: number, elapsed: number): void {
    this.damage = Math.max(0, this.damage - dt * 2.5);
    this.scan = Math.max(0, this.scan - dt * 1.8);
    this.finalPass.uniforms.time!.value = elapsed;
    this.finalPass.uniforms.damage!.value = this.damage;
    this.finalPass.uniforms.scan!.value = this.scan;
    this.composer.render(dt);
  }

  triggerDamage(): void { this.damage = 1; }
  triggerScan(): void { this.scan = 1; }

  resize(): void {
    this.composer.setSize(innerWidth, innerHeight);
    this.finalPass.uniforms.resolution!.value.set(innerWidth, innerHeight);
    this.bloom.resolution.set(innerWidth, innerHeight);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
