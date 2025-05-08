import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AppError } from '../middleware/error.middleware';
import { roleMiddleware } from '../middleware/auth.middleware';
import { sendNotification } from '../services/email.service';

const router = Router();
const prisma = new PrismaClient();
const execAsync = promisify(exec);

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => 
    cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => 
    cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage, limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') } });

const createDocument: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const { title, format } = req.body;
    const userId = req.user!.userId;
    const document = await prisma.document.create({
      data: { title, content: req.file.buffer.toString(), format, storagePath: req.file.path, userId }
    });
    await prisma.auditLog.create({
      data: { action: 'CREATE', details: `Document ${title} created`, userId, documentId: document.id }
    });
    
    // Send notification
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      await sendNotification(
        user.email,
        'Document Created',
        `Your document "${title}" has been created successfully.`
      );
    }
    
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
};

const getDocuments: RequestHandler = async (req, res, next) => {
  try {
    const documents = await prisma.document.findMany({ include: { user: true } });
    res.json(documents);
  } catch (error) {
    next(error);
  }
};

const getDocument: RequestHandler = async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { user: true }
    });
    if (!document) throw new AppError('Document not found', 404);
    res.json(document);
  } catch (error) {
    next(error);
  }
};

const getAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const logs = await prisma.auditLog.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

const updateDocument: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user!.userId;
    const document = await prisma.document.update({
      where: { id },
      data: { title, content }
    });
    await prisma.version.create({
      data: {
        documentId: id,
        content,
        version: (await prisma.version.count({ where: { documentId: id } })) + 1,
        userId
      }
    });
    await prisma.auditLog.create({
      data: { action: 'UPDATE', details: `Document ${title} updated`, userId, documentId: id }
    });
    res.json(document);
  } catch (error) {
    next(error);
  }
};

const deleteDocument: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const document = await prisma.document.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { action: 'DELETE', details: `Document ${document.title} deleted`, userId, documentId: id }
    });
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Create new document
router.post('/', roleMiddleware(['ADMIN', 'EDITOR']), upload.single('file'), createDocument);

// Convert document
router.post('/:id/convert', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetFormat } = req.body;
    const userId = req.user!.userId;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    // Convert using pandoc
    const outputPath = path.join(
      process.env.UPLOAD_DIR || './uploads',
      `${Date.now()}-converted.${targetFormat}`
    );

    await execAsync(
      `pandoc "${document.storagePath}" -o "${outputPath}" -f ${document.format} -t ${targetFormat}`
    );

    // Create new version
    const version = await prisma.version.create({
      data: {
        documentId: id,
        content: document.content,
        version: (await prisma.version.count({ where: { documentId: id } })) + 1,
        userId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'CONVERT',
        details: `Document converted from ${document.format} to ${targetFormat}`,
        userId,
        documentId: id,
      },
    });

    res.json({
      message: 'Document converted successfully',
      outputPath,
      version,
    });
  } catch (error) {
    next(error);
  }
});

// Get document versions
router.get('/:id/versions', async (req, res, next) => {
  try {
    const { id } = req.params;

    const versions = await prisma.version.findMany({
      where: { documentId: id },
      orderBy: { version: 'desc' },
      include: { user: true },
    });

    res.json(versions);
  } catch (error) {
    next(error);
  }
});

// Get document audit logs
router.get('/:id/audit-logs', roleMiddleware(['ADMIN']), getAuditLogs);

// Get all documents
router.get('/', getDocuments);

// Get single document
router.get('/:id', getDocument);

// Update document
router.put('/:id', roleMiddleware(['ADMIN', 'EDITOR']), updateDocument);

// Delete document
router.delete('/:id', roleMiddleware(['ADMIN']), deleteDocument);

export default router; 