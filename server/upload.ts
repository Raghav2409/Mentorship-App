import multer from 'multer';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create folder for profile pictures
const profilePicsDir = path.join(uploadDir, 'profile-pictures');
if (!fs.existsSync(profilePicsDir)) {
  fs.mkdirSync(profilePicsDir, { recursive: true });
}

// Create static URL path for accessing images
export const UPLOADS_URL = '/uploads';

// Set up storage for profile pictures
const storage = multer.diskStorage({
  destination: function (req: Express.Request, file: Express.Multer.File, cb: any) {
    cb(null, profilePicsDir);
  },
  filename: function (req: Express.Request, file: Express.Multer.File, cb: any) {
    // Create a unique filename with the original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + extension);
  }
});

// File filter to only allow image files
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: fileFilter
});

// Helper function to get relative path for the profile picture URL
export function getProfilePictureUrl(filename: string | null): string | null {
  if (!filename) return null;
  return `${UPLOADS_URL}/profile-pictures/${path.basename(filename)}`;
}