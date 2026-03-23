"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface StarFieldProps {
  year: number;
}

const MIN_YEAR = -3000;
const MAX_YEAR = 2024;
const YEAR_RANGE = MAX_YEAR - MIN_YEAR;

/** Map year to a 0–1 "modernity" factor (0 = BCE, 1 = modern) */
function modernityFactor(year: number): number {
  return (year - MIN_YEAR) / YEAR_RANGE;
}

export default function StarField({ year }: StarFieldProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef(year);
  const warpRef = useRef(false);
  const warpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetBrightnessRef = useRef(1.0);
  const currentBrightnessRef = useRef(1.0);

  // Trigger warp burst + update target brightness when year changes
  useEffect(() => {
    if (yearRef.current === year) return;
    yearRef.current = year;

    // Trigger warp
    warpRef.current = true;
    if (warpTimerRef.current) clearTimeout(warpTimerRef.current);
    warpTimerRef.current = setTimeout(() => {
      warpRef.current = false;
    }, 1000);

    // Modern years = brighter (0.6–1.0), ancient = dimmer (0.2–0.6)
    const f = modernityFactor(year);
    targetBrightnessRef.current = 0.2 + f * 0.8;
  }, [year]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isMobile = window.innerWidth < 768;
    const STAR_COUNT = isMobile ? 800 : 2000;
    const HEIGHT = 300;

    // ── Scene ────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / HEIGHT,
      0.1,
      2000
    );
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(mount.clientWidth, HEIGHT);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Stars ────────────────────────────────────────────────────
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2000 - 500;
      const brightness = Math.random() * 0.5 + 0.5;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    // ── Animation ────────────────────────────────────────────────
    const NORMAL_SPEED = 0.8;
    const WARP_SPEED = 12;
    let animId: number;

    // Set initial brightness based on current year
    const f = modernityFactor(yearRef.current);
    targetBrightnessRef.current = 0.2 + f * 0.8;
    currentBrightnessRef.current = targetBrightnessRef.current;
    material.opacity = currentBrightnessRef.current;

    function animate() {
      animId = requestAnimationFrame(animate);

      const speed = warpRef.current ? WARP_SPEED : NORMAL_SPEED;
      const pos = geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < STAR_COUNT; i++) {
        pos[i * 3 + 2] += speed;
        if (pos[i * 3 + 2] > 600) {
          pos[i * 3 + 2] = -1500;
          pos[i * 3] = (Math.random() - 0.5) * 2000;
          pos[i * 3 + 1] = (Math.random() - 0.5) * 1000;
        }
      }
      geometry.attributes.position.needsUpdate = true;

      // Smoothly lerp brightness toward target
      const target = targetBrightnessRef.current;
      const current = currentBrightnessRef.current;
      if (Math.abs(target - current) > 0.001) {
        currentBrightnessRef.current = current + (target - current) * 0.02;
        material.opacity = currentBrightnessRef.current;
      }

      renderer.render(scene, camera);
    }

    animate();

    // ── Resize ───────────────────────────────────────────────────
    function handleResize() {
      if (!mount) return;
      const w = mount.clientWidth;
      renderer.setSize(w, HEIGHT);
      camera.aspect = w / HEIGHT;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      if (warpTimerRef.current) clearTimeout(warpTimerRef.current);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full"
      style={{ height: "300px", overflow: "hidden" }}
    />
  );
}
