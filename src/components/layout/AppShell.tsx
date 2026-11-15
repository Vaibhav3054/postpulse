"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { WorkspaceModal } from "./WorkspaceModal";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  planId: string;
  planName: string;
  role: string;
}

interface UserInfo {
  id: string;
  email: string;
  fullName?: string | null;
}

interface AppShellProps {
  currentWorkspace: WorkspaceInfo;
  workspaces: WorkspaceInfo[];
  user: UserInfo;
  children: React.ReactNode;
}

export function AppShell({
  currentWorkspace,
  workspaces,
  user,
  children,
}: AppShellProps) {
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar navigation */}
      <Sidebar
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
        user={user}
        onOpenCreateWorkspace={() => setIsWorkspaceModalOpen(true)}
      />

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        {children}
      </div>

      {/* Create Workspace Modal */}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
    </div>
  );
}
