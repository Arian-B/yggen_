import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ExpeditionLayout from './layouts/ExpeditionLayout';
import LandingPage from './pages/LandingPage';
import CreateExpedition from './pages/CreateExpedition';
import LearningMode from './pages/LearningMode';
import MapMode from './pages/MapMode';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        {/* Expedition Routes wrapped in Layout */}
        <Route element={<ExpeditionLayout />}>
           <Route path="/create" element={<CreateExpedition />} />
           <Route path="/learn/:id" element={<LearningMode />} />
           <Route path="/map/:id" element={<MapMode />} />
           {/* Fallback for undefined routes within layout usually not needed if global * catches it, but nice to have */}
        </Route>

        <Route path="*" element={
          <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
            <h1 className="text-4xl text-yggen-teal mb-4">404 - LOST IN THE VOID</h1>
            <a href="/" className="underline hover:text-yggen-teal">Return to Safety</a>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
