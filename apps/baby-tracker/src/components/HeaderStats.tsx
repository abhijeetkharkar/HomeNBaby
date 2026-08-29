import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { format } from 'date-fns';
import { BabyLog } from '../types/baby';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.abhijeetkharkar.com';

const getAuthHeaders = async () => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (err) {
    return {};
  }
};

export function HeaderStats() {
  const [logs, setLogs] = useState<BabyLog[]>([]);

  useEffect(() => {
    const fetchRecentLogs = async () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

      try {
        const headers = await getAuthHeaders();
        const [resToday, resYesterday] = await Promise.all([
          fetch(`${API_BASE}/tracker/logs/${todayStr}`, { headers }),
          fetch(`${API_BASE}/tracker/logs/${yesterdayStr}`, { headers })
        ]);
        
        const todayLogs = resToday.ok ? await resToday.json() : [];
        const yesterdayLogs = resYesterday.ok ? await resYesterday.json() : [];
        
        setLogs([...yesterdayLogs, ...todayLogs]);
      } catch (err) {
        console.error('Failed to fetch recent logs', err);
      }
    };

    fetchRecentLogs();
    
    // Refresh every 5 minutes just in case
    const interval = setInterval(fetchRecentLogs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const stats = React.useMemo(() => {
    let feeds = 0;
    let wet = 0;
    let dirty = 0;
    let sleepMin = 0;
    let tummyTime = 0;

    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    logs.forEach(log => {
      const logTime = log.startTime || log.time || '00:00';
      const logStart = new Date(`${log.date}T${logTime}`);
      
      if (logStart >= windowStart && logStart <= now) {
        if (log.category === 'feed') feeds++;
        if (log.category === 'diaper') {
          if (log.type === 'wet' || log.type === 'both') wet++;
          if (log.type === 'dirty' || log.type === 'both') dirty++;
        }
        if (log.category === 'sleep') {
          sleepMin += (log.durationMin || 0);
        }
        if (log.category === 'tummyTime') tummyTime++;
      }
    });

    return { feeds, wet, dirty, sleepHrs: (sleepMin / 60).toFixed(1), tummyTime };
  }, [logs]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: { xs: 1.5, sm: 2 }, 
        bgcolor: 'rgba(255, 255, 255, 0.15)', 
        px: 2, 
        py: 0.75, 
        borderRadius: 2,
        backdropFilter: 'blur(4px)'
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5, display: { xs: 'none', sm: 'block' } }}>
        Last 24h
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9, display: { xs: 'block', sm: 'none' } }}>
        24h:
      </Typography>
      <Box display="flex" alignItems="center" gap={0.5}>
        <span style={{ fontSize: '1rem' }}>🤱</span>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{stats.feeds}</Typography>
      </Box>
      <Box display="flex" alignItems="center" gap={0.5}>
        <span style={{ fontSize: '1rem' }}>🧷</span>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{stats.wet}W {stats.dirty}D</Typography>
      </Box>
      <Box display="flex" alignItems="center" gap={0.5}>
        <span style={{ fontSize: '1rem' }}>😴</span>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{stats.sleepHrs}h</Typography>
      </Box>
      <Box display="flex" alignItems="center" gap={0.5}>
        <span style={{ fontSize: '1rem' }}>🐢</span>
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{stats.tummyTime}</Typography>
      </Box>
    </Box>
  );
}
