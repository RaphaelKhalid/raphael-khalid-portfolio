import { useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import * as THREE from "three";

const NODES = [
  { id: "ml",  label: "Machine Learning",   color: "#8BFAFF", pos: [0, 0, 0],        r: 0.20 },
  { id: "cx",  label: "Complexity Science", color: "#34d399", pos: [-1.9, 1.1, 0.4], r: 0.16 },
  { id: "ps",  label: "Political Science",  color: "#a78bfa", pos: [2.0, 0.9, -0.4], r: 0.15 },
  { id: "rb",  label: "Robotics",           color: "#f472b6", pos: [1.1, -1.7, 1.1], r: 0.13 },
  { id: "nw",  label: "Network Theory",     color: "#fbbf24", pos: [-1.4, -1.3, -0.9], r: 0.13 },
  { id: "au",  label: "Audio AI",           color: "#60a5fa", pos: [0.2, 2.1, 0.7],  r: 0.12 },
  { id: "sw",  label: "Software Dev",       color: "#fb923c", pos: [-0.4, -0.6, 2.3], r: 0.14 },
];

const EDGES = [
  ["ml", "cx"], ["ml", "rb"], ["ml", "au"], ["ml", "nw"], ["ml", "sw"], ["ml", "ps"],
  ["ps", "cx"], ["ps", "nw"],
  ["cx", "nw"], ["cx", "sw"],
  ["rb", "sw"], ["au", "sw"],
];

function buildEdgePoints() {
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n.pos]));
  return EDGES.map(([a, b]) => [byId[a], byId[b]]);
}

const edgePoints = buildEdgePoints();

const NodeMesh = ({ node, onHover }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (meshRef.current) {
      meshRef.current.scale.setScalar(
        1 + Math.sin(t * 1.4 + node.pos[0] * 2) * 0.06
      );
    }
  });

  const color = new THREE.Color(node.color);

  return (
    <group position={node.pos}>
      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[node.r * 2.2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.12 : 0.06}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Core sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(node.label); }}
        onPointerOut={() => { setHovered(false); onHover(null); }}
      >
        <sphereGeometry args={[node.r, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1.6 : 0.8}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>

      {/* Always-visible label */}
      <Html
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
        position={[0, node.r + 0.28, 0]}
      >
        <span
          style={{
            color: node.color,
            fontSize: "11px",
            fontFamily: "'Space Grotesk', 'Poppins', sans-serif",
            fontWeight: 600,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            opacity: hovered ? 1 : 0.65,
            textShadow: `0 0 12px ${node.color}88`,
            transition: "opacity 0.2s",
          }}
        >
          {node.label}
        </span>
      </Html>
    </group>
  );
};

const GraphScene = () => {
  const groupRef = useRef();
  const [hoveredLabel, setHoveredLabel] = useState(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#8BFAFF" />
      <pointLight position={[-5, -3, -3]} intensity={0.6} color="#a78bfa" />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        rotateSpeed={0.5}
        autoRotate={false}
      />

      <group ref={groupRef}>
        {/* Edges */}
        {edgePoints.map(([a, b], i) => (
          <Line
            key={i}
            points={[a, b]}
            color="#8BFAFF"
            lineWidth={0.6}
            transparent
            opacity={0.18}
          />
        ))}

        {/* Nodes */}
        {NODES.map((node) => (
          <NodeMesh key={node.id} node={node} onHover={setHoveredLabel} />
        ))}
      </group>
    </>
  );
};

const KnowledgeGraph = () => (
  <Canvas
    camera={{ position: [0, 0, 6], fov: 50 }}
    style={{ background: "transparent" }}
    gl={{ alpha: true, antialias: true }}
  >
    <Suspense fallback={null}>
      <GraphScene />
    </Suspense>
  </Canvas>
);

export default KnowledgeGraph;
