
import { useEffect, useState } from 'react';

import { supabase } from '../services/supabase';
import { AuthContext } from './AuthContextValue';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let currentUserId = null;

    // Retrieve the user's profile from Supabase.
    const loadProfile = async (userId) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role')
        .eq('id', userId)
        .single();

      if (!mounted || currentUserId !== userId) return;

      if (error) {
        console.error('Unable to load user profile:', error.message);
        setProfile(null);
      } else {
        setProfile(data);
      }

      setLoading(false);
    };

    // Listen for login, logout and session changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;

      currentUserId = currentUser?.id ?? null;

      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Defer the profile request until the auth callback finishes.
      setLoading(true);
      setTimeout(() => {
        loadProfile(currentUser.id);
      }, 0);
    });

    // Check whether a user already has an active session.
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error('Unable to retrieve session:', error.message);
      }

      const currentUser = data.session?.user ?? null;

      // Avoid overwriting a newer authentication event.
      if (currentUserId === null && currentUser) {
        currentUserId = currentUser.id;
        setUser(currentUser);
        await loadProfile(currentUser.id);
      } else if (!currentUser && currentUserId === null) {
        setLoading(false);
      }
    };

    checkSession();

    // Clean up the authentication listener on unmount.
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Determine whether the signed-in user is an administrator.
  const isAdmin = profile?.role === 'admin';

  // Sign out the current user.
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}   