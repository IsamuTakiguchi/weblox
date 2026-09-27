import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildAvatar } from '../engine3d/avatar3d';
import type { AvatarConfig } from '../store/store';

/** アバター画面用：くるくる回る 3D プレビュー（Roblox のアバター画面風） */
export function AvatarPreview3D({ avatar, shirtPrint }: { avatar: AvatarConfig; shirtPrint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 1.1, 4.2);
    camera.lookAt(0, 0.85, 0);
    scene.add(new THREE.HemisphereLight('#ffffff', '#6b7280', 0.9));
    scene.add(new THREE.AmbientLight('#ffffff', 0.35));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    scene.add(sun);
    // 足元の台
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 32), new THREE.MeshLambertMaterial({ color: '#2b3448' }));
    disc.position.y = -0.06;
    disc.receiveShadow = true;
    scene.add(disc);
    const rig = buildAvatar(avatar, shirtPrint);
    scene.add(rig.group);

    const resize = () => {
      const w = canvas.clientWidth || 260;
      const h = canvas.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      t += dt;
      rig.group.rotation.y = Math.sin(t * 0.8) * 0.6 + Math.PI * 0.05;
      rig.pose(t * 6, true, true);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
    };
  }, [avatar, shirtPrint]);

  return <canvas ref={ref} className="avatar-preview" aria-label="アバターのプレビュー" />;
}

export default AvatarPreview3D;
