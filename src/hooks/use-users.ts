import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'USER' | 'READWRITE' | 'ADMIN';
  createdAt: string;
  emailVerified: string | null;
  membershipId: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  password?: string;
  role?: 'USER' | 'READWRITE' | 'ADMIN';
}

export interface UpdateUserData {
  name?: string;
  role?: 'USER' | 'READWRITE' | 'ADMIN';
  password?: string;
}

// Fetch all users in the organization
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<User[]> => {
      const response = await fetch('/api/users');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch users');
      }
      const data = await response.json();
      return data.data || data;
    },
  });
}

// Create a new user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Update a user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserData }) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Remove a user from the organization
export function useRemoveUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to remove user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
