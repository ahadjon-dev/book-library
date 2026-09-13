import { useEffect, useState } from "react";
import { Check, Copy, Link2, Trash2, Users, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { fetchInvite, fetchLibrary, renameLibrary, revokeInvite, rotateInvite } from "@/api/library";
import { transliterateLibrary } from "@/api/books";
import type { InviteInfo, LibraryInfo } from "@/types/library";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LibraryModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [library, setLibrary] = useState<LibraryInfo | null>(null);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen]);

  async function load() {
    try {
      setLoading(true);
      const lib = await fetchLibrary();
      setLibrary(lib);
      setName(lib.name);
      if (lib.my_role === "owner") {
        setInvite(await fetchInvite());
      }
    } catch (err) {
      console.error("Failed to load library", err);
    } finally {
      setLoading(false);
    }
  }

  const isOwner = library?.my_role === "owner";

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      const lib = await renameLibrary(name.trim());
      setLibrary(lib);
      showToast(t("library.renamed"));
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to rename library", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateInvite() {
    try {
      setInviteBusy(true);
      setInvite(await rotateInvite());
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to create invite", "error");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRevokeInvite() {
    try {
      setInviteBusy(true);
      await revokeInvite();
      setInvite({ invite_code: null, join_path: null });
      showToast(t("library.inviteRevoked"));
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to revoke invite", "error");
    } finally {
      setInviteBusy(false);
    }
  }

  function handleCopyJoinLink() {
    if (!invite?.join_path) return;
    navigator.clipboard.writeText(`${window.location.origin}${invite.join_path}`);
    showToast(t("library.joinLinkCopied"));
  }

  async function handleTransliterate(target: "latn" | "cyrl") {
    try {
      setConverting(true);
      const res = await transliterateLibrary(target);
      showToast(t("library.convertedSuccess", { count: res.converted_books_count }));
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to transliterate library", "error");
    } finally {
      setConverting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl transition space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-ink">{t("library.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !library ? (
          <div className="h-40 animate-pulse bg-canvas rounded-xl" />
        ) : (
          <>
            {/* Library name */}
            {isOwner ? (
              <form onSubmit={handleRename} className="space-y-1">
                <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
                  {t("library.nameLabel")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    className="flex-1 rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={saving || name.trim() === library.name}
                    className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
                  >
                    {saving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-1">
                  {t("library.nameLabel")}
                </p>
                <p className="text-sm font-semibold text-ink">{library.name}</p>
              </div>
            )}

            {/* Members */}
            <div>
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">
                {t("library.membersTitle")}
              </p>
              <div className="space-y-1.5">
                {library.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
                        {m.display_name[0]?.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-ink truncate">{m.display_name}</span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        m.role === "owner"
                          ? "bg-accent/10 text-accent border border-accent/20"
                          : "bg-surface-hover text-ink-secondary border border-line"
                      }`}
                    >
                      {m.role === "owner" ? t("library.roleOwner") : t("library.roleMember")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite (owner only) */}
            {isOwner && (
              <div className="space-y-2 border-t border-line pt-4">
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
                  {t("library.inviteTitle")}
                </p>
                <p className="text-xs text-ink-secondary">{t("library.inviteSubtitle")}</p>

                {invite?.invite_code ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2">
                      <Link2 className="h-4 w-4 shrink-0 text-accent" />
                      <code className="flex-1 truncate text-xs text-ink">
                        {window.location.origin}
                        {invite.join_path}
                      </code>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCopyJoinLink}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-hover transition"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{t("library.copyJoinLink")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRevokeInvite}
                        disabled={inviteBusy}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-900 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950 transition disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t("library.revokeInvite")}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRotateInvite}
                    disabled={inviteBusy}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t("library.generateInvite")}</span>
                  </button>
                )}
              </div>
            )}

            {/* Script Conversion */}
            <div className="space-y-2 border-t border-line pt-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🔤</span>
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
                  {t("library.transliterateTitle")}
                </p>
              </div>
              <p className="text-xs text-ink-secondary">
                {t("library.transliterateDesc")}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => handleTransliterate("latn")}
                  className="rounded-xl border border-line bg-canvas hover:bg-surface-hover px-3 py-2 text-xs font-semibold text-ink transition disabled:opacity-50 text-center"
                >
                  {converting ? t("library.converting") : t("library.convertToLatin")}
                </button>
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => handleTransliterate("cyrl")}
                  className="rounded-xl border border-line bg-canvas hover:bg-surface-hover px-3 py-2 text-xs font-semibold text-ink transition disabled:opacity-50 text-center"
                >
                  {converting ? t("library.converting") : t("library.convertToCyrillic")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
