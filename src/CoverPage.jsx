import { useEffect } from "react";
import "./CoverPage.css";

function CoverPage() {

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://cdn.jsdelivr.net/npm/@splinetool/viewer@1.12.58/build/spline-viewer.js";
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="cover-container">
      <div className="spline-bg">
        <spline-viewer url="https://prod.spline.design/SMOEtnIQMbZh1EUN/scene.splinecode"></spline-viewer>
      </div>

      <div className="center-overlay">
        <h1 className="project-title">LaunderLens</h1>
      </div>
    </div>
  );
}

export default CoverPage;
