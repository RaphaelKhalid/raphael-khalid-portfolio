// WebGL setup for the page's own canvases that never blocks a frame: wait for
// an idle moment, then let the driver link the program in the background
// (KHR_parallel_shader_compile) instead of stalling on LINK_STATUS. On Windows
// that stall holds up the GPU process, so raly and scrolling hitch with it.

export function whenIdle(callback, timeout = 2000) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(callback, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 200);
  return () => clearTimeout(id);
}

export function linkProgram(gl, vertex, fragment) {
  const program = gl.createProgram();
  const shaders = [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].map(([type, source]) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    return shader;
  });
  gl.linkProgram(program);
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  return new Promise((resolve, reject) => {
    const check = () => {
      if (gl.isContextLost()) { reject(new Error("context lost")); return; }
      if (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) { setTimeout(check, 16); return; }
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) { resolve(program); return; }
      reject(new Error(gl.getProgramInfoLog(program) || shaders.map(s => gl.getShaderInfoLog(s)).join("\n")));
    };
    check();
  });
}
