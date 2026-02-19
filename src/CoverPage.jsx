function CoverPage() {
  return (
    <div className="cover-container">
      {/* Spline Background */}
      <div className="spline-bg">
        <spline-viewer
          url="https://prod.spline.design/SMOEtnIQMbZh1EUN/scene.splinecode"
        ></spline-viewer>
      </div>

      {/* Center Title */}
      <div className="center-overlay">
        <h1 className="project-title">LaunderLens</h1>
      </div>
    </div>
  );
}

export default CoverPage;
