
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Shield,
  CalendarDays,
  Trophy,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Activity,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../context/useAuth';
import { supabase } from '../services/supabase';

import './AdminDashboard.css';
import TeamsManagement from './TeamsManagement';
import FixturesManagement from './FixturesManagement';
import PredictionsManagement from './PredictionsManagement';
import ParticipantsManagement from './ParticipantsManagement';

function AdminDashboard() {
  const [activePage, setActivePage] = useState('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Store the real tournament statistics retrieved from Supabase.
  const [stats, setStats] = useState({
    teams: 0,
    fixtures: 0,
    participants: 0,
    predictions: 0,
  });

  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const { profile, signOut } = useAuth();

  // Navigation items displayed in the admin sidebar.
  const navigation = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Teams', icon: Shield },
    { name: 'Fixtures', icon: CalendarDays },
    { name: 'Predictions', icon: Trophy },
    { name: 'Participants', icon: Users },
    { name: 'Settings', icon: Settings },
  ];

  // Retrieve the latest tournament statistics from Supabase.
  async function fetchDashboardStats() {
    setStatsLoading(true);
    setStatsError('');

    try {
      // Fetch all four counts simultaneously.
      const [
        teamsResult,
        fixturesResult,
        participantsResult,
        predictionsResult,
      ] = await Promise.all([
        supabase
          .from('teams')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),

        supabase
          .from('matches')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'participant'),

        supabase
          .from('predictions')
          .select('id', { count: 'exact', head: true }),
      ]);

      // Display an error if any database request fails.
      if (teamsResult.error) throw teamsResult.error;
      if (fixturesResult.error) throw fixturesResult.error;
      if (participantsResult.error) throw participantsResult.error;
      if (predictionsResult.error) throw predictionsResult.error;

      // Save the actual database counts in React state.
      setStats({
        teams: teamsResult.count ?? 0,
        fixtures: fixturesResult.count ?? 0,
        participants: participantsResult.count ?? 0,
        predictions: predictionsResult.count ?? 0,
      });
    } catch (error) {
      console.error('Dashboard statistics error:', error.message);
      setStatsError('Unable to load tournament statistics. Please refresh.');
    } finally {
      setStatsLoading(false);
    }
  }

  // Load statistics whenever the administrator opens Overview.
  useEffect(() => {
    if (activePage !== 'Overview') return;

    Promise.resolve().then(() => {
      fetchDashboardStats();
    });
  }, [activePage]);

  // Sign the administrator out of Supabase.
  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Unable to sign out:', error.message);
    }
  };

  // Descriptions displayed beneath the dashboard heading.
  const pageDescriptions = {
    Overview: 'Here is what is happening in your tournament.',
    Teams: 'Manage tournament teams and their information.',
    Fixtures: 'Create, edit and manage tournament fixtures.',
    Predictions: 'Monitor participant predictions.',
    Participants: 'View and manage registered participants.',
    Settings: 'Manage your tournament configuration.',
  };

  return (
    <div className="admin-layout">
      {/* Mobile sidebar backdrop. */}
      {sidebarOpen && (
        <div
          className="admin-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar navigation. */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="admin-brand">
          <div className="admin-brand-icon">
            <Trophy size={23} />
          </div>

          <div>
            <h2>Blueroof</h2>
            <span>TOURNAMENT ADMIN</span>
          </div>

          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={21} />
          </button>
        </div>

        <div className="sidebar-section-label">MENU</div>

        <nav className="admin-navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`admin-nav-item ${
                  activePage === item.name ? 'active' : ''
                }`}
                onClick={() => {
                  setActivePage(item.name);
                  setSidebarOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-user-card">
            <div className="admin-avatar">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>

            <div className="admin-user-details">
              <strong>{profile?.display_name || 'Administrator'}</strong>
              <span>Administrator</span>
            </div>
          </div>

          <button className="admin-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main dashboard content. */}
      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-left">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div>
              <span className="admin-breadcrumb">
                Blueroof / Administration
              </span>
              <h1>{activePage}</h1>
            </div>
          </div>

          <div className="admin-header-right">
            <span className="admin-status">
              <span className="status-dot" />
              Admin Access
            </span>
          </div>
        </header>

        <section className="admin-content">
          {/* Welcome heading shared by all dashboard sections. */}
          <div className="admin-welcome">
            <div>
              <span className="admin-eyebrow">
                BLUEROOF FOOTBALL TOURNAMENT
              </span>
              <h2>Welcome back, {profile?.display_name || 'Admin'}!</h2>
              <p>{pageDescriptions[activePage]}</p>
            </div>

            <div className="welcome-icon">
              <Trophy size={34} />
            </div>
          </div>

          {/* Overview dashboard with live database counts. */}
          {activePage === 'Overview' && (
            <>
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="stat-icon teams-icon">
                    <Shield size={21} />
                  </div>
                  <span>Total Teams</span>
                  <h3>{statsLoading ? '...' : stats.teams}</h3>
                  <small>Registered tournament teams</small>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-icon fixtures-icon">
                    <CalendarDays size={21} />
                  </div>
                  <span>Total Fixtures</span>
                  <h3>{statsLoading ? '...' : stats.fixtures}</h3>
                  <small>Scheduled matches</small>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-icon participants-icon">
                    <Users size={21} />
                  </div>
                  <span>Participants</span>
                  <h3>{statsLoading ? '...' : stats.participants}</h3>
                  <small>Registered prediction users</small>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-icon predictions-icon">
                    <Activity size={21} />
                  </div>
                  <span>Predictions</span>
                  <h3>{statsLoading ? '...' : stats.predictions}</h3>
                  <small>Total predictions submitted</small>
                </div>
              </div>

              {/* Refresh the figures whenever needed. */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={fetchDashboardStats}
                  disabled={statsLoading}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={statsLoading ? 'animate-spin' : ''}
                  />
                  Refresh Statistics
                </button>
              </div>

              {/* Display database errors when they occur. */}
              {statsError && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {statsError}
                </div>
              )}

              {/* Dashboard quick actions. */}
              <div className="admin-section-card">
                <div className="admin-section-heading">
                  <div>
                    <h3>Quick Actions</h3>
                    <p>Manage important tournament activities.</p>
                  </div>
                </div>

                <div className="quick-actions-grid">
                  <button
                    className="quick-action"
                    onClick={() => setActivePage('Teams')}
                  >
                    <Plus size={20} />
                    <span>Add New Team</span>
                  </button>

                  <button
                    className="quick-action"
                    onClick={() => setActivePage('Fixtures')}
                  >
                    <CalendarDays size={20} />
                    <span>Create Fixture</span>
                  </button>

                  <button
                    className="quick-action"
                    onClick={() => setActivePage('Participants')}
                  >
                    <Users size={20} />
                    <span>View Participants</span>
                  </button>
                </div>
              </div>

              {/* Recent activity remains a placeholder for now. */}
              <div className="admin-section-card recent-activity">
                <div className="admin-section-heading">
                  <div>
                    <h3>Recent Activity</h3>
                    <p>Keep track of tournament updates.</p>
                  </div>
                </div>

                <div className="empty-activity">
                  <Activity size={27} />
                  <p>No recent activity yet.</p>
                  <span>
                    Updates will appear here as your tournament grows.
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Functional team management section. */}
          {activePage === 'Teams' && <TeamsManagement />}

          {/* Functional fixtures management section. */}
          {activePage === 'Fixtures' && <FixturesManagement />}

          {/* Functional prediction management section. */}
          {activePage === 'Predictions' && <PredictionsManagement />}

  
          {/* Functional participant management section. */}
           {activePage === 'Participants' && <ParticipantsManagement />}
  

          {/* Tournament settings placeholder. */}
          {activePage === 'Settings' && (
            <div className="admin-section-card section-placeholder">
              <div className="placeholder-icon">
                <Settings size={30} />
              </div>
              <h3>Settings Management</h3>
              <p>Tournament configuration will be connected here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;
