import { useState } from 'react';
import {
  Container,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import YardIcon from '@mui/icons-material/Yard';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { Header } from './components/layout/Header';
import { CategoryView } from './components/views/CategoryView';
import { TimetableView } from './components/views/TimetableView';
import { ShoppingView } from './components/views/ShoppingView';
import { useTasks } from './hooks/useTasks';
import type { ViewTab } from './types';

const TABS: { value: ViewTab; label: string; icon: React.ReactElement }[] = [
  { value: 'Admin', label: 'Admin', icon: <AdminPanelSettingsIcon fontSize="small" /> },
  { value: 'Garden', label: 'Garden', icon: <YardIcon fontSize="small" /> },
  { value: 'Baby', label: 'Baby', icon: <ChildCareIcon fontSize="small" /> },
  { value: 'Hospital', label: 'Hospital', icon: <LocalHospitalIcon fontSize="small" /> },
  { value: 'Shopping', label: 'Shopping', icon: <ShoppingCartIcon fontSize="small" /> },
  { value: 'Timetable', label: 'Timeline', icon: <CalendarMonthIcon fontSize="small" /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>('Admin');
  const { tasks, loading, error, toggleTask, toggleSubtask, toggleNestedItem, setTaskOwner, setSubtaskOwner, setNestedItemOwner } = useTasks();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  const filteredTasks =
    activeTab === 'Timetable' ? tasks : tasks.filter((t) => t.category === activeTab);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Container maxWidth="md" sx={{ py: 2.5 }}>
        <Paper elevation={1} sx={{ mb: 2.5, overflow: 'hidden', borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v: ViewTab) => setActiveTab(v)}
            variant={isSmall ? 'scrollable' : 'fullWidth'}
            scrollButtons={isSmall ? 'auto' : false}
            allowScrollButtonsMobile
            indicatorColor="primary"
            textColor="primary"
            sx={{ minHeight: 44 }}
          >
            {TABS.map(({ value, label, icon }) => (
              <Tab
                key={value}
                value={value}
                label={label}
                icon={icon}
                iconPosition="start"
                sx={{ minHeight: 44, fontSize: '0.8rem', textTransform: 'none', fontWeight: 600 }}
              />
            ))}
          </Tabs>
        </Paper>

        {loading && (
          <Box display="flex" justifyContent="center" p={6}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          activeTab === 'Timetable' ? (
            <TimetableView
              tasks={tasks}
              onToggleTask={toggleTask}
              onToggleSubtask={toggleSubtask}
              onToggleNestedItem={toggleNestedItem}
              onSetTaskOwner={setTaskOwner}
              onSetSubtaskOwner={setSubtaskOwner}
              onSetNestedItemOwner={setNestedItemOwner}
            />
          ) : activeTab === 'Shopping' ? (
            <ShoppingView
              tasks={filteredTasks}
              onToggleSubtask={toggleSubtask}
              onToggleNestedItem={toggleNestedItem}
              onSetSubtaskOwner={setSubtaskOwner}
              onSetNestedItemOwner={setNestedItemOwner}
            />
          ) : (
            <CategoryView
              tasks={filteredTasks}
              onToggleTask={toggleTask}
              onToggleSubtask={toggleSubtask}
              onToggleNestedItem={toggleNestedItem}
              onSetTaskOwner={setTaskOwner}
              onSetSubtaskOwner={setSubtaskOwner}
              onSetNestedItemOwner={setNestedItemOwner}
            />
          )
        )}
      </Container>
    </Box>
  );
}
