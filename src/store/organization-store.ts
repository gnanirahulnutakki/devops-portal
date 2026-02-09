import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'ADMIN' | 'READWRITE' | 'USER';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: UserRole;
}

interface OrganizationState {
  currentOrganization: Organization | null;
  setOrganization: (org: Organization) => void;
  clearOrganization: () => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      currentOrganization: null,
      setOrganization: (org) => set({ currentOrganization: org }),
      clearOrganization: () => set({ currentOrganization: null }),
    }),
    {
      name: 'organization-storage',
    }
  )
);

/**
 * Helper to check if user has admin role
 */
export function isAdmin(role?: UserRole): boolean {
  return role === 'ADMIN';
}
