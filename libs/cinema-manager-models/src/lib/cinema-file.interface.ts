export interface CreateCinemaDto {
  agentId: string;
  title: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  createdAt: string;
  lastModified: string;
  duration?: number;
  resolution?: string;
}

export interface CinemaFile {
  id: string;
  agentId: string;
  title: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  createdAt: string;
  lastModified: string;
  dateAdded: string;
  duration?: number;
  resolution?: string;
}

export interface VideoFile {
  name: string;
  path: string;
  size: number;
  dateModified: Date;
  duration?: number;
  resolution?: string;
}