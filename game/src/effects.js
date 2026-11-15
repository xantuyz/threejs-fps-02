// Visual effects from fixed pools — nothing is `new` per shot. One tracer line
// per shooter slot, a ring of spark sprites, and one blast sphere. Effects only
// read state; they never decide damage.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACER_SLOTS = 10;
const SPARK_SLOTS = 12;
const TRACER_LIFE = 0.06;
const SPARK_LIFE = 0.25;

export function createEffects(scene) {
  const tracers = [];
  const tracerMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9 });
  for (let i = 0; i < TRACER_SLOTS; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geometry, tracerMaterial);
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }

  const sparks = [];
  const sparkGeometry = new THREE.SphereGeometry(0.05, 6, 4);
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) });
  for (let i = 0; i < SPARK_SLOTS; i += 1) {
    const mesh = new THREE.Mesh(sparkGeometry, sparkMaterial);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, life: 0 });
  }

  const blast = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.sky), transparent: true, opacity: 0, depthWrite: false }),
  );
  blast.visible = false;
  scene.add(blast);
  const blastLight = new THREE.PointLight(new THREE.Color(PALETTE.sky), 0, 14);
  scene.add(blastLight);
  let blastLife = 0;
  let tracerCursor = 0;
  let sparkCursor = 0;

  function step(dt) {
    for (const tracer of tracers) {
      if (tracer.life <= 0) continue;
      tracer.life -= dt;
      if (tracer.life <= 0) tracer.line.visible = false;
    }
    for (const spark of sparks) {
      if (spark.life <= 0) continue;
      spark.life -= dt;
      spark.mesh.scale.setScalar(Math.max(0.01, spark.life / SPARK_LIFE));
      if (spark.life <= 0) spark.mesh.visible = false;
    }
    if (blastLife > 0) {
      blastLife -= dt;
      const t = Math.max(0, blastLife / 0.5);
      blast.scale.setScalar(1 + (1 - t) * 4);
      blast.material.opacity = t * 0.55;
      blastLight.intensity = t * 40;
      if (blastLife <= 0) { blast.visible = false; blastLight.intensity = 0; }
    }
  }

  return {
    step,
    tracer(from, to) {
      const slot = tracers[tracerCursor];
      tracerCursor = (tracerCursor + 1) % TRACER_SLOTS;
      const positions = slot.line.geometry.attributes.position.array;
      positions[0] = from.x; positions[1] = from.y; positions[2] = from.z;
      positions[3] = to.x; positions[4] = to.y; positions[5] = to.z;
      slot.line.geometry.attributes.position.needsUpdate = true;
      slot.line.visible = true;
      slot.life = TRACER_LIFE;
    },
    spark(at) {
      const slot = sparks[sparkCursor];
      sparkCursor = (sparkCursor + 1) % SPARK_SLOTS;
      slot.mesh.position.copy(at);
      slot.mesh.visible = true;
      slot.life = SPARK_LIFE;
    },
    blastAt(at) {
      blast.position.copy(at);
      blast.visible = true;
      blastLife = 0.5;
      // Show the blast immediately, not only after step() runs — a frozen
      // ?shot= frame must see the explosion too.
      blast.scale.setScalar(2.5);
      blast.material.opacity = 0.5;
      blastLight.position.copy(at);
      blastLight.intensity = 30;
    },
  };
}
