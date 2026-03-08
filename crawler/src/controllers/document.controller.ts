import { Request, Response } from "express";
import dataSource from "../config/dataSource";
import { Document, DocumentationType } from "../entities/document.entity";

/** Verify that a string is a well-formed absolute URL. */
function isValidUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

const addNewDocument = async (req: Request, res: Response) => {
    const { documentationOf, version, type, baseUrl, documentationUrl } =
        req.body;

    // ── Input validation ────────────────────────────────────────────

    const missingFields: string[] = [];
    if (!documentationOf) missingFields.push("documentationOf");
    if (!documentationUrl) missingFields.push("documentationUrl");
    if (!baseUrl) missingFields.push("baseUrl");
    if (!type) missingFields.push("type");

    if (missingFields.length > 0) {
        res.status(400).json({
            message: `Missing required fields: ${missingFields.join(", ")}`,
        });
        return;
    }

    const validTypes = Object.values(DocumentationType) as string[];
    if (!validTypes.includes(type)) {
        res.status(400).json({
            message: `Invalid type "${type}". Must be one of: ${validTypes.join(", ")}`,
        });
        return;
    }

    if (!isValidUrl(documentationUrl)) {
        res.status(400).json({
            message: `Invalid documentationUrl: "${documentationUrl}" is not a valid URL`,
        });
        return;
    }

    if (!isValidUrl(baseUrl)) {
        res.status(400).json({
            message: `Invalid baseUrl: "${baseUrl}" is not a valid URL`,
        });
        return;
    }

    // ── Persistence ─────────────────────────────────────────────────

    const documentRepo = dataSource.getRepository(Document);

    try {
        const newDocument = documentRepo.create({
            documentationOf,
            version,
            type,
            baseUrl,
            documentationUrl,
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
