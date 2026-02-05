/**
 * AdminPanel - User Management for Administrators
 *
 * Features:
 * - List all users with filtering/pagination
 * - Create new users
 * - Edit user details and roles
 * - Reset user passwords
 * - Revoke all user sessions
 * - Delete users
 *
 * Three-tier RBAC:
 * - user: Read-only access
 * - readwrite: Read + write access
 * - admin: Full access + user management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Button,
  IconButton,
  Typography,
  Box,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Tooltip,
  CircularProgress,
  InputAdornment,
  makeStyles,
  Switch,
  FormControlLabel,
} from '@material-ui/core';
import {
  Page,
  Header,
  Content,
  InfoCard,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import SearchIcon from '@material-ui/icons/Search';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import RefreshIcon from '@material-ui/icons/Refresh';
import LockResetIcon from '@material-ui/icons/LockOpen';
import BlockIcon from '@material-ui/icons/Block';
import PersonIcon from '@material-ui/icons/Person';
import SecurityIcon from '@material-ui/icons/Security';
import AdminPanelSettingsIcon from '@material-ui/icons/SupervisorAccount';

const useStyles = makeStyles((theme) => ({
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  searchField: {
    minWidth: 300,
  },
  roleChip: {
    fontWeight: 600,
  },
  roleAdmin: {
    backgroundColor: '#d32f2f',
    color: 'white',
  },
  roleReadwrite: {
    backgroundColor: '#2ea3f2',
    color: 'white',
  },
  roleUser: {
    backgroundColor: '#9e9e9e',
    color: 'white',
  },
  statusActive: {
    color: '#00b12b',
  },
  statusInactive: {
    color: '#d32f2f',
  },
  actionButtons: {
    display: 'flex',
    gap: theme.spacing(0.5),
  },
  dialogForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minWidth: 400,
  },
  userAvatar: {
    width: 36,
    height: 36,
    marginRight: theme.spacing(1),
    backgroundColor: theme.palette.primary.main,
  },
  statsCard: {
    display: 'flex',
    gap: theme.spacing(4),
    marginBottom: theme.spacing(3),
  },
  statItem: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
}));

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  role: 'user' | 'readwrite' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface CreateUserForm {
  username: string;
  email: string;
  password: string;
  displayName: string;
  role: 'user' | 'readwrite' | 'admin';
}

export const AdminPanel = () => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    username: '',
    email: '',
    password: '',
    displayName: '',
    role: 'user',
  });
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      });
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);

      const response = await fetch(`${backendUrl}/api/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, page, rowsPerPage, search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async () => {
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`${backendUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error?.message || 'Failed to create user');
        return;
      }

      setCreateDialogOpen(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        displayName: '',
        role: 'user',
      });
      loadUsers();
    } catch (error) {
      setFormError('Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`${backendUrl}/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: selectedUser.displayName,
          email: selectedUser.email,
          role: selectedUser.role,
          isActive: selectedUser.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFormError(data.error?.message || 'Failed to update user');
        return;
      }

      setEditDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      setFormError('Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`${backendUrl}/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFormError(data.error?.message || 'Failed to reset password');
        return;
      }

      setResetPasswordDialogOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error) {
      setFormError('Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      const response = await fetch(`${backendUrl}/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedUser(null);
        loadUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleChipClass = (role: string) => {
    switch (role) {
      case 'admin': return classes.roleAdmin;
      case 'readwrite': return classes.roleReadwrite;
      default: return classes.roleUser;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'readwrite': return 'Read-Write';
      default: return 'User';
    }
  };

  const stats = {
    total: total,
    admins: users.filter(u => u.role === 'admin').length,
    active: users.filter(u => u.isActive).length,
  };

  return (
    <Page themeId="tool">
      <Header
        title="User Management"
        subtitle="Manage local authentication users"
      >
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create User
        </Button>
      </Header>
      <Content>
        {/* Stats */}
        <InfoCard>
          <Box className={classes.statsCard}>
            <Box className={classes.statItem}>
              <Typography className={classes.statValue}>{stats.total}</Typography>
              <Typography variant="body2" color="textSecondary">Total Users</Typography>
            </Box>
            <Box className={classes.statItem}>
              <Typography className={classes.statValue}>{stats.admins}</Typography>
              <Typography variant="body2" color="textSecondary">Admins</Typography>
            </Box>
            <Box className={classes.statItem}>
              <Typography className={classes.statValue}>{stats.active}</Typography>
              <Typography variant="body2" color="textSecondary">Active</Typography>
            </Box>
          </Box>
        </InfoCard>

        {/* Toolbar */}
        <Box className={classes.toolbar}>
          <TextField
            className={classes.searchField}
            placeholder="Search users..."
            variant="outlined"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <Box display="flex" style={{ gap: 16 }}>
            <FormControl variant="outlined" size="small" style={{ minWidth: 150 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as string)}
                label="Role"
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="readwrite">Read-Write</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="Refresh">
              <IconButton onClick={loadUsers}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Users Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="textSecondary">No users found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar className={classes.userAvatar}>
                          {user.displayName?.[0] || user.username[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {user.displayName || user.username}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            @{user.username}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={getRoleLabel(user.role)}
                        size="small"
                        className={`${classes.roleChip} ${getRoleChipClass(user.role)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        className={user.isActive ? classes.statusActive : classes.statusInactive}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <Box className={classes.actionButtons}>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset Password">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedUser(user);
                              setResetPasswordDialogOpen(true);
                            }}
                          >
                            <LockResetIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedUser(user);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>

        {/* Create User Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm">
          <DialogTitle>Create New User</DialogTitle>
          <DialogContent>
            <Box className={classes.dialogForm}>
              <TextField
                label="Username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Display Name"
                value={createForm.displayName}
                onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                fullWidth
                required
                helperText="Min 12 characters, uppercase, lowercase, digit, special character"
              />
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  label="Role"
                >
                  <MenuItem value="user">User (Read-only)</MenuItem>
                  <MenuItem value="readwrite">Read-Write (Developer)</MenuItem>
                  <MenuItem value="admin">Admin (Full Access)</MenuItem>
                </Select>
              </FormControl>
              {formError && (
                <Typography color="error" variant="body2">{formError}</Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateUser}
              variant="contained"
              color="primary"
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={20} /> : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm">
          <DialogTitle>Edit User</DialogTitle>
          <DialogContent>
            {selectedUser && (
              <Box className={classes.dialogForm}>
                <TextField
                  label="Username"
                  value={selectedUser.username}
                  fullWidth
                  disabled
                />
                <TextField
                  label="Email"
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Display Name"
                  value={selectedUser.displayName || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, displayName: e.target.value })}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={selectedUser.role}
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as any })}
                    label="Role"
                  >
                    <MenuItem value="user">User (Read-only)</MenuItem>
                    <MenuItem value="readwrite">Read-Write (Developer)</MenuItem>
                    <MenuItem value="admin">Admin (Full Access)</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedUser.isActive}
                      onChange={(e) => setSelectedUser({ ...selectedUser, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
                {formError && (
                  <Typography color="error" variant="body2">{formError}</Typography>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUpdateUser}
              variant="contained"
              color="primary"
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={20} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)} maxWidth="xs">
          <DialogTitle>Reset Password</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" paragraph>
              Set a new password for {selectedUser?.username}. The user will be required to change
              their password on next login.
            </Typography>
            <TextField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              helperText="Min 12 characters, uppercase, lowercase, digit, special character"
            />
            {formError && (
              <Typography color="error" variant="body2" style={{ marginTop: 8 }}>{formError}</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleResetPassword}
              variant="contained"
              color="primary"
              disabled={submitting || !newPassword}
            >
              {submitting ? <CircularProgress size={20} /> : 'Reset'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs">
          <DialogTitle>Delete User?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary">
              Are you sure you want to delete <strong>{selectedUser?.username}</strong>?
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDeleteUser}
              variant="contained"
              color="secondary"
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={20} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};

export default AdminPanel;
