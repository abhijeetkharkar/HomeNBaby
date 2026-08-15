import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Chip,
  Checkbox,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import DeleteIcon from '@mui/icons-material/Delete';
import { format, differenceInDays } from 'date-fns';
import { useBabyLogs } from '../../hooks/useBabyLogs';
import { BabyLog } from '../../types/baby';

const BIRTH_DATE = new Date('2026-07-09T04:19:00');

export function DailyLogView() {
  const { logs, fetchLogs, addLog, updateLog, deleteLog } = useBabyLogs();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [openForm, setOpenForm] = useState<BabyLog['category'] | null>(null);
  const [editingLog, setEditingLog] = useState<BabyLog | null>(null);
  
  const [prevDayLogs, setPrevDayLogs] = useState<BabyLog[]>([]);
  
  // Form states
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [side, setSide] = useState<'L'|'R'|'Both'>('Both');
  const [latch, setLatch] = useState<'Good'|'Fair'|'Poor'>('Good');
  const [feedType, setFeedType] = useState<'breast'|'bottle'>('breast');
  const [bottleMl, setBottleMl] = useState('');
  
  const [diaperType, setDiaperType] = useState<'wet'|'dirty'|'both'>('wet');
  const [rash, setRash] = useState(false);
  
  const [sleepQuality, setSleepQuality] = useState<'Deep'|'Light'|'Fussy'>('Deep');
  
  const [notes, setNotes] = useState('');

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const dayNumber = differenceInDays(currentDate, BIRTH_DATE) + 1;

  useEffect(() => {
    fetchLogs(dateStr);
    
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = format(prevDate, 'yyyy-MM-dd');
    fetch(`${import.meta.env.VITE_API_URL || 'https://api.abhijeetkharkar.com'}/tracker/logs/${prevDateStr}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setPrevDayLogs(data))
      .catch(console.error);
  }, [dateStr, fetchLogs, currentDate]);

  const handleAdd = (cat: any, data: any) => {
    addLog({ ...data, category: cat });
  };

  const handleOpen = (cat: any, logToEditArg?: BabyLog) => {
    let logToEdit: any = logToEditArg;
    if (typeof cat === 'object') {
      logToEdit = cat;
      cat = logToEdit.category as any;
    }

    if (['vitaminD', 'massage', 'bath', 'tummyTime'].includes(cat) && !logToEdit) {
      handleAdd(cat, { date: dateStr, time: format(new Date(), 'HH:mm'), done: true });
      return;
    }
    
    if (logToEdit) {
      setEditingLog(logToEdit);
      setStartTime(logToEdit.startTime || logToEdit.time || '');
      setEndTime(logToEdit.endTime || '');
      setSide(logToEdit.side || 'Both');
      setLatch(logToEdit.latch || 'Good');
      setFeedType(logToEdit.feedType || 'breast');
      setBottleMl(logToEdit.bottleMl?.toString() || '');
      setDiaperType(logToEdit.type || 'wet');
      setRash(logToEdit.rash || false);
      setSleepQuality(logToEdit.quality || 'Deep');
      setNotes(logToEdit.notes || '');
    } else {
      setEditingLog(null);
      // Reset forms
      const nowStr = format(new Date(), 'HH:mm');
      setStartTime(nowStr);
      setEndTime(nowStr);
      
      setSide('Both');
      setLatch('Good');
      setFeedType('breast');
      setBottleMl('');
      setDiaperType('wet');
      setRash(false);
      setSleepQuality('Deep');
      setNotes('');
    }
    
    setOpenForm(cat);
  };

  const handleSave = () => {
    if (!openForm) return;
    
    const baseLog: any = editingLog ? { ...editingLog, notes } : { date: dateStr, category: openForm, notes };
    
    if (openForm === 'feed') {
      baseLog.feedType = feedType;
      if (feedType === 'bottle') {
        baseLog.time = startTime;
        baseLog.bottleMl = Number(bottleMl) || 0;
      } else {
        baseLog.startTime = startTime;
        baseLog.endTime = endTime;
        baseLog.side = side;
        baseLog.latch = latch;
        const start = new Date(`${dateStr}T${startTime}`);
        let end = new Date(`${dateStr}T${endTime}`);
        if (end <= start) end.setDate(end.getDate() + 1);
        baseLog.durationMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
      }
    } else if (openForm === 'diaper') {
      baseLog.time = startTime;
      baseLog.type = diaperType;
      baseLog.rash = rash;
    } else if (openForm === 'sleep') {
      baseLog.category = 'sleep';
      baseLog.startTime = startTime;
      baseLog.endTime = endTime;
      baseLog.quality = sleepQuality;
      const start = new Date(`${dateStr}T${startTime}`);
      let end = new Date(`${dateStr}T${endTime}`);
      if (end <= start) end.setDate(end.getDate() + 1); // overnight sleep
      baseLog.durationMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    } else {
        baseLog.time = startTime;
    }
    
    if (editingLog) {
      updateLog(dateStr, editingLog.logId, baseLog);
    } else {
      addLog(baseLog);
    }
    setOpenForm(null);
    setEditingLog(null);
  };
  
  const renderIcon = (cat: string) => {
    switch (cat) {
      case 'feed': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>🤱</span>;
      case 'diaper': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>🧷</span>;
      case 'sleep': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>😴</span>;
      case 'vitaminD': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>💊</span>;
      case 'massage': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>💆</span>;
      case 'bath': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>🛁</span>;
      case 'tummyTime': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>🐢</span>;
      case 'milestone': return <span style={{ fontSize: '1.5rem', lineHeight: 1, marginTop: '-4px' }}>🏆</span>;
      default: return <ChildCareIcon />;
    }
  };

  const getSortTime = (log: BabyLog & { _capped?: boolean }) => {
    const defaultTime = log.startTime || log.time || '00:00';
    // Day 1 of an overnight entry: sort by start time so it sits at its natural position
    if ((log as any)._capped) return defaultTime;
    // Ghost log (Day 2) and regular sleep/feed: sort by end time
    if ((log.category === 'sleep' || (log.category === 'feed' && log.feedType === 'breast')) && log.endTime) {
      const hasDiaperBetween = logs.some(l => 
        l.category === 'diaper' && 
        l.time && 
        l.time > defaultTime && 
        l.time < log.endTime!
      );
      return hasDiaperBetween ? defaultTime : log.endTime;
    }
    return defaultTime;
  };

  const getMinutes = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  // Combine and virtually split logs for the current day
  const virtuallySplitLogs = React.useMemo(() => {
    const splitLogs: BabyLog[] = [];

    // 1. Process previous day's logs (look for bleeding into today)
    prevDayLogs.forEach(log => {
      const startStr = log.startTime || log.time;
      const endStr = log.endTime;
      const crossesMidnight = startStr && endStr && endStr < startStr;

      if (crossesMidnight) {
        // Create a ghost log for the second part (today)
        const ghostLog = { ...log };
        ghostLog.logId = `${log.logId}_ghost_part2`;
        ghostLog.date = dateStr;
        ghostLog.startTime = '00:00';
        ghostLog.time = '00:00';
        // durationMin is strictly from 00:00 to endStr
        ghostLog.durationMin = getMinutes('00:00', endStr);
        splitLogs.push(ghostLog);
      }
    });

    // 2. Process today's logs (look for bleeding into tomorrow)
    logs.forEach(log => {
      if (log.category === 'milestone') return;
      const startStr = log.startTime || log.time;
      const endStr = log.endTime;
      const crossesMidnight = startStr && endStr && endStr < startStr;

      if (crossesMidnight) {
        // Cap this log's display to midnight; sort by its real start time on Day 1
        const cappedLog = { ...log, _capped: true } as BabyLog & { _capped: boolean };
        cappedLog.endTime = '23:59';
        cappedLog.durationMin = getMinutes(startStr!, '23:59') + 1;
        splitLogs.push(cappedLog);
      } else {
        splitLogs.push(log);
      }
    });

    // 3. Sort the combined logs
    return splitLogs.sort((a, b) => getSortTime(a).localeCompare(getSortTime(b)));
  }, [logs, prevDayLogs, dateStr]);

  const dailyStats = React.useMemo(() => {
    let feeds = 0;
    let feedDuration = 0;
    let wet = 0;
    let dirty = 0;
    let sleepMin = 0;
    let tummyTime = 0;

    virtuallySplitLogs.forEach(log => {
      if (log.category === 'feed') {
        if (!log.logId.includes('_ghost')) feeds++; 
        if (log.durationMin) feedDuration += log.durationMin;
      }
      if (log.category === 'diaper') {
        if (!log.logId.includes('_ghost')) {
          if (log.type === 'wet' || log.type === 'both') wet++;
          if (log.type === 'dirty' || log.type === 'both') dirty++;
        }
      }
      if (log.category === 'sleep') {
        sleepMin += (log.durationMin || 0);
      }
      if (log.category === 'tummyTime') {
        if (!log.logId.includes('_ghost')) tummyTime++;
      }
    });

    return { feeds, feedDuration: Math.round(feedDuration), wet, dirty, sleepHrs: (sleepMin / 60).toFixed(1), tummyTime };
  }, [virtuallySplitLogs]);

  const milestoneLog = React.useMemo(() => logs.find(l => l.category === 'milestone'), [logs]);

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 0;

    // Header Banner
    doc.setFillColor(46, 125, 143);
    doc.rect(0, 0, pageW, 22, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Snigdha - Daily Log`, 15, 14);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${dateStr}   |   Day ${dayNumber}`, pageW - 15, 14, { align: 'right' });
    
    y = 35;

    // Daily Summary
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Summary', 15, y);
    y += 7;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Feeds: ${dailyStats.feeds} (${dailyStats.feedDuration}m)   |   Diapers: ${dailyStats.wet}W ${dailyStats.dirty}D   |   Sleep: ${dailyStats.sleepHrs}h   |   Tummy Time: ${dailyStats.tummyTime}`, 15, y);
    
    y += 10;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageW - 15, y);
    y += 10;
    
    // Timeline Header
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Timeline', 15, y);
    y += 10;

    virtuallySplitLogs.forEach(log => {
      // Pagination check
      if (y > 275) { 
        doc.addPage(); 
        y = 20; 
      }

      const isGhost = log.logId.includes('_ghost');
      const isCapped = !!(log as any)._capped;
      const timeStr = log.startTime || log.time || '';
      const endStr = log.endTime ? ` to ${log.endTime}${isCapped ? ' (cont.)' : isGhost ? ' (cont.)' : ''}` : '';
      const catLabel = log.category === 'tummyTime' ? 'Tummy Time' : log.category === 'vitaminD' ? 'Vitamin D' : log.category;

      let detail = '';
      if (log.category === 'feed') {
        detail = log.feedType === 'bottle'
          ? `Bottle: ${log.bottleMl || '?'}ml`
          : `Breast: ${log.durationMin ?? '?'} min${log.side ? ` - ${log.side === 'L' ? 'Left' : log.side === 'R' ? 'Right' : 'Both'}` : ''}`;
      } else if (log.category === 'diaper') {
        detail = log.type === 'both' ? 'Wet & Dirty' : log.type === 'wet' ? 'Wet' : 'Dirty';
      } else if (log.category === 'sleep') {
        const d = log.durationMin;
        detail = `Quality: ${log.quality}${d ? ` (${d >= 60 ? Math.floor(d/60) + 'h ' : ''}${Math.round(d % 60)}m)` : ''}`;
      }
      if (log.notes) detail += ` - ${log.notes}`;

      const itemStartY = y - 4;

      // Title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`${timeStr}${endStr}   ${catLabel.toUpperCase()}`, 22, y);
      
      y += 5;
      
      // Detail
      if (detail) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(detail, 22, y);
        y += 4;
      }

      const itemEndY = y - 1;

      // Left Border Line
      if (isGhost || isCapped) {
        doc.setDrawColor(124, 107, 196); // secondary color
      } else {
        doc.setDrawColor(46, 125, 143); // primary color
      }
      doc.setLineWidth(1.5);
      doc.line(16, itemStartY, 16, itemEndY);

      y += 5; // space before next item
    });

    doc.save(`snigdha-log-${dateStr}.pdf`);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })} size="small">◀</IconButton>
          <TextField
            type="date"
            value={dateStr}
            onChange={e => setCurrentDate(new Date(e.target.value + 'T12:00:00'))}
            size="small"
            sx={{ width: 160 }}
            InputLabelProps={{ shrink: true }}
          />
          <IconButton onClick={() => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })} size="small">▶</IconButton>
        </Box>
        <Button 
          variant="outlined" 
          color="secondary" 
          onClick={exportPDF} 
          startIcon={<DownloadIcon />}
          sx={{ borderRadius: '16px', px: 2, py: 0.5, fontWeight: 'bold' }}
          title="Export PDF"
        >
          Day {dayNumber}
        </Button>
      </Box>

      {/* Quick Add Buttons */}
      <Grid container spacing={1.5} mb={4}>
        {[
          { id: 'feed', label: 'Feed', icon: '🤱' },
          { id: 'diaper', label: 'Diaper', icon: '🧷' },
          { id: 'sleep', label: 'Sleep', icon: '😴' },
          { id: 'vitaminD', label: 'Vit D', icon: '💊' },
          { id: 'massage', label: 'Massage', icon: '💆' },
          { id: 'bath', label: 'Bath', icon: '🛁' },
          { id: 'tummyTime', label: 'Tummy', icon: '🐢' },
          { id: 'milestone', label: 'Milestone', icon: '🏆' },
        ].map(btn => (
          <Grid item xs={3} sm={1.5} key={btn.id}>
            <Button
              fullWidth
              variant="contained"
              sx={{ 
                py: 2, display: 'flex', flexDirection: 'column', gap: 0.5, 
                bgcolor: '#f8e8ec', 
                color: '#d4788c', 
                '&:hover': { bgcolor: '#f0d8de' },
                px: 1,
                minWidth: 0,
                boxShadow: 'none'
              }}
              onClick={() => handleOpen(btn.id as any)}
            >
              <Typography variant="h6" sx={{ lineHeight: 1 }}>{btn.icon}</Typography>
              <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.65rem' }}>{btn.label}</Typography>
            </Button>
          </Grid>
        ))}
      </Grid>

      {milestoneLog && (
        <Card sx={{ 
          mb: 4, 
          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', 
          color: '#8b5a00', 
          borderRadius: 3, 
          boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)'
        }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '16px !important' }}>
            <Typography variant="h3" sx={{ m: 0, lineHeight: 1, filter: 'drop-shadow(0px 2px 4px rgba(139,90,0,0.2))' }}>🏆</Typography>
            <Box flex={1}>
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, color: '#a06a00', lineHeight: 1, display: 'block' }}>
                Milestone
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.25, color: '#5c3a00', lineHeight: 1.3 }}>
                {milestoneLog.notes}
              </Typography>
            </Box>
            <Box display="flex" flexDirection="column" gap={1}>
              <IconButton size="small" sx={{ color: '#8b5a00', bgcolor: 'rgba(255,255,255,0.4)', '&:hover': { bgcolor: 'rgba(255,255,255,0.6)' } }} onClick={() => handleOpen('milestone', milestoneLog)}>
                <span style={{ fontSize: '1rem' }}>✏️</span>
              </IconButton>
              <IconButton size="small" sx={{ color: '#8b5a00', bgcolor: 'rgba(255,255,255,0.4)', '&:hover': { bgcolor: 'rgba(255,255,255,0.6)' } }} onClick={() => deleteLog(milestoneLog.date, milestoneLog.logId)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Daily Stats */}
      <Typography variant="h6" mb={2} color="text.secondary">
        {dateStr === format(new Date(), 'yyyy-MM-dd') ? "Today's Stats" : "Day's Stats"}
      </Typography>
      <Box display="flex" gap={1} flexWrap="wrap" mb={4}>
        <Chip size="medium" icon={<span style={{ fontSize: '1rem', marginLeft: '6px' }}>🤱</span>} label={`${dailyStats.feeds} feeds (${dailyStats.feedDuration}m)`} sx={{ bgcolor: '#fce4ec', color: '#c2185b', fontWeight: 600, '& .MuiChip-icon': { ml: 0 } }} />
        <Chip size="medium" icon={<span style={{ fontSize: '1rem', marginLeft: '6px' }}>🧷</span>} label={`${dailyStats.wet}W ${dailyStats.dirty}D`} sx={{ bgcolor: '#fff8e1', color: '#f57f17', fontWeight: 600 }} />
        <Chip size="medium" icon={<span style={{ fontSize: '1rem', marginLeft: '6px' }}>😴</span>} label={`${dailyStats.sleepHrs}h sleep`} sx={{ bgcolor: '#ede7f6', color: '#512da8', fontWeight: 600 }} />
        <Chip size="medium" icon={<span style={{ fontSize: '1rem', marginLeft: '6px' }}>🐢</span>} label={`${dailyStats.tummyTime} Tummy`} sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} />
      </Box>

      <Typography variant="h6" mb={2} color="text.secondary">Timeline</Typography>
      <Box display="flex" flexDirection="column" gap={2}>
        {virtuallySplitLogs.map(log => {
          const isGhost = log.logId.includes('_ghost');
          const isCapped = !!(log as any)._capped;
          return (
          <Card key={log.logId} sx={{ borderLeft: '4px solid', borderLeftColor: isGhost ? '#7c6bc4' : isCapped ? '#7c6bc4' : 'primary.main', opacity: isGhost ? 0.85 : 1 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', '&:last-child': { pb: 2 } }}>
              <Box display="flex" alignItems="center" gap={2}>
                {renderIcon(log.category)}
                <Box>
                  <Typography variant="subtitle2" textTransform="capitalize">
                    {log.category === 'tummyTime' ? 'Tummy Time' : log.category === 'vitaminD' ? 'Vitamin D' : log.category} {log.startTime || log.time ? `- ${log.startTime || log.time}` : ''}
                    {(log.category === 'sleep' || (log.category === 'feed' && log.feedType === 'breast')) && log.endTime
                      ? ` to ${log.endTime}${isCapped ? ' →' : isGhost ? ' (cont.)' : ''}` : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {log.category === 'feed' && (log.feedType === 'bottle'
                      ? `Bottle • ${log.bottleMl || '?'}ml`
                      : `Breast • ${log.durationMin ?? '?'} min${log.side ? ` • ${log.side === 'L' ? 'Left' : log.side === 'R' ? 'Right' : 'Both'}` : ''}`)}
                    {log.category === 'diaper' && (log.type === 'both' ? 'Wet & Dirty' : log.type === 'wet' ? 'Wet' : 'Dirty')}
                    {log.category === 'sleep' && `Quality: ${log.quality}` + (log.durationMin ? ` (${log.durationMin >= 60 ? Math.floor(log.durationMin/60) + 'h ' : ''}${Math.round(log.durationMin % 60)}m)` : '')}
                    {log.category === 'vitaminD' && 'Administered'}
                    {log.category === 'massage' && 'Completed'}
                    {log.category === 'bath' && 'Completed'}
                    {log.category === 'tummyTime' && 'Completed'}
                    {log.notes && ` • ${log.notes}`}
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center">
                {!isGhost && (
                  <Box flexShrink={0}>
                    <IconButton size="small" onClick={() => handleOpen(log.category, log)}>
                      <span style={{ fontSize: '1.2rem' }}>✏️</span>
                    </IconButton>
                    <IconButton size="small" onClick={() => deleteLog(log.date, log.logId)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
          );
        })}
        {logs.length === 0 && (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No logs for this day yet.
          </Typography>
        )}
      </Box>

      {/* Dynamic Form Dialog */}
      <Dialog open={!!openForm} onClose={() => { setOpenForm(null); setEditingLog(null); }} fullWidth maxWidth="xs">
        <DialogTitle>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} textTransform="capitalize">
              {editingLog ? 'Edit' : 'Add'} {editingLog ? editingLog.category : openForm}
            </Typography>
            <Typography variant="caption" color={dateStr === format(new Date(), 'yyyy-MM-dd') ? 'text.secondary' : 'warning.main'} fontWeight={600}>
              📅 {dateStr === format(new Date(), 'yyyy-MM-dd') ? `Today, ${format(currentDate, 'MMM d')}` : format(currentDate, 'EEE, MMM d yyyy')}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {openForm === 'feed' && (
              <FormControl>
                <FormLabel>Feed Type</FormLabel>
                <RadioGroup row value={feedType} onChange={e => setFeedType(e.target.value as any)}>
                  <FormControlLabel value="breast" control={<Radio />} label="🤱 Breast" />
                  <FormControlLabel value="bottle" control={<Radio />} label="🍼 Bottle" />
                </RadioGroup>
              </FormControl>
            )}

            {(openForm !== null && openForm !== 'milestone' && !(openForm === 'feed' && feedType === 'bottle')) && (
              <TextField
                label={['sleep', 'feed'].includes(openForm as string) ? 'Start Time' : 'Time'}
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            )}

            {openForm === 'feed' && feedType === 'bottle' && (
              <>
                <TextField
                  label="Time"
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Amount (ml)"
                  type="number"
                  value={bottleMl}
                  onChange={e => setBottleMl(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: 0, step: 5 }}
                  fullWidth
                />
              </>
            )}
            
            {(openForm === 'feed' && feedType === 'breast' || openForm === 'sleep') && (
              <TextField
                label="End Time"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            )}

            {openForm === 'feed' && feedType === 'breast' && (
              <FormControl>
                <FormLabel>Side</FormLabel>
                <RadioGroup row value={side} onChange={e => setSide(e.target.value as any)}>
                  <FormControlLabel value="L" control={<Radio />} label="Left" />
                  <FormControlLabel value="R" control={<Radio />} label="Right" />
                  <FormControlLabel value="Both" control={<Radio />} label="Both" />
                </RadioGroup>
              </FormControl>
            )}

            {openForm === 'diaper' && (
              <>
                <FormControl>
                  <FormLabel>Type</FormLabel>
                  <RadioGroup row value={diaperType} onChange={e => setDiaperType(e.target.value as any)}>
                    <FormControlLabel value="wet" control={<Radio />} label="Wet" />
                    <FormControlLabel value="dirty" control={<Radio />} label="Dirty" />
                    <FormControlLabel value="both" control={<Radio />} label="Both" />
                  </RadioGroup>
                </FormControl>
                <FormControlLabel
                  control={<Checkbox checked={rash} onChange={e => setRash(e.target.checked)} />}
                  label="Rash noted?"
                />
              </>
            )}

            {openForm === 'sleep' && (
              <FormControl>
                <FormLabel>Quality</FormLabel>
                <RadioGroup row value={sleepQuality} onChange={e => setSleepQuality(e.target.value as any)}>
                  <FormControlLabel value="Deep" control={<Radio />} label="Deep" />
                  <FormControlLabel value="Light" control={<Radio />} label="Light" />
                  <FormControlLabel value="Fussy" control={<Radio />} label="Fussy" />
                </RadioGroup>
              </FormControl>
            )}
            
            <TextField
              label={openForm === 'milestone' ? 'Milestone Details' : 'Notes'}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenForm(null); setEditingLog(null); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
