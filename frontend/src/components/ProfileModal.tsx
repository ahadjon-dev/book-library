import { useState } from "react";
import { Settings, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { updateProfile, changePassword } from "@/api/auth";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: Props) {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (!isOpen) return null;

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;

    try {
      setSavingProfile(true);
      await updateProfile(displayName.trim());
      await refreshUser();
      showToast(t("profile.profileUpdated"));
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast(t("profile.passwordMismatch"), "error");
      return;
    }

    try {
      setSavingPassword(true);
      await changePassword(currentPassword, newPassword);
      showToast(t("profile.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to change password", "error");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl transition space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Settings className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{t("profile.title")}</h2>
              <p className="text-xs text-ink-secondary">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: Update Profile Name */}
        <form onSubmit={handleUpdateProfile} className="space-y-3">
          <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider">
            {t("profile.displayName")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              placeholder="Your Name"
              required
            />
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
            >
              {savingProfile ? t("common.saving") : t("profile.updateProfile")}
            </button>
          </div>
        </form>

        <div className="border-t border-line pt-4" />

        {/* Section 2: Change Password */}
        <form onSubmit={handleChangePassword} className="space-y-3">
          <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider">
            {t("profile.changePassword")}
          </label>
          <div className="space-y-2">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              placeholder={t("profile.currentPassword")}
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              placeholder={t("profile.newPassword")}
              minLength={8}
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              placeholder={t("profile.confirmPassword")}
              minLength={8}
              required
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
            >
              {savingPassword ? t("common.saving") : t("profile.changePassword")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
