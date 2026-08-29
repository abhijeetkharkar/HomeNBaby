import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.abhijeetkharkar.com';

export interface BabyProfile {
  babyId: string;
  name: string;
  gender: 'boy' | 'girl';
  dob?: string;
  parents: string[];
}

interface BabyProfileContextType {
  profile: BabyProfile | null;
  loading: boolean;
  createProfile: (name: string, gender: 'boy' | 'girl', dob: string) => Promise<void>;
  inviteParent: (email: string) => Promise<void>;
  getToken: () => Promise<string | undefined>;
  fetchProfile: () => Promise<void>;
}

const BabyProfileContext = createContext<BabyProfileContextType | undefined>(undefined);

export function BabyProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<BabyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch (err) {
      console.error('Error fetching token', err);
      return undefined;
    }
  };

  const fetchProfile = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No token');
      
      const res = await fetch(`${API_BASE}/tracker/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 404) {
        setProfile(null);
      } else if (res.ok) {
        const data = await res.json();
        setProfile(data.baby);
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (name: string, gender: 'boy' | 'girl', dob: string) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/tracker/profile`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ name, gender, dob })
    });
    if (res.ok) {
      const data = await res.json();
      setProfile(data.baby);
    } else {
      throw new Error('Failed to create profile');
    }
  };

  const inviteParent = async (email: string) => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/tracker/profile/invite`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ inviteEmail: email })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to invite parent');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <BabyProfileContext.Provider value={{ profile, loading, createProfile, inviteParent, getToken, fetchProfile }}>
      {children}
    </BabyProfileContext.Provider>
  );
}

export function useBabyProfile() {
  const context = useContext(BabyProfileContext);
  if (context === undefined) {
    throw new Error('useBabyProfile must be used within a BabyProfileProvider');
  }
  return context;
}
