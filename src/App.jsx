import { useState } from "react";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="app-container">
      <h1>LaunderLens</h1>
      <p className="tagline">Visualizing Hidden Money Laundering Networks</p>

      {/* Upload Section */}
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button disabled={!file || loading}>
        {loading ? "Analyzing..." : "Upload & Analyze"}
      </button>

      {error && <p className="error">{error}</p>}

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

export default App;
