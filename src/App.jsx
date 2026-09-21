import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TopNav from './components/TopNav';
import SearchPage from './pages/SearchPage';
import ConfirmPage from './pages/ConfirmPage';
import ResultsPage from './pages/ResultsPage';
import NoResultPage from './pages/NoResultPage';
import ConflictPage from './pages/ConflictPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-background text-primary">
        <TopNav />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/confirm" element={<ConfirmPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/no-result" element={<NoResultPage />} />
            <Route path="/conflict" element={<ConflictPage />} />
            <Route path="/document/:id" element={<DocumentDetailPage />} />
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
