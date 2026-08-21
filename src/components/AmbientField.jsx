// The ambient layer is deliberately quiet: on this site, motion should mean
// "something is computing" rather than "something is decorated". The loud
// things are the demos.
const AmbientField = () => (
  <>
    <div className="ambient" aria-hidden="true" />
    <div className="grain" aria-hidden="true" />
  </>
);

export default AmbientField;
