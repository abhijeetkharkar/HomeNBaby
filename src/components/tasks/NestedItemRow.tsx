import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import type { NestedItem, Owner } from '../../types';
import { OwnerChip } from './OwnerChip';
import { DateBadge } from './DateBadge';

interface Props {
  item: NestedItem;
  onToggle: () => void;
  onSetOwner: (owner: Owner) => void;
}

export function NestedItemRow({ item, onToggle, onSetOwner }: Props) {
  return (
    <Box sx={{ pl: 3, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={item.done}
            onChange={onToggle}
            size="small"
            sx={{ py: 0.25, color: 'text.disabled' }}
          />
        }
        label={
          <Typography
            variant="body2"
            sx={{
              color: item.done ? 'text.disabled' : 'text.secondary',
              textDecoration: item.done ? 'line-through' : 'none',
              fontSize: '0.8rem',
            }}
          >
            {item.text}
          </Typography>
        }
        sx={{ my: 0, flex: 1 }}
      />
      <Box sx={{ mt: 0.25, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <DateBadge date={item.due} done={item.done} size="sm" />
        <OwnerChip owner={item.owner} onChange={onSetOwner} />
      </Box>
    </Box>
  );
}
