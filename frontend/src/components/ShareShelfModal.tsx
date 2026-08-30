import { useEffect, useState } from "react";
import { Share2, Copy, ExternalLink, X } from "lucide-react";
import { fetchMyShareLink, updateMyShareLink } from "@/api/public";
import { useTranslation } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareShelfModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) loadShareLink();
  }, [isOpen]);

  async function loadShareLink() {
    try {
      setLoading(true);
      const data = await fetchMyShareLink();
      setSlug(data.share_slug || "");
      setIsPublic(data.is_public_shelf);
    } catch (err) {
      console.error("Failed to fetch share link", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      await updateMyShareLink({
        share_slug: slug.trim() || null,
        is_public_shelf: isPublic,
      });
      showToast(t("shareShelf.saveSlug"));
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to update share link");
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    const fullUrl = `${window.location.origin}/share/${slug.trim() || "my-library"}`;
    navigator.clipboard.writeText(fullUrl);
    showToast(t("shareShelf.linkCopied"));
  }

  if (!isOpen) return null;

  const currentShareUrl = `${window.location.origin}/share/${slug.trim() || "my-library"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl transition space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Share2 className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-ink">{t("shareShelf.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-secondary hover:text-ink hover:bg-surface-hover transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-ink-secondary">{t("shareShelf.subtitle")}</p>

        {loading ? (
          <div className="h-28 animate-pulse bg-canvas rounded-xl" />
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-line bg-canvas">
              <span className="text-xs font-semibold text-ink">{t("shareShelf.publicToggle")}</span>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                {t("shareShelf.customSlug")}
              </label>
              <div className="flex items-center rounded-lg border border-line bg-canvas px-3 py-2 text-sm">
                <span className="text-ink-secondary text-xs select-none">/share/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-shelf"
                  className="w-full bg-transparent text-ink text-sm focus:outline-none ml-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!isPublic}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-hover transition disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{t("shareShelf.copyLink")}</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover transition disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("shareShelf.saveSlug")}
              </button>
            </div>

            {isPublic && (
              <div className="pt-2">
                <a
                  href={currentShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <span>Open public shelf in new tab</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
