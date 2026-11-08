/**
 * Atmospheric Three.js hero for JustWex landing.
 * Uses the supported ES module build (current Three releases no longer ship a UMD bundle).
 * Caps DPR, scales particle count for mobile, pauses when hidden/offscreen,
 * and exits cleanly when WebGL or motion preferences disallow it.
 */
export const THREE_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

if (typeof document !== "undefined") {
  const canvas = document.getElementById("hero-canvas");
  if (canvas) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) {
      canvas.hidden = true;
    } else {
      import(THREE_MODULE_URL)
        .then((THREE) => {
          try {
            boot(THREE);
          } catch (err) {
            canvas.hidden = true;
          }
        })
        .catch(() => {
          canvas.hidden = true;
        });
    }
  }
}

function boot(THREE) {
  const canvasEl = document.getElementById("hero-canvas");
  if (!canvasEl || !THREE || !THREE.WebGLRenderer) {
    if (canvasEl) canvasEl.hidden = true;
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hero = canvasEl.closest(".hero") || canvasEl.parentElement;
  let width = 0;
  let height = 0;
  let running = false;
  let visible = true;
  let pageVisible = document.visibilityState !== "hidden";
  let raf = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const clock = new THREE.Clock();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch (err) {
    canvasEl.hidden = true;
    return;
  }

  if (!renderer.getContext()) {
    canvasEl.hidden = true;
    renderer.dispose();
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.15, 6.2);

  const isMobile = window.matchMedia("(max-width: 720px)").matches;
  const count = isMobile ? 90 : 180;
  const positions = new Float32Array(count * 3);
  const baseY = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    baseY[i] = (Math.random() - 0.5) * 5.5;
    positions[i * 3 + 1] = baseY[i];
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4.5;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  function getAccentColor() {
    const styles = getComputedStyle(document.documentElement);
    const raw = styles.getPropertyValue("--accent").trim() || "#0b6e74";
    try {
      return new THREE.Color(raw);
    } catch (err) {
      return new THREE.Color("#0b6e74");
    }
  }

  let accent = getAccentColor();
  const material = new THREE.PointsMaterial({
    color: accent,
    size: isMobile ? 0.035 : 0.045,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const ribbonGeo = new THREE.TorusGeometry(2.35, 0.015, 12, isMobile ? 64 : 120);
  const ribbonMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.22,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.rotation.x = Math.PI * 0.42;
  ribbon.rotation.y = Math.PI * 0.18;
  scene.add(ribbon);

  const ribbon2 = ribbon.clone();
  ribbon2.scale.setScalar(1.28);
  ribbon2.material = ribbonMat.clone();
  ribbon2.material.opacity = 0.12;
  ribbon2.rotation.x = Math.PI * 0.28;
  ribbon2.rotation.z = Math.PI * 0.2;
  scene.add(ribbon2);

  function syncAccent() {
    accent = getAccentColor();
    material.color.copy(accent);
    ribbonMat.color.copy(accent);
    ribbon2.material.color.copy(accent);
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
  }

  function onPointer(event) {
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    pointer.tx = ((clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.ty = ((clientY - rect.top) / rect.height - 0.5) * 2;
  }

  function shouldRun() {
    return visible && pageVisible && !reduceMotion.matches;
  }

  function start() {
    if (running || !shouldRun()) return;
    running = true;
    clock.start();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const t = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    const pos = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] = baseY[i] + Math.sin(t * 0.55 + phases[i]) * 0.12;
    }
    geometry.attributes.position.needsUpdate = true;

    points.rotation.y = t * 0.04 + pointer.x * 0.12;
    points.rotation.x = pointer.y * 0.08;
    ribbon.rotation.z = t * 0.08;
    ribbon2.rotation.z = -t * 0.05;
    camera.position.x = pointer.x * 0.35;
    camera.position.y = 0.15 - pointer.y * 0.2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  resize();
  syncAccent();

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });

  document.addEventListener("visibilitychange", function () {
    pageVisible = document.visibilityState !== "hidden";
    if (shouldRun()) start();
    else stop();
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        visible = entries[0] && entries[0].isIntersecting;
        if (shouldRun()) start();
        else stop();
      },
      { threshold: 0.08 }
    );
    io.observe(hero);
  } else {
    visible = true;
  }

  if (typeof MutationObserver !== "undefined") {
    const mo = new MutationObserver(syncAccent);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", function () {
      if (reduceMotion.matches) {
        stop();
        canvasEl.hidden = true;
      } else {
        canvasEl.hidden = false;
        syncAccent();
        if (shouldRun()) start();
      }
    });
  }

  start();
}
