import { Navigate, Route, Routes } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";
import { BookDetail } from "@/pages/BookDetail";
import { BookForm } from "@/pages/BookForm";
import { Gallery } from "@/pages/Gallery";
import { Login } from "@/pages/Login";
import { Stats } from "@/pages/Stats";
import { Loans } from "@/pages/Loans";
import { TableView } from "@/pages/TableView";
import { Wishlist } from "@/pages/Wishlist";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Gallery />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/table"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TableView />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Stats />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/loans"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Loans />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/wishlist"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Wishlist />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/books/new"
        element={
          <ProtectedRoute>
            <AppLayout>
              <BookForm mode="create" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/books/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <BookDetail />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/books/:id/edit"
        element={
          <ProtectedRoute>
            <AppLayout>
              <BookForm mode="edit" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
