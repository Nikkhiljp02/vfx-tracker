// Type definitions for VFX Tracker

export interface Show {
  id: string;
  showName: string;
  clientName: string | null;
  status: string;
  departments: string; // JSON string
  createdDate: Date;
  updatedDate: Date;
  notes: string | null;
  canEdit?: boolean; // Permission flag from user's ShowAccess
  shots?: Shot[];
}

export interface Shot {
  id: string;
  showId: string;
  shotName: string;
  episode: string | null; // Episode identifier (e.g., EP01, EP02)
  sequence: string | null; // Sequence identifier (e.g., SQ010, SQ020)
  turnover: string | null; // Turnover identifier (e.g., TO01, TO02)
  frames: number | null; // Number of frames in the shot
  shotTag: string; // Fresh, Additional
  parentShotId: string | null;
  scopeOfWork: string | null;
  remark: string | null; // General remark for the shot
  createdDate: Date;
  updatedDate: Date;
  show?: Show;
  parentShot?: Shot | null;
  childShots?: Shot[];
  tasks?: Task[];
  notes?: ShotNote[];
}

export interface Task {
  id: string;
  shotId: string;
  department: string; // Comp, Paint, Roto, MMRA
  isInternal: boolean;
  status: string; // YTS, WIP, Int App, AWF, C APP, C KB, OMIT, HOLD
  leadName: string | null;
  dependencies: string | null; // JSON string
  bidMds: number | null;
  internalEta: Date | null;
  clientEta: Date | null;
  deliveredVersion: string | null;
  deliveredDate: Date | null;
  createdDate: Date;
  updatedDate: Date;
  shot?: Shot;
}

// Shot Notes/Comments
export interface ShotNote {
  id: string;
  shotId: string;
  content: string;
  mentions: Mention[] | null; // Parsed from JSON
  attachments: Attachment[] | null; // Parsed from JSON
  userName: string;
  createdDate: Date;
  updatedDate: Date;
  isEdited: boolean;
}

export interface Mention {
  type: 'user' | 'dept'; // user mention or department mention
  name: string; // "John Doe" or "PAINT"
}

export interface Attachment {
  name: string;
  path: string;
  size: number;
  type?: string; // mime type
}

export interface StatusOption {
  id: string;
  statusName: string;
  statusOrder: number;
  isActive: boolean;
  colorCode: string;
  createdDate: Date;
}

export interface Department {
  id: string;
  deptName: string;
  isActive: boolean;
  createdDate: Date;
}

// Flattened type for tracker table rows
export interface TrackerRow {
  shotId: string;
  showName: string;
  shotName: string;
  episode: string | null;
  sequence: string | null;
  turnover: string | null;
  frames: number | null;
  shotTag: string;
  scopeOfWork: string | null;
  remark: string | null;
  showId: string;
  showDepartments: string[];
  tasks: {
    [department: string]: Task;
  };
}

// Filter types
export interface TrackerFilters {
  showIds: string[];
  departments: string[];
  statuses: string[];
  leadNames: string[];
  shotTag: string | null;
  shotNames: string[];
  episodes: string[]; // Filter by episode (EP01, EP02, etc.)
  sequences: string[]; // Filter by sequence (SQ010, SQ020, etc.)
  turnovers: string[]; // Filter by turnover (TO01, TO02, etc.)
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
}

// Feedback type
export interface Feedback {
  id: string;
  showName: string;
  shotName: string;
  shotTag: string;
  version: string;
  department: string;
  leadName: string | null;
  status: string; // C APP, C KB, AWF
  feedbackNotes: string | null;
  feedbackDate: Date;
  taskId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
