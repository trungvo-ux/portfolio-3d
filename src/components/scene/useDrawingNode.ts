import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SceneRuntime } from "./mountSceneRuntime";

type MaterialSnapshot = {
  emissive: THREE.Color;
  emissiveIntensity: number;
};

const PAPER_MESH_CANDIDATES = ["Drawing", "Object_31.1608"];
const DRAWING_ANCHOR_CANDIDATES = ["DrawingAnchor", "DrawnAnchor"];

const findNamedObject = (root: THREE.Scene, names: string[]) => {
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (node) return node;
  }

  let fallback: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (fallback || !obj.name) return;
    const canonical = obj.name.toLowerCase();
    if (names.some((name) => canonical === name.toLowerCase())) {
      fallback = obj;
    }
  });
  return fallback;
};

export function useDrawingNode(runtime: SceneRuntime | null, enabled: boolean) {
  const [isHoveringDrawingNode, setIsHoveringDrawingNode] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [drawingCanvasSize, setDrawingCanvasSize] = useState<{ width: number; height: number }>({
    width: 595,
    height: 844,
  });

  const paperMeshRef = useRef<THREE.Mesh | null>(null);
  const drawingAnchorRef = useRef<THREE.Mesh | null>(null);
  const hasLoggedAnchorRef = useRef(false);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2(999, 999));
  const materialSnapshotsRef = useRef<MaterialSnapshot[]>([]);
  const anchorMapSizeRef = useRef<{ width: number; height: number } | null>(null);
  const anchorBaseMapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const cacheAnchorBaseMap = useCallback((map: THREE.Texture | null) => {
    if (!map?.image) return;
    const image = map.image as CanvasImageSource & { width?: number; height?: number };
    if (!image.width || !image.height || image.width <= 0 || image.height <= 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      anchorBaseMapCanvasRef.current = canvas;
    } catch {
      anchorBaseMapCanvasRef.current = null;
    }
  }, []);

  const resolveCanvasSizeFromAnchor = useCallback((anchor: THREE.Mesh) => {
    const fallback = { width: 595, height: 844 };
    const sourceMaterial = Array.isArray(anchor.material) ? anchor.material[0] : anchor.material;
    if (sourceMaterial && "map" in sourceMaterial) {
      const map = (sourceMaterial as THREE.MeshStandardMaterial).map;
      const image = map?.image as { width?: number; height?: number } | undefined;
      if (image?.width && image?.height) {
        const width = image.width;
        const height = image.height;
        if (width > 0 && height > 0) {
          anchorMapSizeRef.current = { width, height };
          cacheAnchorBaseMap(map ?? null);
          return { width, height };
        }
      }
    }

    const geometry = anchor.geometry;
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    if (!bbox) return fallback;

    const size = bbox.getSize(new THREE.Vector3());
    const worldScale = new THREE.Vector3();
    anchor.getWorldScale(worldScale);
    const dimensions = [
      Math.abs(size.x * worldScale.x),
      Math.abs(size.y * worldScale.y),
      Math.abs(size.z * worldScale.z),
    ]
      .filter((value) => value > 1e-6)
      .sort((a, b) => b - a);

    if (dimensions.length < 2) return fallback;
    const widthLike = dimensions[1];
    const heightLike = dimensions[0];
    const ratio = widthLike / heightLike;
    if (ratio <= 0) return fallback;
    const height = 1024;
    const width = Math.max(1, Math.round(height * ratio));
    return { width, height };
  }, [cacheAnchorBaseMap]);

  const syncMeshRefs = useCallback(() => {
    if (!runtime) return;

    if (!paperMeshRef.current) {
      const node = findNamedObject(runtime.scene, PAPER_MESH_CANDIDATES);
      if (node instanceof THREE.Mesh) {
        paperMeshRef.current = node;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materialSnapshotsRef.current = materials
          .filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial)
          .map((material) => ({
            emissive: material.emissive.clone(),
            emissiveIntensity: material.emissiveIntensity,
          }));
      }
    }

    if (!drawingAnchorRef.current) {
      const node = findNamedObject(runtime.scene, DRAWING_ANCHOR_CANDIDATES);
      if (node instanceof THREE.Mesh) {
        drawingAnchorRef.current = node;
        setDrawingCanvasSize(resolveCanvasSizeFromAnchor(node));
        if (!hasLoggedAnchorRef.current) {
          hasLoggedAnchorRef.current = true;
          console.log("DrawingAnchor found:", node);
        }
      }
    }
  }, [resolveCanvasSizeFromAnchor, runtime]);

  useEffect(() => {
    if (!enabled) {
      setIsModalOpen(false);
      setIsHoveringDrawingNode(false);
      setTooltipPosition(null);
      return;
    }
    syncMeshRefs();
  }, [enabled, syncMeshRefs]);

  useEffect(() => {
    if (!enabled || !runtime) return;

    const onPointerMove = (event: PointerEvent) => {
      syncMeshRefs();
      const paperMesh = paperMeshRef.current;
      if (!paperMesh || isModalOpen) {
        setIsHoveringDrawingNode(false);
        setTooltipPosition(null);
        return;
      }

      const rect = runtime.renderer.domElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      pointerRef.current.x = x * 2 - 1;
      pointerRef.current.y = -(y * 2 - 1);

      raycasterRef.current.setFromCamera(pointerRef.current, runtime.camera);
      const intersects = raycasterRef.current.intersectObject(paperMesh, true);
      const isHovering = intersects.length > 0;
      setIsHoveringDrawingNode(isHovering);
      setTooltipPosition(isHovering ? { x: event.clientX + 14, y: event.clientY + 12 } : null);
    };

    const onPointerDown = () => {
      if (isModalOpen || !isHoveringDrawingNode) return;
      setIsModalOpen(true);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [enabled, isHoveringDrawingNode, isModalOpen, runtime, syncMeshRefs]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const paperMesh = paperMeshRef.current;
      if (!paperMesh) return;

      const materials = Array.isArray(paperMesh.material) ? paperMesh.material : [paperMesh.material];
      if (isHoveringDrawingNode && !isModalOpen) {
        const pulse = 0.12 + Math.sin(performance.now() * 0.008) * 0.05;
        for (const material of materials) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          material.emissive.set(0xf4e4b8);
          material.emissiveIntensity = pulse;
        }
      } else {
        materials
          .filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial)
          .forEach((material, index) => {
            const snapshot = materialSnapshotsRef.current[index];
            if (!snapshot) return;
            material.emissive.copy(snapshot.emissive);
            material.emissiveIntensity = snapshot.emissiveIntensity;
          });
      }
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, [enabled, isHoveringDrawingNode, isModalOpen]);

  const onSaveDrawing = useCallback(
    ({ textureCanvas }: { dataUrl: string; textureCanvas: HTMLCanvasElement }) => {
      if (!runtime) return;
      syncMeshRefs();

      const anchor = drawingAnchorRef.current;
      if (!anchor) {
        console.error("DrawingAnchor not found");
        return;
      }

      const composedCanvas = document.createElement("canvas");
      composedCanvas.width = textureCanvas.width;
      composedCanvas.height = textureCanvas.height;
      const composedCtx = composedCanvas.getContext("2d", { alpha: false });
      if (!composedCtx) return;
      composedCtx.fillStyle = "#ffffff";
      composedCtx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
      if (anchorBaseMapCanvasRef.current) {
        composedCtx.drawImage(anchorBaseMapCanvasRef.current, 0, 0, composedCanvas.width, composedCanvas.height);
      }
      composedCtx.drawImage(
        textureCanvas,
        0,
        0,
        textureCanvas.width,
        textureCanvas.height,
        0,
        0,
        composedCanvas.width,
        composedCanvas.height
      );

      const texture = new THREE.CanvasTexture(composedCanvas);
      const sourceMaterial = Array.isArray(anchor.material) ? anchor.material[0] : anchor.material;
      const sourceMap =
        sourceMaterial && "map" in sourceMaterial
          ? ((sourceMaterial as THREE.MeshStandardMaterial).map as THREE.Texture | null)
          : null;

      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.rotation = 0;
      texture.center.set(0, 0);
      texture.offset.set(0, 0);
      texture.repeat.set(1, 1);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = runtime.renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;

      if (sourceMap) {
        console.log("Previous map transform:", {
          rotation: sourceMap.rotation,
          offset: { x: sourceMap.offset.x, y: sourceMap.offset.y },
          repeat: { x: sourceMap.repeat.x, y: sourceMap.repeat.y },
          flipY: sourceMap.flipY,
        });
      }

      const applyTextureToMaterial = (material: THREE.Material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.map = texture;
          material.color.set(0xffffff);
          material.transparent = false;
          material.needsUpdate = true;
          return material;
        }

        if (material instanceof THREE.MeshPhysicalMaterial) {
          material.map = texture;
          material.color.set(0xffffff);
          material.transparent = false;
          material.needsUpdate = true;
          return material;
        }

        if (material instanceof THREE.MeshPhongMaterial || material instanceof THREE.MeshLambertMaterial) {
          material.map = texture;
          material.color.set(0xffffff);
          material.transparent = false;
          material.needsUpdate = true;
          return material;
        }

        const replacement = new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          roughness: 0.95,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        replacement.needsUpdate = true;
        return replacement;
      };

      if (Array.isArray(anchor.material)) {
        anchor.material = anchor.material.map((material, index) =>
          index === 0 ? applyTextureToMaterial(material) : material
        );
      } else {
        anchor.material = applyTextureToMaterial(anchor.material);
      }

      anchor.castShadow = true;
      anchor.receiveShadow = true;

      runtime.renderer.render(runtime.scene, runtime.camera);
      console.log("Drawing applied to DrawingAnchor mesh");
      setIsModalOpen(false);
    },
    [runtime, syncMeshRefs]
  );

  const onCancelDrawing = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  useEffect(() => {
    document.body.style.cursor = isHoveringDrawingNode && !isModalOpen ? "pointer" : "default";
    return () => {
      document.body.style.cursor = "default";
    };
  }, [isHoveringDrawingNode, isModalOpen]);

  const isInteractionLocked = useMemo(() => isModalOpen, [isModalOpen]);

  return {
    isDrawingMode: isModalOpen,
    isDrawingOverlayVisible: isModalOpen,
    isInteractionLocked,
    onSaveDrawing,
    onCancelDrawing,
    drawingCanvasSize,
    showTooltip: isHoveringDrawingNode && !isModalOpen,
    tooltipPosition,
  };
}
