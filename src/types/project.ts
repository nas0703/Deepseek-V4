export interface ProjectFile {
  path: string;
  language: string;
  content: string;
}

export interface ProjectState {
  files: ProjectFile[];
  commands: string[];
  notes: string[];
}
