export interface BookLoan {
  id: number;
  user_id: number;
  book_id: number;
  book_title: string;
  borrower_name: string;
  borrower_contact: string | null;
  loan_date: string;
  due_date: string | null;
  returned_at: string | null;
  is_returned: boolean;
  is_overdue: boolean;
  notes: string | null;
  created_at: string;
}

export interface CreateLoanPayload {
  book_id: number;
  borrower_name: string;
  borrower_contact?: string | null;
  loan_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
}
