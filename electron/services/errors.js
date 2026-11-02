// Shared error helpers. Errors that are safe and useful to show to the user
// are created with UserError; everything else is translated by friendlyError().

class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
    this.userFacing = true;
  }
}

const PERMISSION_HELP =
  'Permission denied. macOS may be blocking access. Check System Settings > Privacy & Security > ' +
  'Files and Folders (or Full Disk Access) for DropSort, or choose the folder again.';

function friendlyError(err) {
  if (!err) return 'Unknown error.';
  if (err.userFacing) return err.message;
  switch (err.code) {
    case 'ENOENT':
      return 'The file or folder no longer exists.';
    case 'EACCES':
    case 'EPERM':
      return PERMISSION_HELP;
    case 'ENOSPC':
      return 'The disk is full.';
    case 'EROFS':
      return 'The destination is read-only.';
    case 'EBUSY':
      return 'The file is currently in use by another program.';
    case 'ENAMETOOLONG':
      return 'The file name is too long.';
    case 'ENOTDIR':
      return 'A file already exists where a folder is needed.';
    case 'EEXIST':
      return 'A file with this name already exists.';
    case 'EMFILE':
      return 'Too many files are open at once. Try again.';
    default:
      return err.message || String(err);
  }
}

module.exports = { UserError, friendlyError, PERMISSION_HELP };
