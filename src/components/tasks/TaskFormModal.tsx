import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  IconButton,
  Divider,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { Task, Owner } from '../../types';

const CATEGORIES = ['Admin', 'Garden', 'Baby', 'Hospital'] as const;

const OWNERS: { label: string; value: Owner }[] = [
  { label: 'Not Assigned', value: null },
  { label: 'Abhijeet', value: 'Abhijeet' },
  { label: 'Prajakta', value: 'Prajakta' },
];

interface ItemForm {
  text: string;
  due: string;
  owner: Owner;
  done: boolean;
  items?: { text: string; done: boolean; due?: string; owner?: Owner }[];
}

export interface TaskFormData {
  task: string;
  category: string;
  section: string;
  target_date: string;
  owner: Owner;
  description: string;
  subtasks: ItemForm[];
}

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  task?: Task;
  defaultCategory?: string;
  defaultSection?: string;
  existingSections: string[];
  onClose: () => void;
  onSave: (data: TaskFormData) => Promise<void>;
}

const emptyItem = (): ItemForm => ({ text: '', due: '', owner: null, done: false });

export function TaskFormModal({
  open,
  mode,
  task,
  defaultCategory,
  defaultSection,
  existingSections,
  onClose,
  onSave,
}: Props) {
  const [taskName, setTaskName] = useState('');
  const [category, setCategory] = useState<string>(defaultCategory ?? 'Admin');
  const [section, setSection] = useState(defaultSection ?? '');
  const [targetDate, setTargetDate] = useState('');
  const [owner, setOwner] = useState<Owner>(null);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && task) {
      setTaskName(task.task);
      setCategory(task.category);
      setSection(task.section);
      setTargetDate(task.target_date ?? '');
      setOwner(task.owner ?? null);
      setItems(
        task.subtasks.map((s) => ({
          text: s.text,
          due: s.due ?? '',
          owner: s.owner ?? null,
          done: s.done,
          items: s.items,
        }))
      );
    } else {
      setTaskName('');
      setCategory(defaultCategory ?? 'Admin');
      setSection(defaultSection ?? '');
      setTargetDate('');
      setOwner(null);
      setItems([]);
    }
    setSaving(false);
  }, [open, mode, task, defaultCategory, defaultSection]);

  const handleSave = async () => {
    if (!taskName.trim() || !section.trim()) return;
    setSaving(true);
    try {
      await onSave({
        task: taskName.trim(),
        category,
        section: section.trim(),
        target_date: targetDate,
        owner,
        description: task?.description ?? '',
        subtasks: items
          .filter((i) => i.text.trim())
          .map((i) => ({
            text: i.text.trim(),
            due: i.due || undefined,
            owner: owner ?? i.owner,
            done: i.done,
            items: i.items,
          })) as ItemForm[],
      });
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ItemForm, value: string | Owner) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const isValid = taskName.trim().length > 0 && section.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {mode === 'add' ? 'Add Task' : 'Edit Task'}
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {/* Task name */}
        <TextField
          label="Task Name"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          required
          fullWidth
          autoFocus
          size="small"
        />

        {/* Type + Section */}
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={category}
              label="Type"
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            freeSolo
            options={existingSections}
            value={section}
            onInputChange={(_, v) => setSection(v)}
            size="small"
            sx={{ flex: 1 }}
            renderInput={(params) => (
              <TextField {...params} label="Section" required />
            )}
          />
        </Box>

        {/* Date + Assignee */}
        <Box display="flex" gap={2}>
          <TextField
            label="Target Date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1 }}
          />
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Assignee</InputLabel>
            <Select
              value={owner ?? ''}
              label="Assignee"
              onChange={(e) => setOwner((e.target.value || null) as Owner)}
            >
              {OWNERS.map((o) => (
                <MenuItem key={o.label} value={o.value ?? ''}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider />

        {/* Items */}
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
              Items
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
              Add Item
            </Button>
          </Box>

          {items.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              No items yet — click "Add Item" to get started.
            </Typography>
          )}

          {items.map((item, idx) => (
            <Box
              key={idx}
              display="flex"
              gap={1}
              alignItems="flex-start"
              mb={1.5}
              pl={1.5}
              borderLeft={2}
              borderColor="divider"
            >
              <Box flex={1} display="flex" flexDirection="column" gap={1}>
                <TextField
                  label="Details"
                  value={item.text}
                  onChange={(e) => updateItem(idx, 'text', e.target.value)}
                  size="small"
                  fullWidth
                  placeholder={`Item ${idx + 1}`}
                />
                <Box display="flex" gap={1}>
                  <TextField
                    label="Target Date"
                    type="date"
                    value={item.due}
                    onChange={(e) => updateItem(idx, 'due', e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                  {/* Hide assignee on items if task-level assignee is set */}
                  {!owner && (
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Assignee</InputLabel>
                      <Select
                        value={item.owner ?? ''}
                        label="Assignee"
                        onChange={(e) =>
                          updateItem(idx, 'owner', (e.target.value || null) as Owner)
                        }
                      >
                        {OWNERS.map((o) => (
                          <MenuItem key={o.label} value={o.value ?? ''}>{o.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => removeItem(idx)}
                sx={{ mt: 0.5, color: 'text.secondary' }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isValid || saving}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
        >
          {mode === 'add' ? 'Create' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
