import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useNames } from '../../hooks/useNames';
import type { BabyName } from '../../types';

const CATEGORY_LABELS: Record<BabyName['category'], string> = {
  PPP: 'PPP (Past Participle)',
  AgentNoun: 'Agent Nouns',
  ParentEcho: 'Parent Echo',
};

const CATEGORY_COLORS: Record<BabyName['category'], 'primary' | 'secondary' | 'success'> = {
  PPP: 'primary',
  AgentNoun: 'secondary',
  ParentEcho: 'success',
};

type CategoryFilter = 'All' | BabyName['category'];

export function NamesView() {
  const { names, loading, error, toggleFavourite } = useNames();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [themeFilter, setThemeFilter] = useState('All');
  const [favsOnly, setFavsOnly] = useState(false);

  // Collect unique themes (excluding Parent Echo themes — grouped separately)
  const themes = useMemo(() => {
    const set = new Set<string>();
    names.forEach((n) => {
      if (n.category !== 'ParentEcho') set.add(n.theme);
    });
    return ['All', ...Array.from(set).sort()];
  }, [names]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = names.filter((n) => {
      if (favsOnly && !n.favourite) return false;
      if (categoryFilter !== 'All' && n.category !== categoryFilter) return false;
      if (themeFilter !== 'All' && n.theme !== themeFilter) return false;
      if (q) {
        return (
          n.name.toLowerCase().includes(q) ||
          n.devanagari.includes(q) ||
          n.meaning.toLowerCase().includes(q) ||
          n.nickname.toLowerCase().includes(q) ||
          n.etymology.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Parent Echo always last — sort: non-PE first, then PE
    return [
      ...base.filter((n) => n.category !== 'ParentEcho'),
      ...base.filter((n) => n.category === 'ParentEcho'),
    ];
  }, [names, search, categoryFilter, themeFilter, favsOnly]);

  const favCount = names.filter((n) => n.favourite).length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      {/* Header row */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
          Sanskrit Baby Names
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {filtered.length} of {names.length}
            {favCount > 0 && ` · ❤️ ${favCount}`}
          </Typography>
        </Typography>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search by name, meaning, nickname, etymology…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {/* Category filter */}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        {(['All', 'PPP', 'AgentNoun', 'ParentEcho'] as const).map((cat) => (
          <Chip
            key={cat}
            label={cat === 'All' ? 'All Categories' : CATEGORY_LABELS[cat]}
            onClick={() => {
              setCategoryFilter(cat);
              setThemeFilter('All'); // reset theme when switching category
            }}
            color={categoryFilter === cat ? (cat === 'All' ? 'default' : CATEGORY_COLORS[cat]) : 'default'}
            variant={categoryFilter === cat ? 'filled' : 'outlined'}
            size="small"
          />
        ))}
        <Chip
          label={`❤️ Favourites${favCount > 0 ? ` (${favCount})` : ''}`}
          onClick={() => setFavsOnly((v) => !v)}
          color={favsOnly ? 'error' : 'default'}
          variant={favsOnly ? 'filled' : 'outlined'}
          size="small"
        />
      </Stack>

      {/* Theme filter — only when showing PPP or all non-PE */}
      {categoryFilter !== 'ParentEcho' && themes.length > 1 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {themes.map((t) => (
            <Chip
              key={t}
              label={t === 'All' ? 'All Themes' : t}
              onClick={() => setThemeFilter(t)}
              color={themeFilter === t ? 'primary' : 'default'}
              variant={themeFilter === t ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Stack>
      )}

      {filtered.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>No names match your filters.</Alert>
      )}

      {/* Name cards */}
      <Stack spacing={1.5}>
        {filtered.map((name, idx) => {
          // Section divider before first ParentEcho
          const prevIsNotPE = idx > 0 && filtered[idx - 1].category !== 'ParentEcho';
          const showDivider = name.category === 'ParentEcho' && prevIsNotPE;

          return (
            <Box key={name.id}>
              {showDivider && (
                <Box sx={{ my: 2 }}>
                  <Divider>
                    <Chip
                      label="✨ Parent Echo"
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  </Divider>
                </Box>
              )}
              <NameCard name={name} onToggleFav={toggleFavourite} />
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

// ─── Individual Name Card ─────────────────────────────────────────────────────
function NameCard({
  name,
  onToggleFav,
}: {
  name: BabyName;
  onToggleFav: (id: string, current: boolean) => void;
}) {
  return (
    <Card
      elevation={1}
      sx={{
        borderRadius: 2,
        borderLeft: 4,
        borderLeftColor:
          name.category === 'PPP'
            ? 'primary.main'
            : name.category === 'AgentNoun'
            ? 'secondary.main'
            : 'success.main',
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {/* Main content */}
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={700} component="span">
                {name.name}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                component="span"
                sx={{ fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: '1.1rem' }}
              >
                {name.devanagari}
              </Typography>
              {name.nickname && (
                <Typography variant="body2" color="text.disabled" component="span" sx={{ fontStyle: 'italic' }}>
                  {name.nickname}
                </Typography>
              )}
            </Box>

            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {name.meaning}
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block', fontStyle: 'italic' }}>
              {name.etymology}
            </Typography>

            <Box sx={{ mt: 0.75, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip
                label={CATEGORY_LABELS[name.category]}
                color={CATEGORY_COLORS[name.category]}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
              <Chip
                label={name.theme}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            </Box>
          </Box>

          {/* Favourite toggle */}
          <Tooltip title={name.favourite ? 'Remove from favourites' : 'Add to favourites'}>
            <IconButton
              onClick={() => onToggleFav(name.id, name.favourite)}
              size="small"
              sx={{ mt: -0.5 }}
              color={name.favourite ? 'error' : 'default'}
            >
              {name.favourite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}
