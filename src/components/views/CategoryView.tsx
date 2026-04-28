import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  LinearProgress,
  Paper,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcon from '@mui/icons-material/Add';
import type { Task, Owner } from '../../types';
import { TaskCard } from '../tasks/TaskCard';

interface Props {
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onToggleSubtask: (task: Task, si: number) => void;
  onToggleNestedItem: (task: Task, si: number, ii: number) => void;
  onSetTaskOwner: (task: Task, owner: Owner) => void;
  onSetSubtaskOwner: (task: Task, si: number, owner: Owner) => void;
  onSetNestedItemOwner: (task: Task, si: number, ii: number, owner: Owner) => void;
  onAddTask: (defaultSection: string, defaultCategory: string) => void;
  onEditTask: (task: Task) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Admin: '#1565c0',
  Garden: '#2e7d32',
  Baby: '#c2185b',
  Hospital: '#6a1b9a',
};

/** Collect all due dates from a task's subtasks and nested items */
function getTaskDueDates(task: Task): string[] {
  const dates: string[] = [];
  if (task.target_date) dates.push(task.target_date);
  for (const s of task.subtasks) {
    if (s.due) dates.push(s.due);
    if (s.items) for (const it of s.items) { if (it.due) dates.push(it.due); }
  }
  return dates;
}

/** Earliest due date for a task (from subtasks/items or task-level) */
function getTaskEarliestDate(task: Task): string {
  const dates = getTaskDueDates(task);
  if (dates.length === 0) return '9999';
  dates.sort();
  return dates[0];
}

