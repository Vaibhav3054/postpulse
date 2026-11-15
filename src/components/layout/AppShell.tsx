"use client";

import { useState, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  PenSquare,
  FileText,
  Menu,
} from "lucide-react";
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

interface MobileNavContextType {
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const MobileNavContext = createContext<MobileNavContextType>({
  openMobileSidebar: () => {},
  closeMobileSidebar: () => {},
});

export const useMobileNav = () => useContext(MobileNavContext);

export function AppShell({
  currentWorkspace,
  workspaces,
  user,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const slug = currentWorkspace.slug;

  const mobileNavItems = [
    {
      label: "Home",
      href: `/app/${slug}/dashboard`,
      icon: LayoutDashboard,
    },
    {
      label: "Calendar",
      href: `/app/${slug}/calendar`,
      icon: CalendarDays,
    },
    {
      label: "Compose",
      href: `/app/${slug}/composer`,
      icon: PenSquare,
      isPrimary: true,
    },
    {
      label: "Posts",
      href: `/app/${slug}/posts`,
      icon: FileText,
    },
  ];

  return (
    <MobileNavContext.Provider
      value={{
        openMobileSidebar: () => setIsMobileSidebarOpen(true),
        closeMobileSidebar: () => setIsMobileSidebarOpen(false),
      }}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Responsive Sidebar (Desktop sticky, Mobile slide-out drawer) */}
        <Sidebar
          currentWorkspace={currentWorkspace}
          workspaces={workspaces}
          user={user}
          onOpenCreateWorkspace={() => setIsWorkspaceModalOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Page Area */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0 pb-16 md:pb-0">
          {children}
        </div>

        {/* Mobile Bottom Navigation Bar (Thumb-friendly for Phones) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-xl z-40 px-3 flex items-center justify-around select-none">
          {mobileNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            if (item.isPrimary) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-5"
                >
                  <div className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 active:scale-95 transition-all">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium text-indigo-400 mt-1">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "text-indigo-400 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}

          {/* More / Menu Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Menu</span>
          </button>
        </div>

        {/* Create Workspace Modal */}
        <WorkspaceModal
          isOpen={isWorkspaceModalOpen}
          onClose={() => setIsWorkspaceModalOpen(false)}
        />
      </div>
    </MobileNavContext.Provider>
  );
}
