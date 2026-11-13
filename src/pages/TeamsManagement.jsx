
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Shield,
  RefreshCw,
  Upload,
  Users,
} from 'lucide-react';

import './TeamsManagement.css';

// Default list of teams supplied for the Blueroof tournament.
const DEFAULT_TEAM_LIST = `GROUP A
YOYO FC
SILENT MOVES FC
LIGHT FC
DOMINATORS FC

GROUP B
PREDATORS FC
LEGEND FC
ELITE FC
DAMILOLA FC

GROUP C
PROVIDENCE FC
KIKI FC
OBF FC
INVINCIBLE FC

GROUP D
GOLDBERG FC
TAKERS FC
INDIGENOUS FC
OPAY FC`;

const GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

function TeamsManagement() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Form fields for creating or editing a team.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [groupName, setGroupName] = useState('Group A');
  const [isActive, setIsActive] = useState(true);

  // Store the bulk team list in a text area.
  const [bulkText, setBulkText] = useState(DEFAULT_TEAM_LIST);

  // Retrieve all tournament teams from Supabase.
  const fetchTeams = async () => {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTeams(data || []);
    }

    setLoading(false);
  };

  // Load teams when the component first mounts.
  useEffect(() => {
    let cancelled = false;

    const loadInitialTeams = async () => {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setTeams(data || []);
      }

      setLoading(false);
    };

    loadInitialTeams();

    return () => {
      cancelled = true;
    };
  }, []);

  // Clear the form and prepare it for a new team.
  const resetForm = () => {
    setName('');
    setDescription('');
    setLogoUrl('');
    setGroupName('Group A');
    setIsActive(true);
    setEditingTeam(null);
    setShowForm(false);
    setError('');
  };

  // Load an existing team's information into the form.
  const handleEdit = (team) => {
    setEditingTeam(team);
    setName(team.name);
    setDescription(team.description || '');
    setLogoUrl(team.logo_url || '');
    setGroupName(team.group_name || 'Group A');
    setIsActive(team.is_active);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  // Save a new team or update an existing one.
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Please enter a team name.');
      return;
    }

    setSaving(true);

    const teamData = {
      name: name.trim(),
      description: description.trim() || null,
      logo_url: logoUrl.trim() || null,
      group_name: groupName,
      is_active: isActive,
    };

    let result;

    if (editingTeam) {
      result = await supabase
        .from('teams')
        .update(teamData)
        .eq('id', editingTeam.id);
    } else {
      result = await supabase
        .from('teams')
        .insert(teamData);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSuccess(
      editingTeam
        ? 'Team updated successfully.'
        : 'New team added successfully.'
    );

    resetForm();
    await fetchTeams();
    setSaving(false);
  };

  // Convert the pasted group list into structured team records.
  const parseBulkTeams = (text) => {
    const lines = text.split(/\r?\n/);
    const parsedTeams = [];
    let currentGroup = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) continue;

      // Recognise headings such as GROUP A or Group B.
      const headingMatch = line.match(/^group\s+([a-d])$/i);

      if (headingMatch) {
        currentGroup = `Group ${headingMatch[1].toUpperCase()}`;
        continue;
      }

      // Support entries such as YOYO FC, Group A.
      const commaParts = line.split(',');

      if (
        commaParts.length === 2 &&
        /^group\s+[a-d]$/i.test(commaParts[1].trim())
      ) {
        const teamName = commaParts[0].trim();

        if (teamName) {
          parsedTeams.push({
            name: teamName,
            group_name: commaParts[1].trim().replace(
              /^group\s+([a-d])$/i,
              (_, letter) => `Group ${letter.toUpperCase()}`
            ),
            is_active: true,
          });
        }

        continue;
      }

      if (currentGroup) {
        parsedTeams.push({
          name: line,
          group_name: currentGroup,
          is_active: true,
        });
      }
    }

    return parsedTeams;
  };

  // Import all valid, non-duplicate teams in one operation.
  const handleBulkImport = async () => {
    setError('');
    setSuccess('');

    const parsedTeams = parseBulkTeams(bulkText);

    if (parsedTeams.length === 0) {
      setError('No teams found. Check your group headings and team names.');
      return;
    }

    // Remove duplicate names from the pasted list.
    const pastedNames = new Set();
    const uniqueTeams = [];

    for (const team of parsedTeams) {
      const normalizedName = team.name.toLowerCase();

      if (!pastedNames.has(normalizedName)) {
        pastedNames.add(normalizedName);
        uniqueTeams.push(team);
      }
    }

    // Retrieve existing team names to prevent duplicate imports.
    const { data: existingTeams, error: existingError } = await supabase
      .from('teams')
      .select('name');

    if (existingError) {
      setError(existingError.message);
      return;
    }

    const existingNames = new Set(
      (existingTeams || []).map((team) => team.name.toLowerCase())
    );

    const teamsToImport = uniqueTeams.filter(
      (team) => !existingNames.has(team.name.toLowerCase())
    );

    const skippedCount = parsedTeams.length - teamsToImport.length;

    if (teamsToImport.length === 0) {
      setSuccess('All teams in this list already exist. Nothing was imported.');
      return;
    }

    setImporting(true);

    const { error: importError } = await supabase
      .from('teams')
      .insert(teamsToImport);

    if (importError) {
      setError(importError.message);
      setImporting(false);
      return;
    }

    setSuccess(
      `${teamsToImport.length} team(s) imported successfully. ${skippedCount} duplicate(s) skipped.`
    );

    await fetchTeams();
    setImporting(false);
  };

  // Delete a team after administrator confirmation.
  const handleDelete = async (team) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${team.name}?`
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');

    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', team.id);

    if (deleteError) {
      setError(
        `Unable to delete ${team.name}. It may already be used in a fixture. ${deleteError.message}`
      );
      return;
    }

    setSuccess(`${team.name} deleted successfully.`);
    await fetchTeams();
  };

  // Find teams that do not have a valid group assignment.
  const unassignedTeams = teams.filter(
    (team) => !GROUPS.includes(team.group_name)
  );

  return (
    <div className="teams-management">
      {/* Team management heading and actions. */}
      <div className="teams-toolbar">
        <div>
          <h2>Tournament Teams</h2>
          <p>Manage the teams participating in the tournament.</p>
        </div>

        <button
          className="add-team-button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus size={18} />
          Add New Team
        </button>
      </div>

      {/* Display feedback messages. */}
      {error && <div className="teams-alert error-alert">{error}</div>}

      {success && (
        <div className="teams-alert success-alert">{success}</div>
      )}

      {/* Bulk import section. */}
      <div className="team-form-card bulk-import-card">
        <div className="team-form-heading">
          <div>
            <h3>
              <Upload size={19} /> Bulk Import Teams
            </h3>
            <p>
              Paste your teams under their group headings. The system
              will organise and import them automatically.
            </p>
          </div>
        </div>

        <div className="team-form-field">
          <label htmlFor="bulkTeams">Team names and groups</label>
          <textarea
            id="bulkTeams"
            rows={17}
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={`GROUP A\nYOYO FC\nSILENT MOVES FC\n\nGROUP B\nPREDATORS FC`}
          />
        </div>

        <div className="team-form-actions">
          <span>
            <Users size={16} /> {parseBulkTeams(bulkText).length} team entries detected
          </span>

          <button
            type="button"
            className="save-team-button"
            onClick={handleBulkImport}
            disabled={importing || loading}
          >
            <Upload size={17} />
            {importing ? 'Importing...' : 'Import All Teams'}
          </button>
        </div>
      </div>

      {/* Create and edit team form. */}
      {showForm && (
        <div className="team-form-card">
          <div className="team-form-heading">
            <div>
              <h3>{editingTeam ? 'Edit Team' : 'Add New Team'}</h3>
              <p>Enter the team's information below.</p>
            </div>

            <button
              className="close-team-form"
              onClick={resetForm}
              aria-label="Close form"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="team-form-grid">
              <div className="team-form-field">
                <label htmlFor="teamName">Team Name *</label>
                <input
                  id="teamName"
                  type="text"
                  placeholder="e.g. Indigenous FC"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div className="team-form-field">
                <label htmlFor="teamGroup">Team Group *</label>
                <select
                  id="teamGroup"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  required
                >
                  {GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>

              <div className="team-form-field">
                <label htmlFor="teamLogo">Team Logo URL</label>
                <input
                  id="teamLogo"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                />
              </div>

              <div className="team-form-field full-width">
                <label htmlFor="teamDescription">Description</label>
                <textarea
                  id="teamDescription"
                  placeholder="Enter a short team description..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                />
              </div>

              <div className="team-form-field full-width">
                <label className="team-active-label">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                  />
                  Team is active
                </label>
              </div>
            </div>

            <div className="team-form-actions">
              <button
                type="button"
                className="cancel-team-button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-team-button"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingTeam
                    ? 'Save Changes'
                    : 'Add Team'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Registered teams arranged into four group cards. */}
      <div className="teams-list-card">
        <div className="teams-list-heading">
          <div>
            <h3>Registered Teams</h3>
            <p>
              {teams.length} team(s) registered across four groups
            </p>
          </div>

          <button
            className="refresh-teams-button"
            onClick={fetchTeams}
            disabled={loading}
            aria-label="Refresh teams"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        {loading ? (
          <div className="teams-empty-state">
            Loading tournament teams...
          </div>
        ) : teams.length === 0 ? (
          <div className="teams-empty-state">
            <Shield size={35} />
            <h4>No teams added yet</h4>
            <p>Import your groups or add your first team.</p>
          </div>
        ) : (
          <div className="team-groups-grid">
            {GROUPS.map((group) => {
              // Find and alphabetically sort teams in this group.
              const groupTeams = teams
                .filter((team) => team.group_name === group)
                .sort((a, b) => a.name.localeCompare(b.name));

              return (
                <div className="team-group-card" key={group}>
                  {/* Group heading and team count. */}
                  <div className="team-group-heading">
                    <div>
                      <h4>{group}</h4>
                      <span>{groupTeams.length} team(s)</span>
                    </div>

                    <Users size={21} />
                  </div>

                  {/* Teams belonging to this group. */}
                  <div className="team-group-list">
                    {groupTeams.length === 0 ? (
                      <p className="empty-group-message">
                        No teams assigned to this group.
                      </p>
                    ) : (
                      groupTeams.map((team) => (
                        <div className="group-team-item" key={team.id}>
                          <div className="group-team-info">
                            {team.logo_url ? (
                              <img
                                src={team.logo_url}
                                alt={`${team.name} logo`}
                                className="team-logo"
                              />
                            ) : (
                              <div className="team-logo-placeholder">
                                <Shield size={18} />
                              </div>
                            )}

                            <div className="group-team-details">
                              <strong>{team.name}</strong>
                              <span>
                                {team.description || 'No description'}
                              </span>

                              <span
                                className={`team-status ${
                                  team.is_active
                                    ? 'team-active'
                                    : 'team-inactive'
                                }`}
                              >
                                {team.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>

                          {/* Existing team edit and delete actions. */}
                          <div className="team-action-buttons">
                            <button
                              className="edit-team-button"
                              onClick={() => handleEdit(team)}
                              aria-label={`Edit ${team.name}`}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              className="delete-team-button"
                              onClick={() => handleDelete(team)}
                              aria-label={`Delete ${team.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Display teams without a valid group assignment. */}
            {unassignedTeams.length > 0 && (
              <div className="team-group-card unassigned-team-card">
                <div className="team-group-heading">
                  <div>
                    <h4>Unassigned Teams</h4>
                    <span>{unassignedTeams.length} team(s)</span>
                  </div>
                  <Users size={21} />
                </div>

                <div className="team-group-list">
                  {unassignedTeams.map((team) => (
                    <div className="group-team-item" key={team.id}>
                      <div className="group-team-info">
                        <div className="team-logo-placeholder">
                          <Shield size={18} />
                        </div>

                        <div className="group-team-details">
                          <strong>{team.name}</strong>
                          <span>Group not assigned</span>
                        </div>
                      </div>

                      <div className="team-action-buttons">
                        <button
                          className="edit-team-button"
                          onClick={() => handleEdit(team)}
                          aria-label={`Edit ${team.name}`}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="delete-team-button"
                          onClick={() => handleDelete(team)}
                          aria-label={`Delete ${team.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamsManagement;
