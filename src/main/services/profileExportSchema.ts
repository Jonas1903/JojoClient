export const PROFILE_EXPORT_FORMAT = "jojo-launcher-profile" as const;
export const CURRENT_PROFILE_SCHEMA_VERSION = 2;

export type ProfileTemplateFile = {
  path: string;
  content: string;
};

export type ProfileRootFile = {
  path: string;
  content: string;
};

export type ProfileExportEnvelope = {
  format: typeof PROFILE_EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  profile: Record<string, unknown>;
  templateFiles?: ProfileTemplateFile[];
  profileFiles?: ProfileRootFile[];
};
