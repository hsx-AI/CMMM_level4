/**
 * 3D 厂区场景（GLB 模型 + 地面 + 仓库盒子）
 * 性能：SCENE_CONFIG.renderer 可调抗锯齿/像素比；模型卡顿时可减面（见 buildPlantScene 注释）
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import modelUrl from "@/assets/models/111.glb?url";
import type { WorkshopInfo } from "@/types/workshop";
import type { TurnoverClass, WarehouseRuntime } from "@/types/warehouse";

interface UseThreeSceneOptions {
  container: HTMLElement;
  workshops: WorkshopInfo[];
  warehouses: WarehouseRuntime[];
  onWorkshopSelect: (workshop: WorkshopInfo) => void;
  onWarehouseSelect: (warehouse: WarehouseRuntime) => void;
}

interface SceneMesh extends THREE.Mesh {
  userData: {
    kind: "workshop" | "warehouse";
    workshopId?: string;
    warehouseId?: string;
    turnoverClass?: TurnoverClass;
    groupId?: string;
  };
}

interface MeshGroup {
  id: string;
  baseName: string;
  label: string;
  node: THREE.Object3D;
  meshes: SceneMesh[];
  workshopId?: string;
}

const MESH_LABEL_MAP: Record<string, string> = {
  back: "背景",
  ground: "底面",
  Mesh_0: "主体结构",
  xq: "线圈分厂",
  sd_zz: "水电智装",
  bj: "办公区",
  qf_zx: "汽发重型",
  jg: "金工分厂",
  cj: "冲剪数字化车间",
  kz: "控制数字化车间",
  yjs_sy: "试验车间",
  sd: "水电分厂",
  qf: "汽发分厂",
  jg_zc: "金工轴承车间",
  yjk: "有色库/五金一级库",
  cj_cj: "磁极磁轭",
  yjs: "研究所试验台",
  hj: "焊接数字化车间"
};

const MESH_TO_WORKSHOP_MAP: Record<string, string> = {
  xq: "coil_factory",
  cj: "stamping_cutting_factory",
  sd: "utilities_workshop",
  yjk: "company_level1_warehouse"
};

const SCENE_CONFIG = {
  clearColor: "#e8eef4",
  fogColor: "#e8eef4",
  fogDensity: 0.003,
  camera: {
    fov: 55,
    near: 0.1,
    far: 2000,
    position: new THREE.Vector3(140, 130, 180)
  },
  hemiLight: { skyColor: 0xffffff, groundColor: 0xb0c4d8, intensity: 0.9 },
  directionalLight: { color: 0xffffff, intensity: 1.1, position: new THREE.Vector3(120, 160, 80) },
  fillLight: { color: 0x88bbff, intensity: 0.25, position: new THREE.Vector3(-80, 40, -60) },
  grid: {
    spacing: 8,
    colorCenter: 0xb0c4d8,
    colorGrid: 0xc8d6e0,
    fadeNear: 80,
    fadeFar: 400
  },
  roadColor: "#6b9fd4",
  highlightColor: "#2b6cb0",
  particles: { count: 200, spread: 280, height: 30, color: 0x94b8d8, size: 0.4, opacity: 0.2 },
  renderer: {
    antialias: false,
    powerPreference: "high-performance" as const,
    maxPixelRatio: 1.5
  }
} as const;

export function useThreeScene(options: UseThreeSceneOptions) {
  const { container, workshops, warehouses, onWorkshopSelect, onWarehouseSelect } = options;
  const workshopMap = new Map(workshops.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((item) => [item.id, item]));

  const scene = new THREE.Scene();
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const camera = new THREE.PerspectiveCamera(
    SCENE_CONFIG.camera.fov,
    container.clientWidth / Math.max(container.clientHeight, 1),
    SCENE_CONFIG.camera.near,
    SCENE_CONFIG.camera.far
  );
  camera.position.copy(SCENE_CONFIG.camera.position);

  const renderer = new THREE.WebGLRenderer({
    antialias: SCENE_CONFIG.renderer.antialias,
    alpha: false,
    powerPreference: SCENE_CONFIG.renderer.powerPreference
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, SCENE_CONFIG.renderer.maxPixelRatio)
  );
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(SCENE_CONFIG.clearColor);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.minDistance = 60;
  controls.maxDistance = 420;
  controls.maxPolarAngle = Math.PI * 0.495;

  const workshopMeshes: SceneMesh[] = [];
  const warehouseMeshes: SceneMesh[] = [];
  const selectableMeshes: SceneMesh[] = [];
  const baseMaterialState = new Map<string, { color: number; emissive: number; opacity: number }>();
  const meshGroupMap = new Map<string, MeshGroup>();
  const meshGroups: MeshGroup[] = [];
  let selectedGroup: MeshGroup | null = null;
  let disposed = false;
  let animationId = 0;
  let activeFilter: TurnoverClass | null = null;
  let isPageVisible = typeof document !== "undefined" && document.visibilityState === "visible";
  let particles: THREE.Points | null = null;
  let gridMesh: THREE.Mesh | null = null;

  interface BubbleInfo {
    el: HTMLDivElement;
    group: MeshGroup;
  }
  const bubbles: BubbleInfo[] = [];
  const bubbleWorldAnchor = new THREE.Vector3();

  const labelEl = document.createElement("div");
  Object.assign(labelEl.style, {
    position: "absolute",
    pointerEvents: "none",
    padding: "6px 14px",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #cbd5e1",
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    color: "#1e293b",
    fontSize: "13px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    transform: "translate(-50%, -100%) translateY(-12px)",
    display: "none",
    zIndex: "10"
  });
  container.style.position = "relative";
  container.appendChild(labelEl);

  initScene();
  void buildPlantScene();
  animate();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  function initScene() {
    scene.fog = new THREE.FogExp2(SCENE_CONFIG.fogColor, SCENE_CONFIG.fogDensity);

    const hemiLight = new THREE.HemisphereLight(
      SCENE_CONFIG.hemiLight.skyColor,
      SCENE_CONFIG.hemiLight.groundColor,
      SCENE_CONFIG.hemiLight.intensity
    );
    scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(
      SCENE_CONFIG.directionalLight.color,
      SCENE_CONFIG.directionalLight.intensity
    );
    directionalLight.position.copy(SCENE_CONFIG.directionalLight.position);
    scene.add(directionalLight);

    const fillLight = new THREE.PointLight(
      SCENE_CONFIG.fillLight.color,
      SCENE_CONFIG.fillLight.intensity,
      400
    );
    fillLight.position.copy(SCENE_CONFIG.fillLight.position);
    scene.add(fillLight);

    gridMesh = createInfiniteGrid();
    gridMesh.position.y = -0.2;
    scene.add(gridMesh);

    scene.add(createRoadLines());
    particles = createParticles();
    scene.add(particles);
  }

  async function buildPlantScene() {
    // 性能：大模型卡顿时可在 Blender 用 Decimate 减面，或用 gltf-transform 压缩
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(modelUrl);
      // 模型原点在右下角：水平居中，底面贴地（地面 y = -0.1）
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const groundY = -0.1;
      gltf.scene.position.set(-center.x, groundY - box.min.y, -center.z);
      scene.add(gltf.scene);
      registerWorkshopMeshesFromGLB(gltf.scene);
      if (!workshopMeshes.length) createFallbackWorkshops();
      createWorkshopBubbles();
    } catch (error) {
      console.warn("GLB 加载失败，使用盒子场景回退。", error);
      createFallbackWorkshops();
    }
  }

  function registerWorkshopMeshesFromGLB(root: THREE.Object3D) {
    for (const topNode of root.children) {
      const childMeshes: SceneMesh[] = [];
      topNode.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mesh = obj as SceneMesh;
        mesh.material = normalizeMaterial(mesh.material);
        mesh.userData.kind = "workshop";
        childMeshes.push(mesh);
        cacheBaseMaterial(mesh);
      });
      if (!childMeshes.length) continue;

      const baseName = extractBaseMeshName(childMeshes[0].name);
      const label = MESH_LABEL_MAP[baseName] || topNode.name || baseName || "(未命名)";
      const groupId = topNode.uuid;

      const noInteraction = baseName === "back" || baseName === "ground";
      if (noInteraction) {
        for (const mesh of childMeshes) {
          mesh.userData.groupId = groupId;
        }
        continue;
      }

      const explicitWorkshopId = MESH_TO_WORKSHOP_MAP[baseName];
      const workshop = explicitWorkshopId
        ? workshopMap.get(explicitWorkshopId) ?? null
        : resolveNearestWorkshop(childMeshes[0]);
      const group: MeshGroup = {
        id: groupId,
        baseName,
        label,
        node: topNode,
        meshes: childMeshes,
        workshopId: workshop?.id
      };
      meshGroups.push(group);

      for (const mesh of childMeshes) {
        mesh.userData.groupId = groupId;
        if (workshop) mesh.userData.workshopId = workshop.id;
        workshopMeshes.push(mesh);
        selectableMeshes.push(mesh);
        meshGroupMap.set(mesh.uuid, group);
      }
    }
  }

  function extractBaseMeshName(name: string): string {
    return name.replace(/_\d+$/, "");
  }

  function createWorkshopBubbles() {
    for (const group of meshGroups) {
      const workshopId = MESH_TO_WORKSHOP_MAP[group.baseName];
      if (!workshopId) continue;
      const workshop = workshopMap.get(workshopId);
      if (!workshop) continue;

      const wsWarehouses = warehouses.filter((w) => w.workshopId === workshopId);
      const totalInventory = wsWarehouses.reduce((s, w) => s + w.currentInventory, 0);
      const totalCapacity = wsWarehouses.reduce((s, w) => s + w.capacity, 0);
      const avgOccupancy = wsWarehouses.length
        ? wsWarehouses.reduce((s, w) => s + w.occupancyRate, 0) / wsWarehouses.length
        : 0;
      const totalAmount = wsWarehouses.reduce((s, w) => s + w.currentAmount, 0);
      const avgTurnoverRate = wsWarehouses.length
        ? wsWarehouses.reduce((s, w) => s + w.turnoverRate, 0) / wsWarehouses.length
        : 0;
      const avgStagnantRatio = wsWarehouses.length
        ? wsWarehouses.reduce((s, w) => s + w.stagnantRatio, 0) / wsWarehouses.length
        : 0;
      const todayInbound = wsWarehouses.reduce((s, w) => s + w.baseInbound, 0);
      const todayOutbound = wsWarehouses.reduce((s, w) => s + w.baseOutbound, 0);

      const occupancyColor = avgOccupancy > 80 ? "#dc2626" : avgOccupancy > 60 ? "#d97706" : "#16a34a";
      const stagnantColor = avgStagnantRatio > 5 ? "#dc2626" : avgStagnantRatio > 3 ? "#d97706" : "#16a34a";

      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "absolute",
        pointerEvents: "none",
        padding: "10px 16px",
        borderRadius: "10px",
        background: "rgba(255,255,255,0.96)",
        border: "1px solid #cbd5e1",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        color: "#1e293b",
        fontSize: "11px",
        lineHeight: "1.7",
        whiteSpace: "nowrap",
        transform: "translate(-50%, -100%) translateY(-8px)",
        zIndex: "5",
        backdropFilter: "blur(6px)"
      });

      const nameSpan = `<div style="font-weight:700;font-size:13px;color:#2b6cb0;margin-bottom:4px;border-bottom:1px solid #e2e8f0;padding-bottom:4px">${workshop.name}</div>`;

      const row1 = [
        `<span style="color:#64748b">仓库</span> <b>${wsWarehouses.length}</b>个`,
        `<span style="color:#64748b">总容量</span> <b>${totalCapacity.toLocaleString()}</b>吨`,
        `<span style="color:#64748b">占用率</span> <b style="color:${occupancyColor}">${avgOccupancy.toFixed(1)}%</b>`
      ].join('<span style="color:#cbd5e1;margin:0 5px">|</span>');

      const row2 = [
        `<span style="color:#64748b">库存</span> <b>${totalInventory.toLocaleString()}</b>吨`,
        `<span style="color:#64748b">金额</span> <b>${(totalAmount / 10000).toFixed(0)}</b>万元`,
        `<span style="color:#64748b">周转率</span> <b>${avgTurnoverRate.toFixed(1)}</b>次/年`
      ].join('<span style="color:#cbd5e1;margin:0 5px">|</span>');

      const row3 = [
        `<span style="color:#64748b">今日入库</span> <b style="color:#2563eb">${todayInbound}</b>吨`,
        `<span style="color:#64748b">今日出库</span> <b style="color:#16a34a">${todayOutbound}</b>吨`,
        `<span style="color:#64748b">呆滞率</span> <b style="color:${stagnantColor}">${avgStagnantRatio.toFixed(1)}%</b>`
      ].join('<span style="color:#cbd5e1;margin:0 5px">|</span>');

      el.innerHTML = nameSpan
        + `<div>${row1}</div>`
        + `<div>${row2}</div>`
        + `<div>${row3}</div>`;
      container.appendChild(el);

      bubbles.push({ el, group });
    }
  }

  function updateBubbles() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;
    const hw = width / 2;
    const hh = height / 2;

    for (const bubble of bubbles) {
      const box = new THREE.Box3();
      for (const mesh of bubble.group.meshes) {
        box.expandByObject(mesh);
      }
      box.getCenter(bubbleWorldAnchor);
      bubbleWorldAnchor.y = box.max.y + 8;

      bubbleWorldAnchor.project(camera);
      if (bubbleWorldAnchor.z > 1) {
        bubble.el.style.display = "none";
        continue;
      }
      bubble.el.style.display = "block";
      bubble.el.style.left = (bubbleWorldAnchor.x * hw + hw) + "px";
      bubble.el.style.top = (-bubbleWorldAnchor.y * hh + hh) + "px";
    }
  }

  function createFallbackWorkshops() {
    workshops.forEach((workshop, index) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(24, 12 + (index % 3) * 2, 16),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.55 + index * 0.03, 0.45, 0.38),
          metalness: 0.08,
          roughness: 0.72
        })
      ) as unknown as SceneMesh;
      mesh.position.set(workshop.anchor.x, 6, workshop.anchor.z);
      mesh.userData.kind = "workshop";
      mesh.userData.workshopId = workshop.id;
      scene.add(mesh);
      workshopMeshes.push(mesh);
      selectableMeshes.push(mesh);
      cacheBaseMaterial(mesh);
    });
  }

  function resolveNearestWorkshop(mesh: THREE.Mesh): WorkshopInfo | null {
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    let nearest: WorkshopInfo | null = null;
    let minDistance = Number.POSITIVE_INFINITY;
    for (const workshop of workshops) {
      const distance = Math.hypot(worldPos.x - workshop.anchor.x, worldPos.z - workshop.anchor.z);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = workshop;
      }
    }
    return nearest;
  }

  function normalizeMaterial(material: THREE.Material | THREE.Material[]) {
    const source = Array.isArray(material) ? material[0] : material;
    if (!(source instanceof THREE.MeshStandardMaterial)) {
      return new THREE.MeshStandardMaterial({
        color: 0x3c6799,
        metalness: 0.1,
        roughness: 0.75
      });
    }
    const cloned = source.clone();
    cloned.transparent = true;
    cloned.opacity = 1;
    cloned.emissive = new THREE.Color(0x000000);
    cloned.emissiveIntensity = 0;
    return cloned;
  }

  function cacheBaseMaterial(mesh: SceneMesh) {
    const material = mesh.material as THREE.MeshStandardMaterial;
    baseMaterialState.set(mesh.uuid, {
      color: material.color.getHex(),
      emissive: material.emissive.getHex(),
      opacity: material.opacity
    });
  }

  function resetMaterial(mesh: SceneMesh) {
    const material = mesh.material as THREE.MeshStandardMaterial;
    const state = baseMaterialState.get(mesh.uuid);
    if (!state) return;
    material.color.setHex(state.color);
    material.emissive.setHex(state.emissive);
    material.emissiveIntensity = 0;
    material.opacity = state.opacity;
  }

  function animate() {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    if (!isPageVisible) return;
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    if (selectedGroup) {
      const intensity = 0.2 + Math.sin(elapsed * 1.8) * 0.1;
      for (const mesh of selectedGroup.meshes) {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
    if (gridMesh && gridMesh.material instanceof THREE.ShaderMaterial) {
      (gridMesh.material.uniforms.uCameraPosition as THREE.IUniform).value.copy(camera.position);
    }
    if (particles) {
      particles.rotation.y += delta * 0.02;
    }
    updateLabel();
    updateBubbles();
    controls.update();
    renderer.render(scene, camera);
  }

  function onClick(event: MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(selectableMeshes, false);

    if (!intersects.length) {
      clearSelection();
      return;
    }

    const hit = intersects[0].object as SceneMesh;
    const group = meshGroupMap.get(hit.uuid);

    if (group) {
      selectGroup(group);
      const workshopIdForPanel = MESH_TO_WORKSHOP_MAP[group.baseName] ?? "company_level1_warehouse";
      const workshop = workshopMap.get(workshopIdForPanel);
      if (workshop) onWorkshopSelect(workshop);
      return;
    }

    if (hit.userData.kind === "warehouse" && hit.userData.warehouseId) {
      selectSingleMesh(hit);
      const warehouse = warehouseMap.get(hit.userData.warehouseId);
      if (warehouse) onWarehouseSelect(warehouse);
    }
  }

  function clearSelection() {
    if (selectedGroup) {
      for (const mesh of selectedGroup.meshes) resetMaterial(mesh);
      selectedGroup = null;
    }
    labelEl.style.display = "none";
  }

  function selectGroup(group: MeshGroup) {
    clearSelection();
    selectedGroup = group;
    for (const mesh of group.meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive.set(SCENE_CONFIG.highlightColor);
      material.color.offsetHSL(0, 0, 0.08);
    }
    labelEl.textContent = group.label;
    labelEl.style.display = "block";
  }

  function selectSingleMesh(mesh: SceneMesh) {
    clearSelection();
    const singleGroup: MeshGroup = {
      id: mesh.uuid,
      baseName: extractBaseMeshName(mesh.name),
      label: mesh.name || "",
      node: mesh,
      meshes: [mesh]
    };
    selectedGroup = singleGroup;
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive.set(SCENE_CONFIG.highlightColor);
    material.color.offsetHSL(0, 0, 0.08);
    labelEl.style.display = "none";
  }

  function updateLabel() {
    if (!selectedGroup || labelEl.style.display === "none") return;
    const box = new THREE.Box3();
    for (const mesh of selectedGroup.meshes) {
      box.expandByObject(mesh);
    }
    const top = new THREE.Vector3();
    box.getCenter(top);
    top.y = box.max.y;
    top.project(camera);
    const hw = container.clientWidth / 2;
    const hh = container.clientHeight / 2;
    const sx = top.x * hw + hw;
    const sy = -(top.y * hh) + hh;
    labelEl.style.left = sx + "px";
    labelEl.style.top = sy + "px";
  }

  function focusWorkshop(workshopId: string) {
    const meshKey = Object.entries(MESH_TO_WORKSHOP_MAP).find(([, wid]) => wid === workshopId)?.[0];
    const group = meshKey
      ? meshGroups.find((g) => g.baseName === meshKey)
      : meshGroups.find((g) => g.workshopId === workshopId);
    const workshop = workshopMap.get(workshopId);
    if (!group || !workshop) return;

    const box = new THREE.Box3();
    for (const mesh of group.meshes) box.expandByObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    controls.target.set(center.x, 0, center.z);

    selectGroup(group);
    onWorkshopSelect(workshop);
  }

  function focusWarehouse(warehouseId: string) {
    const target = warehouseMeshes.find((mesh) => mesh.userData.warehouseId === warehouseId);
    const warehouse = warehouseMap.get(warehouseId);
    if (!target || !warehouse) return;
    controls.target.set(warehouse.worldPosition.x, 0, warehouse.worldPosition.z);
    selectSingleMesh(target);
    onWarehouseSelect(warehouse);
  }

  function applyTurnoverFilter(filter: TurnoverClass | null) {
    activeFilter = filter;
    warehouseMeshes.forEach((mesh) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      resetMaterial(mesh);
      const matched = !filter || mesh.userData.turnoverClass === filter;
      material.opacity = matched ? 1 : 0.2;
      material.emissiveIntensity = matched ? 0.15 : 0;
      if (filter && matched) {
        material.emissive.setHex(0x2b6cb0);
      }
    });
  }

  function resize() {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function onVisibilityChange() {
    isPageVisible = document.visibilityState === "visible";
    if (isPageVisible && !disposed) animate();
  }

  function destroy() {
    disposed = true;
    cancelAnimationFrame(animationId);
    renderer.domElement.removeEventListener("click", onClick);
    window.removeEventListener("resize", resize);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    controls.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const material = obj.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      }
    });
    container.removeChild(renderer.domElement);
    if (labelEl.parentElement) labelEl.parentElement.removeChild(labelEl);
    for (const bubble of bubbles) {
      if (bubble.el.parentElement) bubble.el.parentElement.removeChild(bubble.el);
    }
  }

  renderer.domElement.addEventListener("click", onClick);
  window.addEventListener("resize", resize);

  return {
    destroy,
    resize,
    focusWorkshop,
    focusWarehouse,
    applyTurnoverFilter
  };
}

function createRoadLines() {
  const roads = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: SCENE_CONFIG.roadColor,
    transparent: true,
    opacity: 0.5
  });
  const routes = [
    [
      [-140, 0.2, -70],
      [140, 0.2, -70],
      [140, 0.2, -10],
      [-140, 0.2, -10]
    ],
    [
      [-140, 0.2, 12],
      [140, 0.2, 12]
    ],
    [
      [-85, 0.2, -100],
      [-85, 0.2, 90]
    ],
    [
      [12, 0.2, -100],
      [12, 0.2, 90]
    ],
    [
      [95, 0.2, -100],
      [95, 0.2, 90]
    ]
  ];

  for (const route of routes) {
    const points = route.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    roads.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }
  return roads;
}

function createParticles(): THREE.Points {
  const { count, spread, height, color, size, opacity } = SCENE_CONFIG.particles;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = Math.random() * height + 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * (spread * 0.7);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return new THREE.Points(geometry, material);
}

function createInfiniteGrid(): THREE.Mesh {
  const { spacing, colorGrid, colorCenter, fadeNear, fadeFar } = SCENE_CONFIG.grid;
  const extent = 5000;
  const geometry = new THREE.PlaneGeometry(extent * 2, extent * 2, 1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSpacing: { value: spacing },
      uColorGrid: { value: new THREE.Color(colorGrid) },
      uColorCenter: { value: new THREE.Color(colorCenter) },
      uFadeNear: { value: fadeNear },
      uFadeFar: { value: fadeFar },
      uCameraPosition: { value: new THREE.Vector3(0, 0, 0) }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorldPosition = w.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uSpacing;
      uniform vec3 uColorGrid;
      uniform vec3 uColorCenter;
      uniform float uFadeNear;
      uniform float uFadeFar;
      uniform vec3 uCameraPosition;
      varying vec3 vWorldPosition;
      void main() {
        vec2 coord = vWorldPosition.xz / uSpacing;
        vec2 g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float dist = length(vWorldPosition.xz - uCameraPosition.xz);
        float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
        float cx = min(fract(coord.x), 1.0 - fract(coord.x)) / max(fwidth(coord.x), 0.0001);
        float cy = min(fract(coord.y), 1.0 - fract(coord.y)) / max(fwidth(coord.y), 0.0001);
        float onCenter = 1.0 - min(min(cx, cy), 1.0);
        vec3 lineColor = mix(uColorGrid, uColorCenter, onCenter * line);
        gl_FragColor = vec4(lineColor, line * fade * 0.7);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
