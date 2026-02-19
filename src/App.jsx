import { BrowserRouter, Routes, Route } from "react-router-dom";
import CoverPage from "./CoverPage";
import Loading from "./loading";
import Dashboard from "./dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CoverPage />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
