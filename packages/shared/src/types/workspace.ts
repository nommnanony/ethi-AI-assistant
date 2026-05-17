export interface WorkspaceInfo {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isPersonal: boolean;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
}

export interface FolderInfo {
  id: string;
  name: string;
  parentId: string | null;
  children?: FolderInfo[];
  createdAt: string;
}

export interface PromptInfo {
  id: string;
  name: string;
  content: string;
  description: string | null;
  variables: Record<string, string> | null;
  tags: string[];
  isPublic: boolean;
  isTemplate: boolean;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatInfo {
  id: string;
  title: string | null;
  workspaceId: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
