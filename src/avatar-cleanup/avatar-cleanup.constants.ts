export const AVATAR_CLEANUP_QUEUE = 'avatar-cleanup';
export const AVATAR_CLEANUP_JOB = 'cleanup-deleted-avatars';
export const AVATAR_CLEANUP_BATCH_SIZE = 100;
export const AVATAR_CLEANUP_CRON_NAME = 'avatar-cleanup-nightly';

export const avatarCleanupJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: true,
  removeOnFail: 100,
};
