export const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type AvatarFileType = {
  extension: 'jpg' | 'png';
  contentType: 'image/jpeg' | 'image/png';
};

export function detectAvatarType(buffer: Buffer): AvatarFileType | undefined {
  if (isJpeg(buffer)) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (isPng(buffer)) {
    return { extension: 'png', contentType: 'image/png' };
  }
  return undefined;
}

function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => buffer[index] === byte)
  );
}
