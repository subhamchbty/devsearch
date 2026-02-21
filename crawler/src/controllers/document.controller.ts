import { Request, Response } from "express";
import dataSource from "../config/dataSource";
import { Document } from "../entities/document.entity";

const addNewDocument = async (req: Request, res: Response) => {
    const { documentationOf, version, type, baseUrl } = req.body;

    const documentRepo = dataSource.getRepository(Document);

    try {
        const newDocument = documentRepo.create({
            documentationOf,
            version,
            type,
            baseUrl,
        });

        await documentRepo.save(newDocument);

        res.status(201).json({
            message: "Document added successfully",
            document: newDocument,
        });
    } catch (error) {
        console.error("Error adding document:", error);
        res.status(500).json({ message: "Failed to add document" });
    }
};

const getDocuments = async (_req: Request, res: Response) => {
    const documentRepo = dataSource.getRepository(Document);

    try {
        const documents = await documentRepo.find();
        res.json({ documents });
    } catch (error) {
        console.error("Error fetching documents:", error);
        res.status(500).json({ message: "Failed to fetch documents" });
    }
};

export { addNewDocument, getDocuments };
