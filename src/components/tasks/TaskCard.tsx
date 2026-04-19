import { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Checkbox,
  LinearProgress,
  Chip,
  Collapse,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Task, Owner } from '../../types';
import { SubtaskRow } from './SubtaskRow';
import { OwnerChip } from './OwnerChip';

interface Props {
  task: Task;
  onToggleTask: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskIndex: number) => void;
  onToggleNestedItem: (task: Task, subtaskIndex: number, itemIndex: number) => void;
  onSetTaskOwner: (task: Task, owner: Owner) => void;
  onSetSubtaskOwner: (task: Task, subtaskIndex: number, owner: Owner) => void;
  onSetNestedItemOwner: (task: Task, subtaskIndex: number, itemIndex: number, owner: Owner) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Admin: '#1565c0',
  Garden: '#2e7d32',
  Baby: '#c2185b',
  Hospital: '#6a1b9a',
};

function isOverdue(dateStr: string, completed?: number | null): boolean {
  if (!dateStr || completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

function isDueSoon(dateStr: string, completed?: number | null, days = 7): boolean {
  if (!dateStr || completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
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
  if (isOverdue(dateStr, completed))
    return { text, color: '#d32f2f', bgcolor: '#ffebee' };
  if (isDueSoon(dateStr, completed))
    return { text, color: '#e65100', bgcolor: '#fff3e0' };
  return { text, color: '#546e7a', bgcolor: '#f5f5f5' };
}

export function TaskCard({ task, onToggleTask, onToggleSubtask, onToggleNestedItem, onSetTaskOwner, onSetSubtaskOwner, onSetNestedItemOwner }: Props) {
  const [expanded, setExpanded] = useState(true);

  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.done).length;
  const progress = total > 0 ? (done / total) * 100 : 0;
  const accentColor = CATEGORY_COLORS[task.category] ?? '#2e7d8f';

  // Derive date from subtask/item due dates (fallback to task.target_date)
  const allDueDates: string[] = [];
  if (task.target_date) allDueDates.push(task.target_date);
  task.subtasks.forEach((s) => {
    if (s.due) allDueDates.push(s.due);
    s.items?.forEach((it) => { if (it.due) allDueDates.push(it.due); });
  });
  allDueDates.sort();
  const derivedDate = allDueDates.length > 0 ? allDueDates[0] : null;

  // Dynamic summary: remaining (not-done) subtask names
  const remaining = task.subtasks.filter((s) => !s.done).map((s) => s.text);
  const summaryText = remaining.length > 0
    ? `Remaining: ${remaining.slice(0, 3).join(', ')}${remaining.length > 3 ? ` +${remaining.length - 3} more` : ''}`
    : task.completed ? '' : 'All subtasks done!';

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 1.5,
        borderLeft: 4,
        borderLeftColor: task.completed ? 'success.main' : accentColor,
        opacity: task.completed ? 0.72 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <CardContent sx={{ pb: '12px !important', pt: 1.5 }}>
        {/* Task header row */}
        <Box display="flex" alignItems="flex-start" gap={0.5}>
          <Checkbox
            checked={!!task.completed}
            onChange={() => onToggleTask(task)}
            icon={<CheckCircleOutlineIcon />}
            checkedIcon={<CheckCircleIcon />}
            sx={{ color: accentColor, '&.Mui-checked': { color: 'success.main' }, mt: -0.25, ml: -0.5 }}
          />
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="flex-start" gap={1} flexWrap="wrap">
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{
                  flex: 1,
                  textDecoration: task.completed ? 'line-through' : 'none',
                  color: task.completed ? 'text.disabled' : 'text.primary',
                  lineHeight: 1.3,
                }}
              >
                {task.task}
              </Typography>
              {derivedDate && (
                <Chip
                  label={formatDateLabel(derivedDate, task.completed).text}
                  size="small"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    height: 22,
                    bgcolor: formatDateLabel(derivedDate, task.completed).bgcolor,
                    color: formatDateLabel(derivedDate, task.completed).color,
                    border: 1,
                    borderColor: formatDateLabel(derivedDate, task.completed).color + '33',
                    flexShrink: 0,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              )}
              {task.completed ? (
                <Chip label="Done" size="small" color="success" sx={{ fontSize: '0.68rem', height: 20 }} />
              ) : null}
              <OwnerChip owner={task.owner} onChange={(owner) => onSetTaskOwner(task, owner)} />
            </Box>

            {summaryText && total > 0 && (
              <Typography variant="caption" color="text.secondary" display="block" mt={0.25} lineHeight={1.4}>
                {summaryText}
              </Typography>
            )}

            {/* Progress bar */}
            {total > 0 && (
              <Box display="flex" alignItems="center" gap={1} mt={0.75}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: progress === 100 ? 'success.main' : accentColor,
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                  {done}/{total}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setExpanded((v) => !v)}
                  sx={{
                    p: 0.25,
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <ExpandMoreIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            )}
          </Box>
        </Box>

        {/* Subtasks */}
        {total > 0 && (
          <Collapse in={expanded}>
            <Box mt={1} pt={1} borderTop={1} borderColor="divider">
              {task.subtasks.map((subtask, si) => (
                <SubtaskRow
                  key={si}
                  subtask={subtask}
                  onToggle={() => onToggleSubtask(task, si)}
                  onToggleItem={(ii) => onToggleNestedItem(task, si, ii)}
                  onSetOwner={(owner) => onSetSubtaskOwner(task, si, owner)}
                  onSetItemOwner={(ii, owner) => onSetNestedItemOwner(task, si, ii, owner)}
                />
              ))}
            </Box>
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
}
