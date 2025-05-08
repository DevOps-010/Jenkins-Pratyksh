import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrismaClient = {
  document: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  version: {
    create: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock multer
jest.mock('multer', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    single: () => jest.fn(),
  })),
  diskStorage: jest.fn(),
}));

// Mock environment variables
process.env.UPLOAD_DIR = './uploads';
process.env.MAX_FILE_SIZE = '10485760';

describe('Document Routes', () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      body: {
        title: 'Test Document',
        format: 'txt',
      },
      user: {
        userId: '123',
        role: 'ADMIN',
      },
      file: {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        buffer: Buffer.from('test content'),
        size: 12,
        destination: './uploads',
        filename: 'test.txt',
        path: './uploads/test.txt',
      },
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Document Operations', () => {
    it('should create a new document', async () => {
      const { createDocument } = require('../routes/document.routes');

      mockPrismaClient.document.create.mockResolvedValueOnce({
        id: '1',
        title: 'Test Document',
        format: 'txt',
        userId: '123',
      });

      await createDocument(mockRequest, mockResponse, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockPrismaClient.document.create).toHaveBeenCalled();
    });

    it('should get all documents', async () => {
      const { getDocuments } = require('../routes/document.routes');

      mockPrismaClient.document.findMany.mockResolvedValueOnce([
        {
          id: '1',
          title: 'Test Document',
          format: 'txt',
          userId: '123',
        },
      ]);

      await getDocuments(mockRequest, mockResponse, nextFunction);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockPrismaClient.document.findMany).toHaveBeenCalled();
    });
  });
}); 