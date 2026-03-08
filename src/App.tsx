import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Finance from './pages/Finance';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Services from './pages/Services';
import Vendors from './pages/Vendors';
import Settlement from './pages/Settlement';
import VendorSettlement from './pages/VendorSettlement';
import Incentives from './pages/Incentives';
import BlogPosts from './pages/BlogPosts';
import Accounts from './pages/Accounts';
import Guide from './pages/Guide';
import Landing from './pages/Landing';
import BlogShareView from './pages/BlogShareView';
import BlogOrderForm from './pages/BlogOrderForm';
import RankShareView from './pages/RankShareView';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/share/blog/:token" element={<BlogShareView />} />
      <Route path="/share/rank/:token" element={<RankShareView />} />
      <Route path="/order-form/:token" element={<BlogOrderForm />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="finance" element={<Finance />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="services" element={<Services />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="sales" element={<Sales />} />
        <Route path="settlement" element={<Settlement />} />
        <Route path="vendor-settlement" element={<VendorSettlement />} />
        <Route path="incentives" element={<Incentives />} />
        <Route path="blog-posts" element={<BlogPosts />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="guide" element={<Guide />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
