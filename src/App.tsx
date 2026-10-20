import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ui";
import Landing from "./features/rooms/Landing";
import RoomPage from "./features/room/RoomPage";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
