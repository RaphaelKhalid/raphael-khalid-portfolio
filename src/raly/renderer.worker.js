import { createRaly } from './engine.js';
import { createAudio } from './audio.js';

let engine, resize, visibility, hidden = false, viewport;
const audio = createAudio();
// Microphone permission and analysis stay on the page; only band levels cross.
const runtime = {
  viewport: null, search: '', audio: { state: audio.state, update: () => audio.state, disable() {} },
  hidden: () => hidden,
  status: name => postMessage({ type: 'status', name }),
  screen: (screen, contours, hits) => postMessage({ type: 'screen', screen, contours, hits }),
  subscribe(onResize, onVisibility) {
    resize = onResize; visibility = onVisibility;
    return () => { resize = visibility = null; };
  },
};
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      viewport = data.viewport; runtime.viewport = viewport; runtime.search = data.search;
      hidden = data.hidden;
      engine = createRaly(data.canvas, { ...data.options, runtime, onReady: () => postMessage({ type: 'ready' }) });
      engine.start();
    } else if (data.type === 'viewport') {
      Object.assign(viewport, data.viewport); resize?.();
    } else if (data.type === 'visibility') {
      hidden = data.hidden; visibility?.();

    } else if (data.type === 'calls') {
      Object.assign(audio.state, data.audio);
      for (const [method, args] of data.calls) engine?.[method]?.(...args);
      postMessage({ type: 'ack' });
    }
  } catch (error) { postMessage({ type: 'error', message: error.message }); }
};
