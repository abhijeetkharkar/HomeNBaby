import { useState } from 'react';
import { Chip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ClearIcon from '@mui/icons-material/Clear';
import type { Owner } from '../../types';

interface Props {
  owner?: Owner;
  onChange: (owner: Owner) => void;
  size?: 'small' | 'medium';
}

const OWNER_COLORS: Record<string, string> = {
  Abhijeet: '#1565c0',
  Prajakta: '#c2185b',
};

const OWNERS: { label: string; value: Owner }[] = [
  { label: 'Abhijeet', value: 'Abhijeet' },
  { label: 'Prajakta', value: 'Prajakta' },
  { label: 'Unassigned', value: null },
];

export function OwnerChip({ owner, onChange, size = 'small' }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleSelect = (value: Owner) => {
    onChange(value);
    setAnchorEl(null);
  };

  const color = owner ? OWNER_COLORS[owner] ?? '#666' : undefined;

  return (
    <>
      <Chip
        icon={owner ? <PersonIcon sx={{ fontSize: '14px !important' }} /> : <PersonOutlineIcon sx={{ fontSize: '14px !important' }} />}
        label={owner ?? 'Assign'}
        size={size}
        variant={owner ? 'filled' : 'outlined'}
        onClick={handleClick}
        sx={{
          fontSize: '0.62rem',
          height: 20,
          cursor: 'pointer',
          bgcolor: owner ? `${color}18` : undefined,
          color: owner ? color : 'text.secondary',
          borderColor: owner ? color : 'divider',
          '& .MuiChip-icon': { color: owner ? color : 'text.secondary' },
          '&:hover': { bgcolor: owner ? `${color}28` : 'action.hover' },
        }}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{ paper: { sx: { minWidth: 150 } } }}
      >
        {OWNERS.map(({ label, value }) => (
          <MenuItem
            key={label}
            selected={owner === value}
            onClick={() => handleSelect(value)}
            dense
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {value === null ? (
                <ClearIcon fontSize="small" />
              ) : (
                <PersonIcon fontSize="small" sx={{ color: OWNER_COLORS[value] }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{ fontSize: '0.8rem' }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
