import { useEffect, useRef, useState } from "react";
import "./blender-plate.css";

// Vite fingerprints the media URLs so a new release invalidates old cached clips.
const media = import.meta.glob("../assets/plates/*", { eager: true, as: "url" });

// Keep the detailed Blender rendering while decoding only visible plates.
export default function BlenderPlate({ id, title, active = false, onPlaybackChange }) {
  const container = useRef(null);
  const video = useRef(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [saveData, setSaveData] = useState(() => Boolean(navigator.connection?.saveData));
  const [choice, setChoice] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const poster = media[`../assets/plates/${id}-poster.webp`];
  const clip = media[`../assets/plates/${id}.mp4`];

  useEffect(() => {
    const node = container.current;
    const preloadObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true);
        preloadObserver.disconnect();
      }
    }, { rootMargin: "200px" });
    const playbackObserver = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    preloadObserver.observe(node);
    playbackObserver.observe(node);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setReducedMotion(preference.matches);
    const onVisibility = () => setPageVisible(!document.hidden);
    const onConnection = () => setSaveData(Boolean(navigator.connection?.saveData));
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.connection?.addEventListener("change", onConnection);
    return () => {
      preloadObserver.disconnect();
      playbackObserver.disconnect();
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.connection?.removeEventListener("change", onConnection);
    };
  }, []);

  const loadVideo = near && active && (choice ?? (!reducedMotion && !saveData));
  useEffect(() => {
    const node = video.current;
    const shouldPlay = loadVideo && visible && pageVisible;
    if (shouldPlay) node.play().catch(() => {});
    else node.pause();
    return () => node.pause();
  }, [loadVideo, visible, pageVisible]);

  return (
    <div ref={container} className="blender-plate">
      <video
        ref={video}
        className="blender-plate__video"
        src={loadVideo ? clip : undefined}
        poster={near ? poster : undefined}
        aria-label={`${title} — animated specimen`}
        muted loop playsInline preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setUnavailable(true)}
      />
      <button
        type="button"
        className="blender-plate__control"
        aria-label={`${playing ? "Pause" : "Play"} animation for ${title}`}
        aria-pressed={playing}
        disabled={unavailable}
        onClick={() => {
          setNear(true);
          setChoice(!playing);
          onPlaybackChange(playing ? null : id);
        }}
      >
        {unavailable ? "Still" : playing ? "Pause" : "Play"}
      </button>
    </div>
  );
}
