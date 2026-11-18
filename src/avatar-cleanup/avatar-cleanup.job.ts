export type AvatarCleanupJobData = {
  requestId: string;
};

export type AvatarOrphanRemoveJobData = {
  fileName: string;
  userId: number;
  requestId: string;
};
