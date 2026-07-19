# Workspace Prisma Foundation

Status: Draft

This document defines the additive Prisma work for Workspace.

No schema changes are performed during WS-2A.

## Planned Models

- WorkspaceContainer
- WorkspaceFolder
- WorkspaceDocument
- WorkspaceDocumentVersion
- WorkspaceAccessGrant
- WorkspaceFavourite
- WorkspaceLink

## Planned Enums

- WorkspaceAccessLevel
- WorkspaceSubjectType

## Existing Models To Extend

- Tenant
- User
- Permission
- PermissionModule

## Rules

- Additive only
- Multi-tenant by design
- No destructive changes
- No migration generation
- No prisma db push
- No deployment

The actual Prisma implementation will begin in WS-2B after review.