import { useEffect } from "react";
import { useNavigate } from "react-router-dom";


export default function Loading() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      navigate("/dashboard");
    }, 1200); // 1.2 sec loading screen
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "system-ui",
        background: "black",
        color: "white",
      }}
    >
      <h1 style={{ marginBottom: 10 }}>Analyzing transactions…</h1>
      <p style={{ opacity: 0.7 }}>Building graph • Detecting rings • Scoring risk</p>

      <div style={{ marginTop: 20, width: 240, height: 10, border: "1px solid #444" }}>
        <div
          style={{
            height: "100%",
            width: "100%",
            background: "linear-gradient(90deg, #22c55e, #38bdf8)",
            animation: "pulse 1.2s infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.35; }
          50% { opacity: 1; }
          100% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
