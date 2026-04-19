import { useState } from 'react';
import { Box, Checkbox, FormControlLabel, Typography, Collapse } from '@mui/material';
import type { Subtask, Owner } from '../../types';
import { NestedItemRow } from './NestedItemRow';
import { OwnerChip } from './OwnerChip';
import { DateBadge } from './DateBadge';

interface Props {
  subtask: Subtask;
  onToggle: () => void;
  onToggleItem: (itemIndex: number) => void;
  onSetOwner: (owner: Owner) => void;
  onSetItemOwner: (itemIndex: number, owner: Owner) => void;
}

export function SubtaskRow({ subtask, onToggle, onToggleItem, onSetOwner, onSetItemOwner }: Props) {
  const [expanded, setExpanded] = useState(true);
  const hasItems = !!subtask.items?.length;

  return (
    <Box sx={{ pl: 1 }}>
      <Box display="flex" alignItems="flex-start" gap={0.5}>
        <FormControlLabel
          control={
            <Checkbox
              checked={subtask.done}
              onChange={onToggle}
              size="small"
              sx={{ py: 0.5 }}
            />
          }
          label={
            <Box
              component="span"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
              onClick={(e) => {
                if (hasItems) {
                  e.preventDefault();
                  setExpanded((v) => !v);
                }
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: subtask.done ? 'text.disabled' : 'text.primary',
                  textDecoration: subtask.done ? 'line-through' : 'none',
                  cursor: hasItems ? 'pointer' : 'default',
                }}
              >
                {subtask.text}
              </Typography>
              {hasItems && (
                <Typography variant="caption" color="text.secondary">
                  ({subtask.items!.filter((i) => i.done).length}/{subtask.items!.length})
                </Typography>
              )}
            </Box>
          }
          sx={{ alignItems: 'flex-start', my: 0.25, flex: 1 }}
        />
        <Box sx={{ mt: 0.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <DateBadge date={subtask.due} done={subtask.done} size="md" />
          <OwnerChip owner={subtask.owner} onChange={onSetOwner} />
        </Box>
      </Box>
      {hasItems && (
        <Collapse in={expanded}>
          {subtask.items!.map((item, idx) => (
            <NestedItemRow
              key={idx}
              item={item}
              onToggle={() => onToggleItem(idx)}
              onSetOwner={(owner) => onSetItemOwner(idx, owner)}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
}
