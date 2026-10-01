import { useEffect, useRef } from "react";
import { linkProgram, whenIdle } from "../utils/webgl";

// The sunlit floor at the bottom of the page: slow caustic light on paper, as
// if the page were the floor of a shallow pool. raly treats the top of this
// band as the ground when it is on screen (see RalyLayer).

const vertex = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime;
in vec2 vUv; out vec4 outColor;
vec2 hash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float layer(vec2 p, float t) {
  vec2 c = floor(p), f = fract(p); float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.5 + 0.42 * sin(t + 6.2831 * hash2(c + g));
    float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  float seam = f2 - f1;
  return pow(1.0 - smoothstep(0.0, 0.16, seam), 3.0) + 0.2 * pow(1.0 - smoothstep(0.0, 0.5, seam), 2.0);
}
void main() {
  // Foreshorten toward the top so the band reads as a floor receding.
  vec2 p = vec2((vUv.x - 0.5) * uRes.x / uRes.y * 2.2, 1.0 / (0.25 + 1.0 - vUv.y) * 0.8);
  p *= vec2(2.2, 2.6);
  p += 0.3 * vec2(sin(p.y * 1.3 + uTime * 0.6), cos(p.x * 1.1 - uTime * 0.5));
  float t = uTime * 0.8;
  float a = layer(p, t), b = layer(p * 1.8 + 3.7, t * 1.3);
  float light = (a * 0.5 + b * 0.35 + a * b * 2.0);
  float fade = smoothstep(0.0, 0.45, 1.0 - vUv.y) * smoothstep(0.0, 0.35, vUv.y + 0.1);
  vec3 sun = vec3(1.0, 0.97, 0.9);
  // Light only: laid over the paper, never darker than it.
  float cover = clamp(light * fade * 0.55, 0.0, 0.85);
  outColor = vec4(sun * cover, cover);
}`;

const SunlitFloor = ({ className = "" }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    // It sits at the bottom of the page: build it in an idle moment and never
    // wait on the shader link.
    let stop = null, cancelled = false;
    const cancelIdle = whenIdle(() => {
      const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
      if (!gl) return;
      linkProgram(gl, vertex, fragment).then(program => {
        if (!cancelled) stop = run(gl, program);
      }, error => { if (!cancelled) console.warn(error); });
    });
    return () => { cancelled = true; cancelIdle(); stop?.(); };

    function run(gl, program) {
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uRes = gl.getUniformLocation(program, "uRes"), uTime = gl.getUniformLocation(program, "uTime");
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      let frame = 0, visible = false, start = performance.now();
      const resize = () => {
        const scale = Math.min(devicePixelRatio || 1, 1.25);
        canvas.width = Math.round(canvas.clientWidth * scale);
        canvas.height = Math.round(canvas.clientHeight * scale);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      const draw = now => {
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const tick = now => { frame = requestAnimationFrame(tick); if (visible && !document.hidden) draw(now); };
      const ro = new ResizeObserver(() => { resize(); draw(performance.now()); });
      ro.observe(canvas);
      const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
      io.observe(canvas);
      resize();
      if (reduced) draw(start + 4000); else frame = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(frame); ro.disconnect(); io.disconnect(); gl.deleteProgram(program); gl.deleteBuffer(buffer); };
    }
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default SunlitFloor;
