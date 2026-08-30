import { api } from "@/api/client";
import type { BookLoan, CreateLoanPayload } from "@/types/loan";

export async function fetchLoans(status: "all" | "active" | "returned" = "active"): Promise<BookLoan[]> {
  const { data } = await api.get<BookLoan[]>("/loans", { params: { status } });
  return data;
}

export async function createLoan(payload: CreateLoanPayload): Promise<BookLoan> {
  const { data } = await api.post<BookLoan>("/loans", payload);
  return data;
}

export async function returnLoan(loanId: number): Promise<BookLoan> {
  const { data } = await api.patch<BookLoan>(`/loans/${loanId}/return`);
  return data;
}

export async function deleteLoan(loanId: number): Promise<void> {
  await api.delete(`/loans/${loanId}`);
}
