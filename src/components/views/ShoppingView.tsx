import {
  Box,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Chip,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Task, Owner } from '../../types';
import { OwnerChip } from '../tasks/OwnerChip';

interface Props {
  tasks: Task[];
  onToggleSubtask: (task: Task, si: number) => void;
  onToggleNestedItem: (task: Task, si: number, ii: number) => void;
  onSetSubtaskOwner: (task: Task, si: number, owner: Owner) => void;
  onSetNestedItemOwner: (task: Task, si: number, ii: number, owner: Owner) => void;
}

const SECTION_COLORS: Record<string, string> = {
  'Moving Supplies': '#1565c0',
  'Garden Supplies': '#2e7d32',
  'Nursery & Gear': '#c2185b',
  'Baby Essentials': '#e91e63',
  'Feeding': '#f57c00',
  'Diapering': '#7b1fa2',
  'Health & Hygiene': '#00838f',
  'Postpartum & Recovery': '#ad1457',
  'Hospital Bag': '#6a1b9a',
  'Home Safety': '#ef6c00',
  'Household Stock-Up': '#455a64',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${mon} ${day}`;
}

function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

function isDueSoon(dateStr: string, days = 7): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diff = (due.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function dateLabelStyle(dateStr: string): { color: string; bgcolor: string } {
  if (isOverdue(dateStr)) return { color: '#d32f2f', bgcolor: '#ffebee' };
  if (isDueSoon(dateStr)) return { color: '#e65100', bgcolor: '#fff3e0' };
  return { color: '#546e7a', bgcolor: '#f5f5f5' };
}

interface FlatItem {
  text: string;
  done: boolean;
  owner?: Owner;
  taskRef: Task;
  subtaskIndex: number;
  nestedIndex?: number;
  section: string;
  targetDate?: string;
}

interface SectionGroup {
  items: FlatItem[];
  targetDate: string;
}

function flattenShoppingItems(tasks: Task[]): Record<string, SectionGroup> {
  const groups: Record<string, SectionGroup> = {};

  // Sort tasks by target_date first
  const sorted = [...tasks].sort(
    (a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999')
  );

  sorted.forEach((task) => {
    const section = task.section;
    if (!groups[section]) {
      groups[section] = { items: [], targetDate: task.target_date ?? '' };
    }
    // Use the earliest target_date for the section
    if (task.target_date && task.target_date < groups[section].targetDate) {
      groups[section].targetDate = task.target_date;
    }

    task.subtasks.forEach((subtask, si) => {
      if (subtask.items && subtask.items.length > 0) {
        subtask.items.forEach((item, ii) => {
          groups[section].items.push({
            text: item.text,
            done: item.done,
            owner: item.owner,
            taskRef: task,
            subtaskIndex: si,
            nestedIndex: ii,
            section,
            targetDate: task.target_date,
          });
        });
      } else {
        groups[section].items.push({
          text: subtask.text,
          done: subtask.done,
          owner: subtask.owner,
          taskRef: task,
          subtaskIndex: si,
          section,
          targetDate: task.target_date,
        });
      }
    });
  });

  return groups;
}

export function ShoppingView({
  tasks,
  onToggleSubtask,
  onToggleNestedItem,
  onSetSubtaskOwner,
  onSetNestedItemOwner,
}: Props) {
  const groups = flattenShoppingItems(tasks);
  const allItems = Object.values(groups).flatMap((g) => g.items);
  const totalItems = allItems.length;
  const doneItems = allItems.filter((i) => i.done).length;
  const progress = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;

  // Sort sections by target_date
  const sortedSections = Object.entries(groups).sort(
    ([, a], [, b]) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999')
  );

  if (totalItems === 0) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="text.secondary">No shopping items found.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Summary */}
      <Paper
        elevation={2}
        sx={{ p: 2, mb: 2.5, borderRadius: 2, borderLeft: 4, borderLeftColor: '#f57c00' }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <ShoppingCartIcon sx={{ color: '#f57c00', fontSize: 22 }} />
          <Typography variant="subtitle1" fontWeight={700} color="#f57c00">
            Shopping Checklist
          </Typography>
          <Box flex={1} />
          {doneItems === totalItems ? (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
              label="All purchased!"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          ) : (
            <Chip
              label={`${totalItems - doneItems} remaining`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
        </Box>

        <Box display="flex" gap={3} mb={1.5} alignItems="flex-end">
          <Box textAlign="center">
            <Typography variant="h5" fontWeight={800} color="#f57c00" lineHeight={1}>
              {doneItems}/{totalItems}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Items
            </Typography>
          </Box>
          <Box flex={1} display="flex" flexDirection="column" justifyContent="center" minWidth={120}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" fontWeight={700} color="#f57c00">
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
                  bgcolor: progress === 100 ? 'success.main' : '#f57c00',
                },
              }}
            />
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary">
          {sortedSections.length} sections: {sortedSections.map(([s]) => s).join(' · ')}
        </Typography>
      </Paper>

      {/* Flat lists by section — sorted by due date */}
      {sortedSections.map(([section, { items, targetDate }]) => {
        const sectionDone = items.filter((i) => i.done).length;
        const allDone = sectionDone === items.length;
        const sectionColor = SECTION_COLORS[section] ?? '#666';
        const dateStyle = targetDate ? dateLabelStyle(targetDate) : null;

        return (
          <Paper
            key={section}
            variant="outlined"
            sx={{ mb: 2, borderRadius: 2, overflow: 'hidden' }}
          >
            {/* Section header */}
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              px={2}
              py={1}
              sx={{ bgcolor: allDone ? 'success.50' : 'grey.50', borderBottom: 1, borderColor: 'divider' }}
            >
              <Box sx={{ width: 4, height: 20, borderRadius: 1, bgcolor: sectionColor, flexShrink: 0 }} />
              <Typography
                variant="subtitle2"
                fontWeight={700}
                color={allDone ? 'success.main' : 'text.primary'}
                sx={{ flex: 1 }}
              >
                {section}
              </Typography>
              {targetDate && dateStyle && (
                <Chip
                  label={`Buy by ${formatDate(targetDate)}`}
                  size="small"
                  sx={{
                    fontSize: '0.64rem',
                    fontWeight: 600,
                    height: 19,
                    bgcolor: dateStyle.bgcolor,
                    color: dateStyle.color,
                    border: 1,
                    borderColor: dateStyle.color + '33',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
              <Chip
                label={`${sectionDone}/${items.length}`}
                size="small"
                color={allDone ? 'success' : 'default'}
                sx={{ fontSize: '0.68rem', height: 18 }}
              />
            </Box>

            {/* Items */}
            <Box px={1} py={0.5}>
              {items.map((item, idx) => (
                <Box
                  key={idx}
                  display="flex"
                  alignItems="flex-start"
                  gap={0.5}
                  sx={{
                    py: 0.25,
                    '&:not(:last-child)': { borderBottom: 1, borderColor: 'divider' },
                    opacity: item.done ? 0.6 : 1,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={item.done}
                        onChange={() => {
                          if (item.nestedIndex !== undefined) {
                            onToggleNestedItem(item.taskRef, item.subtaskIndex, item.nestedIndex);
                          } else {
                            onToggleSubtask(item.taskRef, item.subtaskIndex);
                          }
                        }}
                        size="small"
                        sx={{ py: 0.25 }}
                      />
                    }
                    label={
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.82rem',
                          color: item.done ? 'text.disabled' : 'text.primary',
                          textDecoration: item.done ? 'line-through' : 'none',
                        }}
                      >
                        {item.text}
                      </Typography>
                    }
                    sx={{ my: 0, flex: 1, alignItems: 'flex-start' }}
                  />
                  <Box sx={{ mt: 0.5, flexShrink: 0 }}>
                    <OwnerChip
                      owner={item.owner}
                      onChange={(owner) => {
                        if (item.nestedIndex !== undefined) {
                          onSetNestedItemOwner(item.taskRef, item.subtaskIndex, item.nestedIndex, owner);
                        } else {
                          onSetSubtaskOwner(item.taskRef, item.subtaskIndex, owner);
                        }
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
