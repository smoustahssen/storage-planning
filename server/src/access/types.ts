export type UserRole = "admin" | "editor" | "viewer";

export interface AuthUser {
  rosId: string;
  name: string;
  email: string;
  role: UserRole;
  scope: string;   // team name or 'All' for admin/editor, '' for viewer
}
