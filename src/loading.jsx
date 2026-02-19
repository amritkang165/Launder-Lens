import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./loading.css";

export default function Loading() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/dashboard");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="loading-container">
      <h1 className="loading-title">LaunderLens</h1>

      <p className="loading-tagline">
        Tracing transactions • Exposing fraud rings
      </p>

      {/* Styled Circular Loader */}
      <div className="loader-wrapper">
        <div className="loader-outer" />
        <div className="loader-inner" />
      </div>

      <p className="loading-sub scanning">
        Analyzing transaction networks…
      </p>
    </div>
  );
}