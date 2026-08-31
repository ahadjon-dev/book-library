import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { MobileMoreDrawer } from "@/components/MobileMoreDrawer";
import { AddBooksHubModal } from "@/components/AddBooksHubModal";
import { LibraryModal } from "@/components/LibraryModal";
import { WhatToReadModal } from "@/components/WhatToReadModal";
import { ProfileModal } from "@/components/ProfileModal";
import { ShareShelfModal } from "@/components/ShareShelfModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";
import { BookDetail } from "@/pages/BookDetail";
import { BookForm } from "@/pages/BookForm";
import { Gallery } from "@/pages/Gallery";
import { Login } from "@/pages/Login";
import { Stats } from "@/pages/Stats";
import { Loans } from "@/pages/Loans";
import { PublicView } from "@/pages/PublicView";
import { Wishlist } from "@/pages/Wishlist";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [addHubOpen, setAddHubOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6 pb-20 md:pb-6">{children}</main>
      <BottomNav
        onOpenRecommend={() => setRecommendOpen(true)}
        onOpenAddHub={() => setAddHubOpen(true)}
        onOpenMore={() => setMoreOpen(true)}
      />

      <AddBooksHubModal
        isOpen={addHubOpen}
        onClose={() => setAddHubOpen(false)}
        onSuccess={() => window.location.reload()}
      />
      <WhatToReadModal
        isOpen={recommendOpen}
        onClose={() => setRecommendOpen(false)}
      />
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <ShareShelfModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
      <LibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
      />
      <MobileMoreDrawer
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenProfile={() => {
          setMoreOpen(false);
          setProfileOpen(true);
        }}
        onOpenShare={() => {
          setMoreOpen(false);
          setShareOpen(true);
        }}
        onOpenLibrary={() => {
          setMoreOpen(false);
          setLibraryOpen(true);
        }}
        onLogout={() => {
          setMoreOpen(false);
          logout();
          navigate("/login");
        }}
      />
    </div>
  );
}

export function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/join/:inviteCode" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/share/:slug" element={<PublicView />} />
      <Route path="/u/:slug" element={<PublicView />} />
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
        element={<Navigate to="/?view=table" replace />}
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
