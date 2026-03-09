import { Request, Response } from "express";

// ── Mock dataSource before importing the controller ──────────────────────────
const mockFindOneBy = jest.fn();
const mockCreate = jest.fn();
const mockSave = jest.fn();

jest.mock("../../config/dataSource", () => ({
    __esModule: true,
    default: {
        getRepository: () => ({
            findOneBy: mockFindOneBy,
            create: mockCreate,
            save: mockSave,
        }),
    },
}));

import { addNewDocument } from "../document.controller";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(body: object): Request {
    return { body } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { res, json, status };
}

const validBody = {
    documentationOf: "React",
    version: "18.3",
    type: "library",
    baseUrl: "https://react.dev",
    documentationUrl: "https://react.dev/reference/react",
};

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

describe("addNewDocument", () => {
    it("returns 409 when a document with the same name and version already exists", async () => {
        // Arrange: DB returns an existing document
        mockFindOneBy.mockResolvedValue({ id: 1, ...validBody });

        const req = makeReq(validBody);
        const { res, status } = makeRes();

        // Act
        await addNewDocument(req, res);

        // Assert
        expect(status).toHaveBeenCalledWith(409);
    });

    it("creates the document when no duplicate exists", async () => {
        // Arrange: DB returns null (no existing document)
        mockFindOneBy.mockResolvedValue(null);
        const created = { id: 99, ...validBody };
        mockCreate.mockReturnValue(created);
        mockSave.mockResolvedValue(created);

        const req = makeReq(validBody);
        const { res, json, status } = makeRes();
        // Express 5: res.json() at top level (no status chaining for 201)
        (res as any).json = json;
        (res as any).status = jest.fn().mockReturnValue({ json });

        // Act
        await addNewDocument(req, res);

        // Assert: no 409
        expect((res as any).status).not.toHaveBeenCalledWith(409);
        expect(mockSave).toHaveBeenCalled();
    });
});
