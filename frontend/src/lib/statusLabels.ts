import { useTranslation } from "@/lib/LanguageContext";
import type { ReadStatus } from "@/types/book";

const STATUS_VALUES: ReadStatus[] = ["unread", "reading", "finished", "abandoned"];

export function useStatusLabels(): Record<ReadStatus, string> {
  const { t } = useTranslation();
  return {
    unread: t("status.unread"),
    reading: t("status.reading"),
    finished: t("status.finished"),
    abandoned: t("status.abandoned"),
  };
}

export function useStatusOptions(): { value: ReadStatus; label: string }[] {
  const labels = useStatusLabels();
  return STATUS_VALUES.map((value) => ({ value, label: labels[value] }));
}
