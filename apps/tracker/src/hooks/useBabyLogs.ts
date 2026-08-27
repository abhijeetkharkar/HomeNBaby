import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BabyLog, DailySummary } from '../types/baby';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.abhijeetkharkar.com';

interface UseBabyLogsReturn {
  logs: BabyLog[];
  summary: DailySummary | null;
  loading: boolean;
  error: string | null;
  fetchLogs: (date: string) => Promise<void>;
  fetchSummary: (from: string, to: string) => Promise<DailySummary[]>;
  addLog: (log: Omit<BabyLog, 'logId'>) => Promise<void>;
  updateLog: (date: string, logId: string, updatedData: any) => Promise<void>;
  deleteLog: (date: string, logId: string) => Promise<void>;
}

const getAuthHeaders = async () => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (err) {
    return {};
  }
};

export function useBabyLogs(): UseBabyLogsReturn {
  const [logs, setLogs] = useState<BabyLog[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/tracker/logs/${date}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/tracker/summary?from=${from}&to=${to}`, { headers });
      if (!response.ok) throw new Error('Failed to fetch summary');
      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const addLog = useCallback(async (log: Omit<BabyLog, 'logId'>) => {
    setError(null);
    const newLog = { ...log, logId: uuidv4() };
    
    // Optimistic update
    setLogs((prev) => [...prev, newLog as BabyLog]);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/tracker/logs`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog),
      });
      if (!response.ok) {
        throw new Error('Failed to add log');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while adding');
      // Rollback
      setLogs((prev) => prev.filter(l => l.logId !== newLog.logId));
    }
  }, []);

  const updateLog = useCallback(async (date: string, logId: string, updatedData: any) => {
    setError(null);
    
    // Optimistic update
    setLogs((prev) => prev.map(log => log.logId === logId ? { ...log, ...updatedData } : log));

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/tracker/logs/${date}/${encodeURIComponent(logId)}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) {
        throw new Error('Failed to update log');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating');
      // On failure, reload logs
      fetchLogs(date);
    }
  }, [fetchLogs]);

  const deleteLog = useCallback(async (date: string, logId: string) => {
    setError(null);
    
    // Optimistic update
    setLogs((prev) => prev.filter(l => l.logId !== logId));

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/tracker/logs/${date}/${encodeURIComponent(logId)}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to delete log');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting');
      fetchLogs(date);
    }
  }, [fetchLogs]);

  return {
    logs,
    summary,
    loading,
    error,
    fetchLogs,
    fetchSummary,
    addLog,
    updateLog,
    deleteLog,
  };
}
