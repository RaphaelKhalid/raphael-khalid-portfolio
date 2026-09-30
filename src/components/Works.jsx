import { useEffect, useRef, useState } from "react";
import { projects } from "../constants/index";
import BlenderPlate from "./BlenderPlate";
import "./works-plates.css";

const NAV_HEIGHT = 68;
const cardsPerRow = () => window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;
const plateNumber = (number) => String(number).padStart(2, "0");

function Plate({ project, index, activeId, onPlaybackChange }) {
  return (
    <article className="plate works-plate" data-plate-index={index + 1}>
      <div className="plate-art works-plate__art">
        <BlenderPlate
          id={project.pixelArtwork}
          title={project.name}
          active={activeId === project.pixelArtwork}
          onPlaybackChange={onPlaybackChange}
        />
        <span className="works-plate__number" aria-hidden="true">plate {plateNumber(index + 1)}</span>
        {index === 0 && <span className="works-plate__flagship">flagship</span>}
      </div>
      <a
        href={project.source_code_link}
        target="_blank"
        rel="noopener noreferrer"
        className="works-plate__study"
        aria-label={`Explore ${project.name} (opens in a new tab)`}
      >
        <h3 className="headline-soft" title={project.name}>{project.name}</h3>
        <p className="works-plate__description">{project.description}</p>
        <div className="works-plate__footer">
          <div className="works-plate__tags">
            {project.tags.map((tag) => <span key={tag.name} className={tag.color}>{tag.name}</span>)}
          </div>
          <span className="works-plate__arrow" aria-hidden="true">↗</span>
        </div>
      </a>
    </article>
  );
}

export default function Works() {
  const section = useRef(null);
  const stage = useRef(null);
  const [columns, setColumns] = useState(cardsPerRow);
  const [stageHeight, setStageHeight] = useState(() => Math.max(1, window.innerHeight - NAV_HEIGHT));
  const [row, setRow] = useState(0);
  const [activeId, setActiveId] = useState(projects[0].pixelArtwork);
  const rowCount = Math.ceil(projects.length / columns);
  const currentRow = Math.min(row, rowCount - 1);
  const first = currentRow * columns;
  const visibleProjects = projects.slice(first, first + columns);

  useEffect(() => {
    const resize = () => setColumns(cardsPerRow());
    const observer = new ResizeObserver(([entry]) => {
      setStageHeight(Math.max(1, entry.borderBoxSize?.[0]?.blockSize ?? stage.current.getBoundingClientRect().height));
    });
    observer.observe(stage.current);
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const distance = NAV_HEIGHT - section.current.getBoundingClientRect().top;
      const next = Math.max(0, Math.min(rowCount - 1, Math.floor(distance / stageHeight)));
      setRow((previous) => previous === next ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [rowCount, stageHeight]);

  useEffect(() => {
    setActiveId(projects[first].pixelArtwork);
  }, [first]);

  const goToRow = (nextRow) => {
    const top = section.current.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT + nextRow * stageHeight + 1;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
  };

  return (
    <section
      id="work"
      ref={section}
      className="works-scroll"
      aria-labelledby="works-title"
      style={{ height: `${(rowCount + 1) * stageHeight}px` }}
    >
      <div ref={stage} className="works-stage">
        <header className="works-stage__header">
          <div>
            <p className="works-stage__eyebrow">Selected work · {projects.length} specimens</p>
            <h2 id="works-title" className="headline-soft">Projects</h2>
          </div>
          <p className="works-stage__range" aria-live="polite" aria-atomic="true">
            <span>plates</span> {plateNumber(first + 1)}{visibleProjects.length > 1 ? `–${plateNumber(first + visibleProjects.length)}` : ""}
            <span> of {projects.length}</span>
          </p>
        </header>

        <div className="works-stage__row" data-row-index={currentRow} key={`${columns}-${currentRow}`} style={{ "--plate-columns": columns }}>
          {visibleProjects.map((project, index) => (
            <Plate
              key={project.pixelArtwork}
              project={project}
              index={first + index}
              activeId={activeId}
              onPlaybackChange={setActiveId}
            />
          ))}
        </div>

        <nav className="works-stage__navigation" aria-label="Project rows">
          <button type="button" disabled={currentRow === 0} onClick={() => goToRow(currentRow - 1)} aria-label="Previous project row">
            <span aria-hidden="true">←</span> Previous
          </button>
          <span className="works-stage__position">{currentRow + 1} / {rowCount}</span>
          <button type="button" disabled={currentRow === rowCount - 1} onClick={() => goToRow(currentRow + 1)} aria-label="Next project row">
            Next <span aria-hidden="true">→</span>
          </button>
        </nav>
        <p className="works-stage__hint">Scroll to turn the page. Select play to bring another specimen to life.</p>
      </div>
    </section>
  );
}
