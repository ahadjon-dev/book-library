export interface LibraryBrief {
  id: number;
  name: string;
}

export interface LibraryMember {
  id: number;
  display_name: string;
  role: string;
}

export interface LibraryInfo {
  id: number;
  name: string;
  my_role: string;
  members: LibraryMember[];
}

export interface InviteInfo {
  invite_code: string | null;
  join_path: string | null;
}

export interface InvitePreview {
  library_name: string;
  member_count: number;
}
