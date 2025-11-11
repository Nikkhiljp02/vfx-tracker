import { Show, Shot, Task, TrackerRow } from './types';

// Transform shows with shots and tasks into flattened tracker rows
export function transformToTrackerRows(shows: Show[]): TrackerRow[] {
  const rows: TrackerRow[] = [];

  shows.forEach((show) => {
    const showDepartments = JSON.parse(show.departments) as string[];

    show.shots?.forEach((shot) => {
      // Group tasks by department
      const tasksByDept: { [dept: string]: Task } = {};
      shot.tasks?.forEach((task) => {
        const deptKey = task.isInternal ? `Int ${task.department}` : task.department;
        tasksByDept[deptKey] = task;
      });

      rows.push({
        shotId: shot.id,
        showName: show.showName,
        shotName: shot.shotName,
        episode: shot.episode,
        sequence: shot.sequence,
        turnover: shot.turnover,
        frames: shot.frames,
        shotTag: shot.shotTag,
        scopeOfWork: shot.scopeOfWork,
        remark: shot.remark,
        showId: show.id,
        showDepartments,
        tasks: tasksByDept,
      });
    });
  });

  return rows;
}

// Get all unique lead names from tasks
export function getUniqueLeads(shows: Show[]): string[] {
  const leads = new Set<string>();
  
  shows.forEach((show) => {
    show.shots?.forEach((shot) => {
      shot.tasks?.forEach((task) => {
        if (task.leadName) {
          leads.add(task.leadName);
        }
      });
    });
  });

  return Array.from(leads).sort();
}

// Get all unique episode values from shots
export function getUniqueEpisodes(shows: Show[]): string[] {
  const episodes = new Set<string>();
  
  shows.forEach((show) => {
    show.shots?.forEach((shot) => {
      if (shot.episode) {
        episodes.add(shot.episode);
      }
    });
  });

  return Array.from(episodes).sort();
}

// Get all unique sequence values from shots
export function getUniqueSequences(shows: Show[]): string[] {
  const sequences = new Set<string>();
  
  shows.forEach((show) => {
    show.shots?.forEach((shot) => {
      if (shot.sequence) {
        sequences.add(shot.sequence);
      }
    });
  });

  return Array.from(sequences).sort();
}

// Get all unique turnover values from shots
export function getUniqueTurnovers(shows: Show[]): string[] {
  const turnovers = new Set<string>();
  
  shows.forEach((show) => {
    show.shots?.forEach((shot) => {
      if (shot.turnover) {
        turnovers.add(shot.turnover);
      }
    });
  });

  return Array.from(turnovers).sort();
}

// Format date to YYYY-MM-DD
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// Format date to display format (e.g., Nov 5, 2025)
export function formatDisplayDate(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Parse departments from JSON string
export function parseDepartments(departmentsStr: string): string[] {
  try {
    return JSON.parse(departmentsStr);
  } catch {
    return [];
  }
}

// Parse dependencies from JSON string
export function parseDependencies(dependenciesStr: string | null): string[] {
  if (!dependenciesStr) return [];
  try {
    return JSON.parse(dependenciesStr);
  } catch {
    return [];
  }
}

// Get status color
export function getStatusColor(statusName: string, statusOptions: any[]): string {
  const status = statusOptions.find((s) => s.statusName === statusName);
  return status?.colorCode || '#6B7280';
}

// Increment version number
export function incrementVersion(currentVersion: string | null): string {
  if (!currentVersion) return 'v001';
  
  const match = currentVersion.match(/v(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10) + 1;
    return `v${num.toString().padStart(3, '0')}`;
  }
  return 'v001';
}

// Validate status transition
export function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions: Record<string, string[]> = {
    'YTS': ['WIP', 'Int App', 'AWF', 'OMIT', 'HOLD'], // Can skip to Int App or AWF directly
    'WIP': ['Int App', 'AWF', 'OMIT', 'HOLD'],
    'Int App': ['AWF', 'OMIT', 'HOLD'],
    'AWF': ['C APP', 'C KB', 'OMIT', 'HOLD'],
    'C APP': ['C KB', 'OMIT', 'HOLD'], // Can go to C KB (client kickback), OMIT, or HOLD
    'C KB': ['AWF', 'OMIT', 'HOLD'], // After kickback, can mark as AWF again (version increment)
    'OMIT': ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB', 'HOLD'], // OMIT is reversible - can go to any status
    'HOLD': ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB'], // Can resume to previous state
  };

  return allowedTransitions[currentStatus]?.includes(newStatus) || false;
}
