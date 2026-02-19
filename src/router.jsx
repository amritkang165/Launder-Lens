import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CoverPage from "./CoverPage";
import Loading from "./loading";
import Dashboard from "./dashboard";

export default function RouterApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CoverPage />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
