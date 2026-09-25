import { apiError } from "../services/apiError";
import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";
import type { Document } from "../../features/documents/types/document";
import { authorizeRequest, isExpenseVisibleToPrincipal, resolveExpenseScope } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { runAuditedTransaction } from "../services/auditService";
import { getRecord, listRecords } from "../services/mockDataService";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

interface StoredDocument extends Document {
  content: Blob;
}

interface MockExpenseResource {
  id: string;
  organizationId: string;
  employeeId: string;
  teamId: string;
  departmentId: string;
  status: string;
  documentIds?: string[];
}

async function getAuthorizedExpense(request: Request, expenseId: string, permission: "documents.read" | "documents.create" | "documents.delete") {
  const expense = await getRecord<MockExpenseResource>("expenses", expenseId);
  if (!expense) {
    return { error: apiError(404, "Expense not found.") } as const;
  }

  const principalAuthorization = await authorizeRequest(request, {
    permission,
    scope: "ORGANIZATION",
  });
  if (!principalAuthorization.allowed) {
    return { error: authorizationError(principalAuthorization) } as const;
  }

  if (!isExpenseVisibleToPrincipal(principalAuthorization.principal, expense)) {
    return { error: apiError(404, "Expense not found.") } as const;
  }

  // Document access follows the expense scope for reads (§29.11); document
  // changes are limited to the owner of a draft expense (§29.9).
  const authorization = await authorizeRequest(request, {
    permission,
    scope: permission === "documents.read"
      ? resolveExpenseScope(principalAuthorization.principal)
      : "OWN",
    resource: {
      organizationId: expense.organizationId,
      ownerId: expense.employeeId,
      teamId: expense.teamId,
      departmentId: expense.departmentId,
      state: expense.status,
    },
  });

  if (!authorization.allowed) {
    return { error: authorizationError(authorization) } as const;
  }

  return { expense, principal: authorization.principal } as const;
}

function toDto(document: StoredDocument): Document & { downloadUrl: string } {
  const { content: _content, ...metadata } = document;
  return {
    ...metadata,
    downloadUrl: `/api/documents/${document.id}/content`,
  };
}

export const documentHandlers = [
  http.get("/api/expenses/:expenseId/documents", async ({ params, request }) => {
    const expenseId = String(params.expenseId);
    const authorized = await getAuthorizedExpense(request, expenseId, "documents.read");
    if ("error" in authorized) return authorized.error;

    const documents = await listRecords<StoredDocument>("documents");
    const records = documents
      .filter((document) => document.expenseId === expenseId && document.status !== "REMOVED")
      .map(toDto);
    return HttpResponse.json(applyCollectionQuery(records, parseCollectionQuery(request)));
  }),

  http.post("/api/expenses/:expenseId/documents", async ({ params, request }) => {
    const expenseId = String(params.expenseId);
    const authorized = await getAuthorizedExpense(request, expenseId, "documents.create");
    if ("error" in authorized) return authorized.error;

    if (authorized.expense.status !== "draft") {
      return apiError(403, "Documents can only be changed while an expense is in draft.");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name.trim()) {
      return apiError(422, "A document file is required.");
    }
    if (!ACCEPTED_FILE_TYPES.has(file.type)) {
      return apiError(422, "Only JPG, PNG, and PDF documents are supported.");
    }
    if (file.size > MAX_FILE_SIZE) {
      return apiError(422, "Document size cannot exceed 5 MB.");
    }

    const now = new Date().toISOString();
    const document: StoredDocument = {
      id: crypto.randomUUID(),
      organizationId: authorized.expense.organizationId,
      expenseId,
      uploadedBy: authorized.principal.userId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      storageKey: `documents/${crypto.randomUUID()}`,
      // Persisted and associated with the expense atomically below.
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      content: file,
    };

    const linkedExpense = {
      ...authorized.expense,
      documentIds: [...(authorized.expense.documentIds ?? []), document.id],
      updatedAt: now,
    };

    await runAuditedTransaction(
      ["documents", "expenses"],
      {
        organizationId: document.organizationId,
        actorId: authorized.principal.userId,
        action: "DOCUMENT_UPLOADED",
        entityType: "DOCUMENT",
        entityId: document.id,
        newState: document.status,
        metadata: { expenseId, fileName: document.fileName, mimeType: document.mimeType, size: document.size },
        description: `Uploaded document ${document.fileName}.`,
      },
      (transaction) => {
        transaction.objectStore("documents").put(document);
        transaction.objectStore("expenses").put(linkedExpense);
      },
    );

    return HttpResponse.json(toDto(document), { status: 201 });
  }),

  http.get("/api/documents/:id/content", async ({ params, request }) => {
    const document = await getRecord<StoredDocument>("documents", String(params.id));
    if (!document || document.status === "REMOVED") {
      return apiError(404, "Document not found.");
    }

    const authorized = await getAuthorizedExpense(request, document.expenseId, "documents.read");
    if ("error" in authorized) return authorized.error;

    return new HttpResponse(document.content, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${document.fileName.replace(/"/g, "")}"`,
      },
    });
  }),

  http.delete("/api/documents/:id", async ({ params, request }) => {
    const document = await getRecord<StoredDocument>("documents", String(params.id));
    if (!document || document.status === "REMOVED") {
      return apiError(404, "Document not found.");
    }

    const authorized = await getAuthorizedExpense(request, document.expenseId, "documents.delete");
    if ("error" in authorized) return authorized.error;

    if (authorized.expense.status !== "draft") {
      return apiError(403, "Documents can only be changed while an expense is in draft.");
    }

    const now = new Date().toISOString();
    const updated: StoredDocument = {
      ...document,
      status: "REMOVED",
      updatedAt: now,
    };
    const unlinkedExpense = {
      ...authorized.expense,
      documentIds: (authorized.expense.documentIds ?? []).filter((id) => id !== document.id),
      updatedAt: now,
    };

    await runAuditedTransaction(
      ["documents", "expenses"],
      {
        organizationId: document.organizationId,
        actorId: authorized.principal.userId,
        action: "DOCUMENT_REMOVED",
        entityType: "DOCUMENT",
        entityId: document.id,
        previousState: document.status,
        newState: updated.status,
        metadata: { expenseId: document.expenseId, fileName: document.fileName },
        description: `Removed document ${document.fileName}.`,
      },
      (transaction) => {
        transaction.objectStore("documents").put(updated);
        transaction.objectStore("expenses").put(unlinkedExpense);
      },
    );

    return HttpResponse.json(toDto(updated));
  }),
];
