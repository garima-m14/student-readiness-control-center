import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/context";
import { Shell } from "../components/Shell";
import { Loading } from "../components/ui";
import { Login } from "../pages/Login";
import { Students } from "../pages/Students";
import { StudentDetail } from "../pages/StudentDetail";
function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route element={<Shell />}>
          <Route path="/students" element={<Students />} />
          <Route path="/students/:id" element={<StudentDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/students" replace />} />
    </Routes>
  );
}
