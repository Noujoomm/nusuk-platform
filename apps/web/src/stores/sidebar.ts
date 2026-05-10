/**
 * Sidebar collapse state — global Zustand store, persisted in
 * localStorage so a refresh keeps the user's preference. Used by:
 *   - <Sidebar/>           reads `collapsed` to slide off-screen
 *   - <DashboardLayout/>   reads `collapsed` to flip main margin + drive
 *                          the hamburger button + Ctrl/Cmd+B shortcut
 *
 * Storage key is namespaced under `roya:` to keep the localStorage
 * inspector readable when adding more keys later.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarStore {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useSidebar = create<SidebarStore>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (v) => set({ collapsed: v }),
    }),
    {
      name: 'roya:sidebar',
      // Don't restore an in-flight transition snapshot — only the bool.
      partialize: (s) => ({ collapsed: s.collapsed }),
    },
  ),
);
