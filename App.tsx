import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Providers, Skeleton } from './components/ui';
import { useUser } from './lib/auth';
import Shell from './components/Shell';
import Landing from './pages/Landing';
import { Login, Signup, Onboarding } from './pages/Auth';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Create = lazy(() => import('./pages/Create'));
const Editor = lazy(() => import('./pages/Editor'));
const Projects = lazy(() => import('./pages/Projects'));
const Hub = lazy(() => import('./pages/Hub'));
const Tool = lazy(() => import('./pages/Tool'));
const Review = lazy(() => import('./pages/Review'));
const Agency = lazy(() => import('./pages/Agency'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Billing = lazy(() => import('./pages/Billing'));
const Settings = lazy(() => import('./pages/Settings'));
const Trust = lazy(() => import('./pages/Trust'));
const Admin = lazy(() => import('./pages/Admin'));
const Docs = lazy(() => import('./pages/Docs'));

function Loading() {
  return (
    <div className="p-8 space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96" />
      <div className="grid md:grid-cols-3 gap-4 pt-4"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useUser();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!user.onboarded && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <ScrollTop />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<RequireAuthOnboard />} />
            <Route path="/app" element={<RequireAuth><Shell /></RequireAuth>}>
              <Route index element={<S><Dashboard /></S>} />
              <Route path="create" element={<S><Create /></S>} />
              <Route path="editor/:id" element={<S><Editor /></S>} />
              <Route path="projects" element={<S><Projects /></S>} />
              <Route path="hub/:cat" element={<S><Hub /></S>} />
              <Route path="tool/:id" element={<S><Tool /></S>} />
              <Route path="review/:id" element={<S><Review /></S>} />
              <Route path="agency" element={<S><Agency /></S>} />
              <Route path="analytics" element={<S><Analytics /></S>} />
              <Route path="billing" element={<S><Billing /></S>} />
              <Route path="settings" element={<S><Settings /></S>} />
              <Route path="trust" element={<S><Trust /></S>} />
              <Route path="admin" element={<S><Admin /></S>} />
              <Route path="docs" element={<S><Docs /></S>} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Providers>
    </BrowserRouter>
  );
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}

function RequireAuthOnboard() {
  const user = useUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Onboarding />;
}
