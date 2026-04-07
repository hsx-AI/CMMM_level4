import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AgvCaseRunResult, AgvEdge, AgvNode } from "@/types/agv";
import slamMapUrl from "@/assets/slam-map.png";

interface UseAgvSceneOptions {
  container: HTMLElement;
  nodes: AgvNode[];
  edges: AgvEdge[];
}

interface AgvActor {
  mesh: THREE.Mesh;
  route: THREE.Vector3[];
  distanceCursor: number;
  totalDistance: number;
  speed: number;
}

export function useAgvScene(options: UseAgvSceneOptions) {
  const { container, nodes, edges } = options;

  const scene = new THREE.Scene();
  const clock = new THREE.Clock();
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  const camera = new THREE.PerspectiveCamera(
    52,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.1,
    2000
  );
  const controls = new OrbitControls(camera, renderer.domElement);

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const beforeGroup = new THREE.Group();
  const afterGroup = new THREE.Group();
  const agvGroup = new THREE.Group();
  const actors: AgvActor[] = [];

  let disposed = false;
  let playing = true;
  let animationId = 0;
  let currentResult: AgvCaseRunResult | null = null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor("#e8eef4");
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  container.appendChild(renderer.domElement);

  camera.position.set(0, 340, 200);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 80;
  controls.maxDistance = 600;
  controls.target.set(0, 0, 0);

  initScene();
  animate();

  function initScene() {
    scene.fog = new THREE.FogExp2("#e8eef4", 0.0015);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xb0c4d8, 0.9);
    scene.add(hemiLight);

    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(200, 260, 150);
    scene.add(dir);

    const fillLight = new THREE.PointLight(0x88bbff, 0.25, 600);
    fillLight.position.set(-120, 60, -90);
    scene.add(fillLight);

    const textureLoader = new THREE.TextureLoader();
    const slamTexture = textureLoader.load(slamMapUrl);
    slamTexture.colorSpace = THREE.SRGBColorSpace;
    slamTexture.minFilter = THREE.LinearFilter;
    slamTexture.magFilter = THREE.LinearFilter;

    const mapWidth = 262;
    const mapHeight = 297;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshStandardMaterial({
        map: slamTexture,
        roughness: 0.9,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    scene.add(ground);

    scene.add(buildNetworkLines());
    scene.add(buildNodeMarkers());
    scene.add(beforeGroup);
    scene.add(afterGroup);
    scene.add(agvGroup);
  }

  function buildNetworkLines() {
    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
      color: "#6b9fd4",
      transparent: true,
      opacity: 0.5
    });
    edges.forEach((edge) => {
      const n1 = nodeMap.get(edge.from);
      const n2 = nodeMap.get(edge.to);
      if (!n1 || !n2) return;
      const points = [
        new THREE.Vector3(n1.x, 0.28, n1.z),
        new THREE.Vector3(n2.x, 0.28, n2.z)
      ];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat));
    });
    return group;
  }

  function buildNodeMarkers() {
    const group = new THREE.Group();
    const geometry = new THREE.CylinderGeometry(1.6, 1.6, 0.6, 10);
    const material = new THREE.MeshStandardMaterial({
      color: "#4a90c4",
      emissive: "#4a90c4",
      emissiveIntensity: 0.1
    });
    nodes.forEach((node) => {
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(node.x, 0.2, node.z);
      group.add(marker);
    });
    return group;
  }

  function setCaseResult(result: AgvCaseRunResult) {
    currentResult = result;
    clearGroup(beforeGroup);
    clearGroup(afterGroup);
    clearGroup(agvGroup);
    actors.splice(0, actors.length);

    result.beforeLines.forEach((item) => {
      beforeGroup.add(createPathLine(item.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)), "#dc2626"));
    });
    result.afterLines.forEach((item) => {
      afterGroup.add(createPathLine(item.points.map((p) => new THREE.Vector3(p.x, p.y + 0.25, p.z)), "#16a34a"));
    });

    result.agvRoutes.forEach((route, index) => {
      const points = route.points.map((point) => new THREE.Vector3(point.x, point.y, point.z));
      if (!points.length) return;
      const agvColor = ["#2b6cb0", "#d97706", "#16a34a"][index % 3];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 3.2, 6.8),
        new THREE.MeshStandardMaterial({
          color: agvColor,
          emissive: agvColor,
          emissiveIntensity: 0.08,
          metalness: 0.3,
          roughness: 0.4
        })
      );
      mesh.position.copy(points[0]);
      mesh.position.y = 2.4;
      agvGroup.add(mesh);
      actors.push({
        mesh,
        route: points,
        distanceCursor: 0,
        totalDistance: computePolylineDistance(points),
        speed: 28 + index * 3
      });
    });
  }

  function play() {
    playing = true;
  }

  function pause() {
    playing = false;
  }

  function reset() {
    actors.forEach((actor) => {
      actor.distanceCursor = 0;
      if (actor.route.length) {
        actor.mesh.position.copy(actor.route[0]);
        actor.mesh.position.y = 2.4;
      }
    });
  }

  function resize() {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function destroy() {
    disposed = true;
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", resize);
    controls.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        const material = obj.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
    container.removeChild(renderer.domElement);
  }

  function animate() {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (playing) {
      actors.forEach((actor) => {
        if (!actor.route.length || actor.totalDistance <= 0) return;
        actor.distanceCursor += actor.speed * delta;
        if (actor.distanceCursor > actor.totalDistance) {
          actor.distanceCursor = actor.totalDistance;
        }
        const pos = samplePolyline(actor.route, actor.distanceCursor);
        actor.mesh.position.set(pos.x, 2.4, pos.z);
      });
    }

    controls.update();
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", resize);

  return {
    setCaseResult,
    play,
    pause,
    reset,
    resize,
    destroy,
    getCurrentResult: () => currentResult
  };
}

function createPathLine(points: THREE.Vector3[], color: string) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.88
    })
  );
}

function computePolylineDistance(points: THREE.Vector3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += points[i - 1].distanceTo(points[i]);
  }
  return total;
}

function samplePolyline(points: THREE.Vector3[], distance: number): THREE.Vector3 {
  if (points.length === 1) return points[0].clone();
  let rest = distance;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seg = a.distanceTo(b);
    if (rest <= seg) {
      const t = seg <= 0 ? 0 : rest / seg;
      return new THREE.Vector3().lerpVectors(a, b, t);
    }
    rest -= seg;
  }
  return points[points.length - 1].clone();
}

function clearGroup(group: THREE.Group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  }
}
