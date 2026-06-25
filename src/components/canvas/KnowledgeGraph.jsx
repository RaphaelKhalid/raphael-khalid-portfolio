import { useRef, useState, Suspense, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";

const NODES = [
  { id: "ml",  label: "Machine Learning",   color: "#8BFAFF", pos: [0, 0, 0],          r: 0.20 },
  { id: "cx",  label: "Complexity Science", color: "#34d399", pos: [-1.9, 1.1, 0.4],   r: 0.16 },
  { id: "ps",  label: "Political Science",  color: "#a78bfa", pos: [2.0, 0.9, -0.4],   r: 0.15 },
  { id: "rb",  label: "Robotics",           color: "#f472b6", pos: [1.1, -1.7, 1.1],   r: 0.13 },
  { id: "nw",  label: "Network Theory",     color: "#fbbf24", pos: [-1.4, -1.3, -0.9], r: 0.13 },
  { id: "au",  label: "Audio AI",           color: "#60a5fa", pos: [0.2, 2.1, 0.7],    r: 0.12 },
  { id: "sw",  label: "Software Dev",       color: "#fb923c", pos: [-0.4, -0.6, 2.3],  r: 0.14 },
];

const EDGES = [
  ["ml","cx"],["ml","rb"],["ml","au"],["ml","nw"],["ml","sw"],["ml","ps"],
  ["ps","cx"],["ps","nw"],
  ["cx","nw"],["cx","sw"],
  ["rb","sw"],["au","sw"],
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n.pos]));
const edgePairs = EDGES.map(([a, b]) => [byId[a], byId[b]]);

const NodeMesh = ({ node, onHover }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const color = new THREE.Color(node.color);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(
        1 + Math.sin(clock.elapsedTime * 1.3 + node.pos[0] * 2) * 0.055
      );
    }
  });

  return (
    <group position={node.pos}>
      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[node.r * 2.0, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.10 : 0.05} side={THREE.BackSide} />
      </mesh>
      {/* Core */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(node.label, node.color); }}
        onPointerOut={() => { setHovered(false); onHover(null, null); }}
      >
        <sphereGeometry args={[node.r, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1.8 : 0.9}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
};

const GraphScene = ({ onHover }) => {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.07;
    }
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.0} color="#8BFAFF" />
      <pointLight position={[-5, -3, -3]} intensity={0.5} color="#a78bfa" />
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.45} />
      <group ref={groupRef}>
        {edgePairs.map(([a, b], i) => (
          <Line key={i} points={[a, b]} color="#8BFAFF" lineWidth={0.5} transparent opacity={0.15} />
        ))}
        {NODES.map((node) => (
          <NodeMesh key={node.id} node={node} onHover={onHover} />
        ))}
      </group>
    </>
  );
};

const KnowledgeGraph = () => {
  const [tooltip, setTooltip] = useState({ label: null, color: null });

  const handleHover = useCallback((label, color) => {
    setTooltip({ label, color });
  }, []);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <GraphScene onHover={handleHover} />
        </Suspense>
      </Canvas>

      {/* Hover label rendered as a plain DOM element — no per-frame WebGL sync */}
      {tooltip.label && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full pointer-events-none"
          style={{
            background: "rgba(0,0,0,0.55)",
            border: `1px solid ${tooltip.color}55`,
            color: tooltip.color,
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textShadow: `0 0 12px ${tooltip.color}88`,
            backdropFilter: "blur(8px)",
            transition: "opacity 0.15s",
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph;