function getOverdueCount(tasks: Task[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tasks.filter((t) => {
    if (t.completed) return false;
    // Check task-level date
    if (t.target_date && new Date(t.target_date + 'T00:00:00') < today) return true;
    // Check any incomplete subtask/item with a past due date
    for (const s of t.subtasks) {
      if (!s.done && s.due && new Date(s.due + 'T00:00:00') < today) return true;
      if (s.items) {
        for (const it of s.items) {
          if (!it.done && it.due && new Date(it.due + 'T00:00:00') < today) return true;
        }
      }
    }
    return false;
  }).length;
}

function getSectionDateRange(tasks: Task[]): { earliest: string; latest: string } {
  const allDates = tasks.flatMap(getTaskDueDates);
  if (allDates.length === 0) return { earliest: '', latest: '' };
  allDates.sort();
  return { earliest: allDates[0], latest: allDates[allDates.length - 1] };
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${mon} ${day}`;
}

export function CategoryView({ tasks, onToggleTask, onToggleSubtask, onToggleNestedItem, onSetTaskOwner, onSetSubtaskOwner, onSetNestedItemOwner, onAddTask, onEditTask }: Props) {
  const sections: Record<string, Task[]> = {};
  tasks.forEach((task) => {
    if (!sections[task.section]) sections[task.section] = [];
    sections[task.section].push(task);
  });

  // Sort sections by earliest target_date
  const sortedSectionEntries = Object.entries(sections).sort(([, a], [, b]) => {
    const aDate = getSectionDateRange(a).earliest || '9999';
    const bDate = getSectionDateRange(b).earliest || '9999';
    return aDate.localeCompare(bDate);
  });

  if (sortedSectionEntries.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="text.secondary">No tasks in this category.</Typography>
      </Box>
    );
  }

  const category = tasks[0]?.category ?? '';
  const accentColor = CATEGORY_COLORS[category] ?? '#2e7d8f';

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const overdueTasks = getOverdueCount(tasks);
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalSubtasks = tasks.reduce((sum, t) => sum + t.subtasks.length, 0);
  const completedSubtasks = tasks.reduce(
    (sum, t) => sum + t.subtasks.filter((s) => s.done).length,
    0
  );

  return (
    <Box>
      {/* Category summary */}
      <Paper
        elevation={2}
        sx={{ p: 2, mb: 2.5, borderRadius: 2, borderLeft: 4, borderLeftColor: accentColor }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <Typography variant="subtitle1" fontWeight={700} color={accentColor}>
            {category} Overview
          </Typography>
          <Box flex={1} />
          {overdueTasks > 0 ? (
            <Chip
              icon={<ErrorOutlineIcon sx={{ fontSize: '14px !important' }} />}
              label={`${overdueTasks} overdue`}
              size="small"
              color="error"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          ) : completedTasks > 0 ? (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
              label="On track"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          ) : null}
        </Box>

        <Box display="flex" gap={3} mb={1.5} flexWrap="wrap" alignItems="flex-end">
          <Box textAlign="center">
            <Typography variant="h5" fontWeight={800} color={accentColor} lineHeight={1}>
              {completedTasks}/{totalTasks}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tasks
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography
              variant="h5"
              fontWeight={800}
              lineHeight={1}
              color={
                completedSubtasks === totalSubtasks && totalSubtasks > 0
                  ? 'success.main'
                  : 'text.primary'
              }
            >
              {completedSubtasks}/{totalSubtasks}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Subtasks
            </Typography>
          </Box>
          <Box textAlign="center">
            <Typography
              variant="h5"
              fontWeight={800}
              lineHeight={1}
              color={overdueTasks > 0 ? 'error.main' : 'text.primary'}
            >
              {overdueTasks}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Overdue
            </Typography>
          </Box>
          <Box flex={1} display="flex" flexDirection="column" justifyContent="center" minWidth={120}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                Completion
              </Typography>
              <Typography variant="caption" fontWeight={700} color={accentColor}>
                {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  bgcolor: progress === 100 ? 'success.main' : accentColor,
                },
              }}
            />
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary">
          {sortedSectionEntries.length} sections: {sortedSectionEntries.map(([s]) => s).join(' · ')}
        </Typography>
      </Paper>

      {/* Sections */}
      {sortedSectionEntries.map(([section, sectionTasks]) => {
        // Sort by target_date ascending within each section
        const sorted = [...sectionTasks].sort(
          (a, b) => getTaskEarliestDate(a).localeCompare(getTaskEarliestDate(b))
        );
        const doneTasks = sorted.filter((t) => t.completed).length;
        const allDone = doneTasks === sorted.length;
        const sectionOverdue = getOverdueCount(sorted);
        const { earliest, latest } = getSectionDateRange(sorted);
        const dateLabel = earliest
          ? earliest === latest
            ? formatDateShort(earliest)
            : `${formatDateShort(earliest)} – ${formatDateShort(latest)}`
          : '';
        return (
          <Accordion key={section} defaultExpanded elevation={1} sx={{ mb: 1.5 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1.5} width="100%" mr={1}>
                <Typography
                  variant="overline"
                  fontWeight={700}
                  color={allDone ? 'success.main' : 'text.secondary'}
                  letterSpacing={1.2}
                  lineHeight={1}
                >
                  {section}
                </Typography>
                <Box flex={1} />
                {dateLabel && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.66rem',
                      fontWeight: 500,
                      color: 'text.secondary',
                      bgcolor: '#f5f5f5',
                      px: 0.75,
                      py: 0.15,
                      borderRadius: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {dateLabel}
                  </Typography>
                )}
                {sectionOverdue > 0 && (
                  <Chip
                    label={`${sectionOverdue} overdue`}
                    size="small"
                    color="error"
                    sx={{ fontSize: '0.62rem', height: 17, '& .MuiChip-label': { px: 0.75 } }}
                  />
                )}
                <Chip
                  label={`${doneTasks}/${sorted.length}`}
                  size="small"
                  color={allDone ? 'success' : 'default'}
                  sx={{ fontSize: '0.68rem', height: 18 }}
                />
                <Button
                  size="small"
                  startIcon={<AddIcon sx={{ fontSize: '13px !important' }} />}
                  onClick={(e) => { e.stopPropagation(); onAddTask(section, category); }}
                  sx={{ fontSize: '0.68rem', height: 22, px: 1, minWidth: 0, textTransform: 'none' }}
                >
                  Add Task
                </Button>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0.5 }}>
              {sorted.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleTask={onToggleTask}
                  onToggleSubtask={onToggleSubtask}
                  onToggleNestedItem={onToggleNestedItem}
                  onSetTaskOwner={onSetTaskOwner}
                  onSetSubtaskOwner={onSetSubtaskOwner}
                  onSetNestedItemOwner={onSetNestedItemOwner}
                  onEditTask={onEditTask}
                />
              ))}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
