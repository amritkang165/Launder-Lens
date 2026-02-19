import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./CoverPage.css";
import "./App.css";

function CoverPage() {
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();


  // Load Spline script
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.src =
      "https://cdn.jsdelivr.net/npm/@splinetool/viewer@1.12.58/build/spline-viewer.js";
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      setFile(null);
      return;
    }

    setError("");
    setFile(selectedFile);
  };

  const handleSubmit = () => {
  if (!file) {
    setError("Please choose a CSV file first.");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      sessionStorage.setItem("launderlens_rows", JSON.stringify(results.data));
      setShowModal(false);
      navigate("/dashboard");
    },
    error: () => setError("Failed to parse CSV."),
  });
};


  return (
    <div className="cover-container">
      {/* Spline Background */}
      <div className="spline-bg">
        <spline-viewer url="https://prod.spline.design/SMOEtnIQMbZh1EUN/scene.splinecode"></spline-viewer>
      </div>

      {/* Center Content */}
      <div className="center-overlay">
        <h1 className="project-title">LaunderLens</h1>

        <button
          className="main-cta"
          onClick={() => setShowModal(true)}
        >
          Upload & Analyze
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Upload Transaction CSV</h3>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />

            {file && (
              <p className="upload-hint">
                Selected: {file.name}
              </p>
            )}

            {error && (
              <p className="upload-error">{error}</p>
            )}

            <button
              className="submit-btn"
              onClick={handleSubmit}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoverPage;
