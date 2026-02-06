import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Organization {
  id: string;
  name: string;
  slug: string;
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
