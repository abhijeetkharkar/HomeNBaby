import { useState } from 'react';
import { Box, Typography, Chip, LinearProgress, Paper, Grid, Checkbox, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import YardIcon from '@mui/icons-material/Yard';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FilterListIcon from '@mui/icons-material/FilterList';
import type { Task, Owner } from '../../types';
import { OwnerChip } from '../tasks/OwnerChip';

interface Props {
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onToggleSubtask: (task: Task, si: number) => void;
  onToggleNestedItem: (task: Task, si: number, ii: number) => void;
  onSetTaskOwner: (task: Task, owner: Owner) => void;
  onSetSubtaskOwner: (task: Task, si: number, owner: Owner) => void;
  onSetNestedItemOwner: (task: Task, si: number, ii: number, owner: Owner) => void;
}

const MONTHS = ['April', 'May', 'June', 'July'] as const;

const MONTH_COLORS: Record<string, string> = {
  April: '#1565c0',
  May: '#2e7d32',
  June: '#e65100',
  July: '#880e4f',
};

const CATEGORY_COLORS: Record<string, string> = {
  Admin: '#1565c0',
  Garden: '#2e7d32',
  Baby: '#c2185b',
  Hospital: '#6a1b9a',
  Shopping: '#f57c00',
};

const MILESTONES = [
  { label: 'Move to 3BHK', date: new Date('2026-06-01T00:00:00'), color: '#e65100', emoji: '🏠' },
  { label: 'Baby Due', date: new Date('2026-07-13T00:00:00'), color: '#c2185b', emoji: '👶' },
] as const;

function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function isTaskOverdue(task: Task): boolean {
  if (!task.target_date || task.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.target_date + 'T00:00:00') < today;
}

function isTaskDueSoon(task: Task, days = 14): boolean {
  if (!task.target_date || task.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.target_date + 'T00:00:00');
  const diff = (due.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${mon} ${day}`;
}

function formatDateLabel(dateStr: string, completed?: number | null): { text: string; color: string; bgcolor: string } {
  if (!dateStr) return { text: '', color: '', bgcolor: '' };
  const text = formatDate(dateStr);
  if (isTaskOverdue({ target_date: dateStr, completed } as Task))
    return { text, color: '#d32f2f', bgcolor: '#ffebee' };
  if (isTaskDueSoon({ target_date: dateStr, completed } as Task, 7))
    return { text, color: '#e65100', bgcolor: '#fff3e0' };
  return { text, color: '#546e7a', bgcolor: '#f5f5f5' };
}

interface RowProps {
  task: Task;
  onToggleTask: (task: Task) => void;
  onSetTaskOwner: (task: Task, owner: Owner) => void;
}

function TimelineTaskRow({ task, onToggleTask, onSetTaskOwner }: RowProps) {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.done).length;
  const catColor = CATEGORY_COLORS[task.category] ?? '#666';
  const overdue = isTaskOverdue(task);
  const dueSoon = isTaskDueSoon(task, 7);

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={1}
      py={1}
      px={1.5}
      sx={{
        borderRadius: 1.5,
        bgcolor: task.completed
          ? 'rgba(0,0,0,0.03)'
          : overdue
          ? '#fff5f5'
          : dueSoon
          ? '#fffbf0'
          : 'background.paper',
        border: 1,
        borderColor: overdue ? 'error.light' : dueSoon ? 'warning.light' : 'divider',
        mb: 0.75,
        opacity: task.completed ? 0.65 : 1,
      }}
    >
      <Checkbox
        checked={!!task.completed}
        onChange={() => onToggleTask(task)}
        icon={<CheckCircleOutlineIcon />}
        checkedIcon={<CheckCircleIcon />}
        sx={{ color: catColor, '&.Mui-checked': { color: 'success.main' }, p: 0.5, flexShrink: 0 }}
        size="small"
      />
      {/* Category accent bar */}
      <Box sx={{ width: 3, height: 38, borderRadius: 1, bgcolor: catColor, flexShrink: 0 }} />

      <Box flex={1} minWidth={0}>
        {/* Top row: category chip + task name + badges */}
        <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
          <Chip
            label={task.category}
            size="small"
            sx={{
              bgcolor: catColor,
              color: 'white',
              fontSize: '0.62rem',
              height: 17,
              '& .MuiChip-label': { px: 0.75 },
              flexShrink: 0,
            }}
          />
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              flex: 1,
              textDecoration: task.completed ? 'line-through' : 'none',
              color: task.completed ? 'text.disabled' : 'text.primary',
              fontSize: '0.85rem',
            }}
          >
            {task.task}
          </Typography>
          <Box display="flex" gap={0.5} alignItems="center" flexShrink={0}>
            {overdue && (
              <Chip
                label="Overdue"
                size="small"
                color="error"
                sx={{ fontSize: '0.62rem', height: 17, '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
            {!overdue && dueSoon && (
              <Chip
                label="Soon"
                size="small"
                color="warning"
                sx={{ fontSize: '0.62rem', height: 17, '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
            {task.completed && (
              <Chip
                label="Done"
                size="small"
                color="success"
                sx={{ fontSize: '0.62rem', height: 17, '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
            {task.target_date && (
              <Chip
                label={formatDateLabel(task.target_date, task.completed).text}
                size="small"
                sx={{
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  height: 19,
                  bgcolor: formatDateLabel(task.target_date, task.completed).bgcolor,
                  color: formatDateLabel(task.target_date, task.completed).color,
                  border: 1,
                  borderColor: formatDateLabel(task.target_date, task.completed).color + '33',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
            <OwnerChip owner={task.owner} onChange={(owner) => onSetTaskOwner(task, owner)} />
          </Box>
        </Box>

        {/* Description (truncated) */}
        {task.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}
          >
            {task.description}
          </Typography>
        )}

        {/* Subtask progress */}
        {total > 0 && (
          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
            <LinearProgress
              variant="determinate"
              value={(done / total) * 100}
              sx={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: done === total ? 'success.main' : catColor },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
              {done}/{total} subtasks
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function TimetableView({ tasks, onToggleTask, onSetTaskOwner }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const CATEGORIES = [
    { value: 'All', label: 'All', icon: <FilterListIcon sx={{ fontSize: 16 }} /> },
    { value: 'Admin', label: 'Admin', icon: <AdminPanelSettingsIcon sx={{ fontSize: 16 }} /> },
    { value: 'Garden', label: 'Garden', icon: <YardIcon sx={{ fontSize: 16 }} /> },
    { value: 'Baby', label: 'Baby', icon: <ChildCareIcon sx={{ fontSize: 16 }} /> },
    { value: 'Hospital', label: 'Hospital', icon: <LocalHospitalIcon sx={{ fontSize: 16 }} /> },
    { value: 'Shopping', label: 'Shopping', icon: <ShoppingCartIcon sx={{ fontSize: 16 }} /> },
  ];

  const filteredTasks = categoryFilter === 'All'
    ? tasks
    : tasks.filter((t) => t.category === categoryFilter);

  const urgentTasks = filteredTasks.filter(
    (t) => !t.completed && (isTaskOverdue(t) || isTaskDueSoon(t, 14))
  );

  const tasksByMonth: Record<string, Task[]> = Object.fromEntries(MONTHS.map((m) => [m, []]));
  filteredTasks.forEach((task) => {
    if (task.target_month && tasksByMonth[task.target_month]) {
      tasksByMonth[task.target_month].push(task);
    }
  });
  Object.values(tasksByMonth).forEach((arr) =>
    arr.sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''))
  );

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.completed).length;
  const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Box>
      {/* Milestone countdowns */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {MILESTONES.map((m) => {
          const days = getDaysUntil(m.date);
          const isPast = days < 0;
          return (
            <Grid item xs={6} key={m.label}>
              <Paper
                elevation={2}
                sx={{ p: 2, textAlign: 'center', borderTop: 4, borderTopColor: m.color, borderRadius: 2 }}
              >
                <Typography fontSize={28} lineHeight={1}>{m.emoji}</Typography>
                <Typography variant="h3" fontWeight={800} color={m.color} lineHeight={1.1} mt={0.5}>
                  {isPast ? 0 : days}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {isPast ? 'days ago' : 'days to go'}
                </Typography>
                <Typography variant="body2" fontWeight={700} mt={0.75}>
                  {m.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {m.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Category filter */}
      <Paper elevation={1} sx={{ p: 1, mb: 2, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <FilterListIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mr: 0.5 }}>
            Filter:
          </Typography>
          <ToggleButtonGroup
            value={categoryFilter}
            exclusive
            onChange={(_, val) => { if (val !== null) setCategoryFilter(val); }}
            size="small"
            sx={{ flexWrap: 'wrap' }}
          >
            {CATEGORIES.map(({ value, label, icon }) => (
              <ToggleButton
                key={value}
                value={value}
                sx={{
                  px: 1.5,
                  py: 0.25,
                  fontSize: '0.72rem',
                  textTransform: 'none',
                  fontWeight: 600,
                  gap: 0.5,
                  borderColor: 'divider',
                  '&.Mui-selected': {
                    bgcolor: value === 'All' ? 'primary.main' : (CATEGORY_COLORS[value] ?? 'primary.main'),
                    color: 'white',
                    '&:hover': {
                      bgcolor: value === 'All' ? 'primary.dark' : (CATEGORY_COLORS[value] ?? 'primary.dark'),
                    },
                  },
                }}
              >
                {icon}
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Overall progress bar */}
      <Paper elevation={1} sx={{ p: 1.5, mb: 2.5, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Overall Progress
          </Typography>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                bgcolor: overallProgress === 100 ? 'success.main' : 'primary.main',
              },
            }}
          />
          <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {completedTasks}/{totalTasks} tasks
          </Typography>
        </Box>
      </Paper>

      {/* Needs Attention */}
      {urgentTasks.length > 0 && (
        <Box mb={2.5}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight={700} color="warning.dark">
              Needs Attention ({urgentTasks.length})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              — overdue or due within 14 days
            </Typography>
          </Box>
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fffdf5', borderColor: 'warning.light' }}>
            {urgentTasks.map((task) => (
              <TimelineTaskRow key={task.id} task={task} onToggleTask={onToggleTask} onSetTaskOwner={onSetTaskOwner} />
            ))}
          </Paper>
        </Box>
      )}

      {/* Month sections — cross-category, sorted by date */}
      {MONTHS.map((month) => {
        const monthTasks = tasksByMonth[month];
        if (!monthTasks.length) return null;
        const done = monthTasks.filter((t) => t.completed).length;
        const progress = (done / monthTasks.length) * 100;
        const color = MONTH_COLORS[month];

        return (
          <Box key={month} mb={3}>
            <Box
              display="flex"
              alignItems="center"
              gap={1.5}
              mb={1.5}
              p={1.5}
              sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: 1 }}
            >
              <CalendarMonthIcon sx={{ color, fontSize: 20 }} />
              <Typography variant="h6" fontWeight={700} color={color} sx={{ flex: 1 }}>
                {month} 2026
              </Typography>
              <Chip
                label={`${done}/${monthTasks.length}`}
                size="small"
                sx={{ bgcolor: color, color: 'white', fontSize: '0.7rem' }}
              />
              <Box width={80}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 5,
                    borderRadius: 3,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': { bgcolor: color },
                  }}
                />
              </Box>
            </Box>

            {monthTasks.map((task) => (
              <TimelineTaskRow key={task.id} task={task} onToggleTask={onToggleTask} onSetTaskOwner={onSetTaskOwner} />
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
