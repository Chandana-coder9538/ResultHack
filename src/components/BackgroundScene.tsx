import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';

interface BackgroundSceneProps {
  className?: string;
}

// Fallback gradient for prefers-reduced-motion or WebGL failure
const FallbackGradient: React.FC = () => (
  <div
    className="fixed inset-0 pointer-events-none -z-10"
    style={{
      background: 'linear-gradient(135deg, #0a1128 0%, #1a1145 50%, #0b3a6b 100%)',
    }}
  />
);

export const BackgroundScene: React.FC<BackgroundSceneProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);

  useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // 1. Accessibility: Check user preference for reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      setPrefersReducedMotion(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrameId: number | null = null;
    let isTabVisible = !document.hidden;

    try {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // 2. Scene, Camera, Renderer
      const scene = new THREE.Scene();
      // Light atmospheric fog matching the navy-aurora theme
      scene.fog = new THREE.FogExp2(0x0a1128, 0.02);

      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
      camera.position.set(0, 0, 18);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;

      container.appendChild(renderer.domElement);

      // 3. Vibrant Academic Lighting
      const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6);
      scene.add(ambientLight);

      const cyanKeyLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
      cyanKeyLight.position.set(12, 14, 14);
      scene.add(cyanKeyLight);

      const violetFillLight = new THREE.DirectionalLight(0xa855f7, 1.5);
      violetFillLight.position.set(-14, -8, 12);
      scene.add(violetFillLight);

      const bluePointLight = new THREE.PointLight(0x3b82f6, 2.2, 45);
      bluePointLight.position.set(4, 3, 6);
      scene.add(bluePointLight);

      // Root Objects Group
      const sceneObjects = new THREE.Group();
      scene.add(sceneObjects);

      // Array for floating physics items
      const floatingItems: {
        mesh: THREE.Object3D;
        rotSpeed: { x: number; y: number; z: number };
        floatSpeed: number;
        floatOffset: number;
        initialY: number;
      }[] = [];

      // Array for rising dynamic bar columns
      const dynamicBars: {
        mesh: THREE.Mesh;
        baseHeight: number;
        speed: number;
        phase: number;
      }[] = [];

      // =========================================================================
      // A. LARGE GLOWING WIREFRAME GLOBE OF CONNECTED DATA NODES (Center-Right)
      // =========================================================================
      const globeGroup = new THREE.Group();
      globeGroup.position.set(5.5, 0.8, -4.5);

      // 1. Outer Wireframe Sphere
      const globeRadius = 4.2;
      const globeGeo = new THREE.IcosahedronGeometry(globeRadius, 2);
      const globeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
      });
      const globeMesh = new THREE.Mesh(globeGeo, globeMat);
      globeGroup.add(globeMesh);

      // 2. Glowing Data Nodes at Sphere Vertices
      const nodeGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.0,
      });

      const posAttribute = globeGeo.attributes.position;
      for (let i = 0; i < posAttribute.count; i += 3) {
        const x = posAttribute.getX(i);
        const y = posAttribute.getY(i);
        const z = posAttribute.getZ(i);
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.set(x, y, z);
        globeGroup.add(node);
      }

      // 3. Orbital Glowing Rings around Globe
      const ringGeo = new THREE.TorusGeometry(4.7, 0.04, 16, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xc084fc,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7,
      });
      const orbitRing1 = new THREE.Mesh(ringGeo, ringMat);
      orbitRing1.rotation.x = Math.PI / 3;
      orbitRing1.rotation.y = Math.PI / 6;
      globeGroup.add(orbitRing1);

      const ringMat2 = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.7,
      });
      const orbitRing2 = new THREE.Mesh(ringGeo, ringMat2);
      orbitRing2.rotation.x = -Math.PI / 4;
      orbitRing2.rotation.y = Math.PI / 4;
      globeGroup.add(orbitRing2);

      // 4. Inner Glowing Core
      const coreGeo = new THREE.SphereGeometry(1.6, 24, 24);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x4f46e5,
        emissive: 0x6366f1,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        transparent: true,
        opacity: 0.8,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      globeGroup.add(coreMesh);

      sceneObjects.add(globeGroup);

      // =========================================================================
      // B. FLOATING 3D PROPS: GRADUATION CAPS, OPEN BOOKS, CERTIFICATES & BARS
      // =========================================================================

      // Helper: 3D Graduation Cap
      const createCap = () => {
        const group = new THREE.Group();
        const boardGeo = new THREE.BoxGeometry(2.2, 0.08, 2.2);
        const capMat = new THREE.MeshStandardMaterial({
          color: 0x1e1b4b,
          roughness: 0.3,
          metalness: 0.3,
          emissive: 0x0f172a,
        });
        const board = new THREE.Mesh(boardGeo, capMat);
        group.add(board);

        const skullGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.6, 16);
        const skull = new THREE.Mesh(skullGeo, capMat);
        skull.position.y = -0.32;
        group.add(skull);

        const buttonGeo = new THREE.SphereGeometry(0.09, 8, 8);
        const goldMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          metalness: 0.8,
          roughness: 0.2,
          emissive: 0xd97706,
          emissiveIntensity: 0.6,
        });
        const button = new THREE.Mesh(buttonGeo, goldMat);
        button.position.y = 0.08;
        group.add(button);

        const tasselGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
        const tassel = new THREE.Mesh(tasselGeo, goldMat);
        tassel.position.set(0.6, -0.35, 0.6);
        tassel.rotation.z = 0.3;
        group.add(tassel);

        return group;
      };

      // Helper: 3D Open Book
      const createBook = () => {
        const group = new THREE.Group();
        const pageMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.3,
          roughness: 0.4,
        });
        const coverMat = new THREE.MeshStandardMaterial({
          color: 0x4f46e5,
          emissive: 0x4338ca,
          emissiveIntensity: 0.4,
          roughness: 0.3,
        });

        const pageGeo = new THREE.BoxGeometry(1.0, 0.06, 1.4);
        const leftPage = new THREE.Mesh(pageGeo, pageMat);
        leftPage.position.set(-0.48, 0.08, 0);
        leftPage.rotation.z = 0.24;
        group.add(leftPage);

        const rightPage = new THREE.Mesh(pageGeo, pageMat);
        rightPage.position.set(0.48, 0.08, 0);
        rightPage.rotation.z = -0.24;
        group.add(rightPage);

        const spineGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.42, 8, 1, false, 0, Math.PI);
        const spine = new THREE.Mesh(spineGeo, coverMat);
        spine.rotation.x = Math.PI / 2;
        spine.position.y = -0.05;
        group.add(spine);

        return group;
      };

      // Helper: 3D Rolled Diploma Certificate
      const createDiplomaCertificate = () => {
        const group = new THREE.Group();

        // Rolled Parchment Cylinder
        const rollGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.4, 24);
        const rollMat = new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xca8a04,
          emissiveIntensity: 0.3,
          roughness: 0.4,
        });
        const roll = new THREE.Mesh(rollGeo, rollMat);
        roll.rotation.z = Math.PI / 4;
        group.add(roll);

        // Golden Ribbon Band
        const ribbonGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 24);
        const ribbonMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          metalness: 0.8,
          roughness: 0.2,
          emissive: 0xd97706,
          emissiveIntensity: 0.7,
        });
        const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
        ribbon.rotation.z = Math.PI / 4;
        group.add(ribbon);

        // Red Wax Seal Medal
        const sealGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16);
        const sealMat = new THREE.MeshStandardMaterial({
          color: 0xe11d48,
          emissive: 0xbe123c,
          emissiveIntensity: 0.5,
          roughness: 0.3,
        });
        const seal = new THREE.Mesh(sealGeo, sealMat);
        seal.position.set(0, 0, 0.38);
        group.add(seal);

        return group;
      };

      // Helper: Rising Bar-Chart Columns
      const createRisingBarChart = () => {
        const chartGroup = new THREE.Group();
        const colors = [0xf43f5e, 0xf59e0b, 0x10b981, 0x06b6d4, 0x3b82f6, 0x8b5cf6];
        const baseHeights = [0.8, 1.4, 2.2, 3.2, 4.0, 3.1];

        // Platform base
        const baseGeo = new THREE.BoxGeometry(colors.length * 0.7 + 0.3, 0.12, 0.8);
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.4,
          metalness: 0.5,
          emissive: 0x0f172a,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = -0.06;
        chartGroup.add(base);

        colors.forEach((col, i) => {
          const barGeo = new THREE.BoxGeometry(0.46, 1, 0.46);
          barGeo.translate(0, 0.5, 0); // Scale upwards from base

          const barMat = new THREE.MeshStandardMaterial({
            color: col,
            roughness: 0.2,
            metalness: 0.4,
            transparent: true,
            opacity: 0.9,
            emissive: col,
            emissiveIntensity: 0.5,
          });

          const bar = new THREE.Mesh(barGeo, barMat);
          const xPos = (i - (colors.length - 1) / 2) * 0.68;
          bar.position.set(xPos, 0, 0);
          bar.scale.y = baseHeights[i];
          chartGroup.add(bar);

          // Glowing Cap on top of bar
          const capGeo = new THREE.BoxGeometry(0.5, 0.08, 0.5);
          const capMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: col,
            emissiveIntensity: 0.9,
          });
          const cap = new THREE.Mesh(capGeo, capMat);
          cap.position.set(0, 1.0, 0);
          bar.add(cap);

          dynamicBars.push({
            mesh: bar,
            baseHeight: baseHeights[i],
            speed: 1.4 + i * 0.2,
            phase: i * 0.6,
          });
        });

        return chartGroup;
      };

      // Place Props in 3D Space
      const cap1 = createCap();
      cap1.position.set(-6.5, 3.8, -4.0);
      cap1.scale.set(0.9, 0.9, 0.9);
      sceneObjects.add(cap1);

      const cap2 = createCap();
      cap2.position.set(1.5, -5.5, -3.5);
      cap2.scale.set(0.8, 0.8, 0.8);
      sceneObjects.add(cap2);

      const book1 = createBook();
      book1.position.set(-7.5, -2.5, -4.5);
      book1.scale.set(0.9, 0.9, 0.9);
      sceneObjects.add(book1);

      const diploma1 = createDiplomaCertificate();
      diploma1.position.set(-2.5, 5.2, -4.5);
      diploma1.scale.set(0.85, 0.85, 0.85);
      sceneObjects.add(diploma1);

      const barChart = createRisingBarChart();
      barChart.position.set(-6.8, -3.5, -3.0);
      barChart.scale.set(0.85, 0.85, 0.85);
      barChart.rotation.set(0.25, 0.5, 0);
      sceneObjects.add(barChart);

      // Register items for gentle floating
      [
        { obj: cap1, y: 3.8 },
        { obj: cap2, y: -5.5 },
        { obj: book1, y: -2.5 },
        { obj: diploma1, y: 5.2 },
        { obj: barChart, y: -3.5 },
      ].forEach((item, idx) => {
        floatingItems.push({
          mesh: item.obj,
          rotSpeed: {
            x: (Math.random() - 0.5) * 0.003,
            y: (Math.random() - 0.5) * 0.005,
            z: (Math.random() - 0.5) * 0.002,
          },
          floatSpeed: 0.001 + idx * 0.0004,
          floatOffset: idx * 1.3,
          initialY: item.y,
        });
      });

      // =========================================================================
      // C. GLOWING PARTICLE STARS & CONSTELLATION CONNECTING LINES (Blue, Cyan, Violet)
      // =========================================================================
      const particleCount = 120;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleVelocities: { x: number; y: number; z: number }[] = [];

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        particlePositions[i3] = (Math.random() - 0.5) * 30;
        particlePositions[i3 + 1] = (Math.random() - 0.5) * 20;
        particlePositions[i3 + 2] = (Math.random() - 0.5) * 16 - 2;

        particleVelocities.push({
          x: (Math.random() - 0.5) * 0.007,
          y: (Math.random() - 0.5) * 0.007,
          z: (Math.random() - 0.5) * 0.004,
        });
      }

      const particlesGeometry = new THREE.BufferGeometry();
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

      // Circular Glowing Texture
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(0, 240, 255, 1)');
        grad.addColorStop(0.3, 'rgba(168, 85, 247, 0.7)');
        grad.addColorStop(0.7, 'rgba(59, 130, 246, 0.3)');
        grad.addColorStop(1, 'rgba(10, 17, 40, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
      }
      const particleTexture = new THREE.CanvasTexture(canvas);

      const particlesMaterial = new THREE.PointsMaterial({
        size: 0.5,
        map: particleTexture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particleSystem);

      // Dynamic Constellation Connecting Lines
      const maxConnections = 200;
      const linePositions = new Float32Array(maxConnections * 2 * 3);
      const linesGeometry = new THREE.BufferGeometry();
      linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

      const linesMaterial = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
      scene.add(linesMesh);

      // =========================================================================
      // D. MOUSE PARALLAX & EVENT LISTENERS
      // =========================================================================
      let mouseX = 0;
      let mouseY = 0;
      let targetCameraX = 0;
      let targetCameraY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('mousemove', handleMouseMove, { passive: true });

      const handleResize = () => {
        if (!renderer) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      const handleVisibilityChange = () => {
        isTabVisible = !document.hidden;
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // =========================================================================
      // E. ANIMATION RENDER LOOP
      // =========================================================================
      let clockTime = 0;

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        // Pause animation when tab is inactive to preserve battery & CPU
        if (!isTabVisible) return;

        clockTime += 0.016;

        // Route-specific camera positioning & tilt
        const currentPath = currentPathRef.current;
        let routeCameraOffsetX = 0;
        let routeCameraOffsetY = 0;

        if (currentPath === '/college/login' || currentPath === '/department/login') {
          routeCameraOffsetX = 1.2;
          routeCameraOffsetY = 0.3;
        } else if (currentPath === '/college/register' || currentPath === '/department/register') {
          routeCameraOffsetX = -1.2;
          routeCameraOffsetY = 0.3;
        } else if (currentPath === '/department/dashboard') {
          routeCameraOffsetX = 0;
          routeCameraOffsetY = 1.0;
        }

        // Smooth camera parallax towards cursor + route offset
        targetCameraX = mouseX * 1.5 + routeCameraOffsetX;
        targetCameraY = mouseY * 1.0 + routeCameraOffsetY;
        camera.position.x += (targetCameraX - camera.position.x) * 0.04;
        camera.position.y += (targetCameraY - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

        // 1. Rotate the large wireframe globe and its orbital rings
        globeGroup.rotation.y += 0.003;
        globeGroup.rotation.x = Math.sin(clockTime * 0.3) * 0.08;
        orbitRing1.rotation.z += 0.006;
        orbitRing2.rotation.z -= 0.005;

        // 2. Gentle floating for academic result props
        floatingItems.forEach((item) => {
          item.mesh.rotation.x += item.rotSpeed.x;
          item.mesh.rotation.y += item.rotSpeed.y;
          item.mesh.position.y = item.initialY + Math.sin(clockTime * 0.8 + item.floatOffset) * 0.35;
        });

        // 3. Dynamic bar-chart column oscillation
        dynamicBars.forEach((bar) => {
          const osc = Math.sin(clockTime * bar.speed + bar.phase) * 0.45;
          bar.mesh.scale.y = Math.max(0.4, bar.baseHeight + osc);
        });

        // 4. Constellation nodes drift & boundary wrapping
        const posAttr = particlesGeometry.attributes.position as THREE.BufferAttribute;
        const posArray = posAttr.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          posArray[i3] += particleVelocities[i].x;
          posArray[i3 + 1] += particleVelocities[i].y;
          posArray[i3 + 2] += particleVelocities[i].z;

          if (Math.abs(posArray[i3]) > 15) particleVelocities[i].x *= -1;
          if (Math.abs(posArray[i3 + 1]) > 10) particleVelocities[i].y *= -1;
          if (Math.abs(posArray[i3 + 2]) > 9) particleVelocities[i].z *= -1;
        }
        posAttr.needsUpdate = true;

        // 5. Connect nearby constellation nodes with glowing cyan lines
        let lineVertexIndex = 0;
        const linePosArray = (linesGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        const maxDist = 3.6;

        for (let i = 0; i < particleCount && lineVertexIndex < maxConnections * 6; i++) {
          const i3 = i * 3;
          const x1 = posArray[i3];
          const y1 = posArray[i3 + 1];
          const z1 = posArray[i3 + 2];

          for (let j = i + 1; j < particleCount && lineVertexIndex < maxConnections * 6; j++) {
            const j3 = j * 3;
            const x2 = posArray[j3];
            const y2 = posArray[j3 + 1];
            const z2 = posArray[j3 + 2];

            const dx = x1 - x2;
            const dy = y1 - y2;
            const dz = z1 - z2;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < maxDist * maxDist) {
              linePosArray[lineVertexIndex++] = x1;
              linePosArray[lineVertexIndex++] = y1;
              linePosArray[lineVertexIndex++] = z1;

              linePosArray[lineVertexIndex++] = x2;
              linePosArray[lineVertexIndex++] = y2;
              linePosArray[lineVertexIndex++] = z2;
            }
          }
        }

        while (lineVertexIndex < linePosArray.length) {
          linePosArray[lineVertexIndex++] = 0;
        }
        (linesGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

        renderer?.render(scene, camera);
      };

      animate();

      // Cleanup
      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibilityChange);

        if (renderer && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (err) {
      console.warn('WebGL initialization failed, using CSS Aurora fallback:', err);
      setHasError(true);
    }
  }, []);

  if (hasError || prefersReducedMotion) {
    return <FallbackGradient />;
  }

  return (
    <>
      {/* Soft Moving Aurora Gradient Layer (#0a1128 -> #1a1145 -> #0b3a6b) */}
      <div
        className="fixed inset-0 pointer-events-none -z-20 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0a1128 0%, #1a1145 45%, #0b3a6b 100%)',
        }}
      >
        {/* Soft fluid glowing radial aurora orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 right-10 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl" />
      </div>

      {/* Three.js 3D WebGL Canvas Layer - Clearly Visible Behind Content */}
      <div
        ref={containerRef}
        className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-95"
      />
    </>
  );
};
