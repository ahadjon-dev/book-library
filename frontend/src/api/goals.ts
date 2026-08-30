import { api } from "@/api/client";
import type { ReadingGoal } from "@/types/goal";

export async function fetchReadingGoal(year: number): Promise<ReadingGoal> {
  const { data } = await api.get<ReadingGoal>(`/goals/${year}`);
  return data;
}

export async function setReadingGoal(year: number, targetBooks: number): Promise<ReadingGoal> {
  const { data } = await api.post<ReadingGoal>("/goals", { year, target_books: targetBooks });
  return data;
}
