import { Routes, Route } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import SelectFramePage from './pages/SelectFramePage';
import PhotoboothPage from './pages/PhotoboothPage';
import MuteButton from './components/MuteButton';
import './App.css';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/select-frame" element={<SelectFramePage />} />
        <Route path="/booth" element={<PhotoboothPage />} />
      </Routes>
      <MuteButton />
    </>
  );
}

export default App;