# SportClubEvo Workspace Architecture

**Status:** Draft (WS-1)
**Module:** Workspace
**Route:** `/dashboard/workspace`

---

# 1. Vision

The Workspace module is the secure internal knowledge and document management platform of SportClubEvo.

Unlike the existing Media Library, which primarily manages website and CMS assets, Workspace manages confidential club documents, operational knowledge and collaboration assets.

Workspace is designed to become the central location where everyone inside a sports organization can securely store, organize, find and collaborate on documents.

Typical examples include:

- Trainer Handbooks
- Club Regulations
- Meeting Minutes
- Sponsoring Contracts
- Board Documents
- Financial Documents
- Medical Documents
- Team Documents
- Training Material
- Match Documents
- Internal Presentations
- Forms
- Templates
- Images
- Videos
- PDFs
- Office Documents

Workspace is fully integrated into SportClubEvo and is never intended to become a standalone product.

---

# 2. Design Principles

Workspace follows the following architectural principles.

## Private by Default

Everything inside Workspace is private unless explicitly shared.

There are no public Workspace URLs.

---

## Multi-Tenant First

Every Workspace object belongs to exactly one tenant.

No cross-tenant access is ever allowed.

Every query must always be tenant scoped.

---

## Permission Driven

Users only see documents they are allowed to see.

Permissions are evaluated before metadata, previews or downloads are returned.

---

## Version Safe

Documents are immutable.

Replacing a document creates a new version.

Existing versions are never overwritten.

---

## Audit Ready

Every important action is auditable.

Examples:

- Upload
- Download
- Rename
- Move
- Archive
- Restore
- Permission changes
- Version creation

---

## Provider Agnostic

Workspace must never depend directly on one storage provider.

Storage implementations can later switch between:

- Vercel Blob
- AWS S3
- Azure Blob
- Google Cloud Storage
- MinIO
- Local Storage (development)

without changing Workspace business logic.

---

## Modular

Workspace integrates with existing SportClubEvo modules without owning them.

Workspace stores documents.

Other modules reference documents.

---

# 3. Business Scope

Workspace provides:

- Folder hierarchy
- Secure document storage
- Version history
- Metadata
- Role permissions
- User permissions
- Team permissions
- Organisation permissions
- Search
- Favorites
- Recent files
- Cross-module document links
- Audit trail

Workspace explicitly does NOT provide:

- Office editing
- Google Docs collaboration
- Public sharing
- Anonymous links
- External guest access

These may become future enhancements.

---

# 4. Target Users

Workspace is intended for:

- Club Board
- Club Administration
- Coaches
- Team Managers
- Volunteers
- Medical Staff
- Referees
- Committee Members
- Sponsors (future limited access)

Each club decides who receives access.

---

# 5. Typical Use Cases

Examples include:

## Club Administration

Store:

- Statutes
- Contracts
- Insurance
- Policies
- Annual Reports

---

## Coaches

Store:

- Training Plans
- Exercises
- Videos
- Player Documents

---

## Teams

Store:

- Tournament Information
- Match Documents
- Internal Communication Files
- Parent Information

---

## Meetings

Attach:

- Agenda
- Minutes
- Presentations
- Decisions

---

## Initiatives

Attach:

- Concepts
- Planning
- Budgets
- Images

---

## Registrations

Store submitted documents securely.

---

## Communication Platform

Reuse:

- Logos
- Templates
- PDFs
- Attachments

---

# 6. Relationship to Existing Modules

Workspace is not isolated.

It integrates with:

- Organisation
- Teams
- Persons
- Meetings
- Initiatives
- Registrations
- Website
- Communication
- Infoboard
- Weekplanner

Documents remain owned by Workspace.

Other modules only reference Workspace documents.

---

# 7. Relationship to the Existing Media Library

SportClubEvo already contains a Media Library.

The Media Library manages assets for the public website.

Workspace manages internal documents.

These remain two separate bounded contexts.

Future implementations may share:

- Storage adapters
- Thumbnail generation
- File validation
- MIME detection

The business models remain independent.


---

# 8. Information Architecture

Workspace follows a hierarchical information model while remaining extensible for future graph-based relationships.

The hierarchy is intentionally simple for end users:

```
Workspace
 â”œâ”€â”€ Folder
 â”‚     â”œâ”€â”€ Folder
 â”‚     â”‚      â”œâ”€â”€ Folder
 â”‚     â”‚      â”œâ”€â”€ Document
 â”‚     â”‚      â””â”€â”€ Document
 â”‚     â””â”€â”€ Document
 â””â”€â”€ Document
```

Every document has exactly one primary folder.

A document may additionally be linked to multiple SportClubEvo entities without changing its physical location.

Examples:

- Team
- Meeting
- Initiative
- Event
- Registration
- Organisation Unit
- Communication Template

This keeps navigation intuitive while enabling powerful cross-module integration.

---

# 9. Folder Hierarchy

Folders represent the primary navigation structure.

Folders support unlimited nesting.

Examples:

```
Workspace

Administration
    Policies
    Insurance
    Finance

Board
    Meetings
    Strategies

Teams
    E1
    E2
    D1

Training
    Exercises
    Videos

Sponsors
    Contracts
    Logos
```

Folders contain:

- Child folders
- Documents

Folders never contain versions.

Versions belong to documents only.

---

## Folder Rules

A folder:

- belongs to one tenant
- has one optional parent
- may contain child folders
- may contain documents
- supports archive / restore
- supports inherited permissions
- supports metadata
- supports favourites
- supports audit history

Folder names only need to be unique within the same parent folder.

---

# 10. Document Model

A Workspace Document represents a logical document.

Examples:

```
Trainer Handbook.pdf
```

The document itself never changes identity.

Instead it owns one or more immutable versions.

A document stores:

- Name
- Description
- Folder
- Current Version
- Created By
- Created At
- Updated At
- Archived At

A document never stores:

- Binary file data
- Public URL
- Preview image

Those belong elsewhere.

---

## Document Identity

Every document receives an immutable UUID.

This identifier never changes.

Moving a document between folders does NOT create a new document.

Renaming a document does NOT create a new document.

Replacing the binary does NOT create a new document.

Only a new version is created.

---

# 11. Version Model

Versions are immutable.

Example:

```
Trainer Handbook

Version 1
Version 2
Version 3
Version 4
```

The document always points to exactly one Current Version.

Replacing the uploaded file creates:

```
Current Version + 1
```

Never:

- overwrite binaries
- reuse version numbers
- modify previous versions

---

## Version Metadata

Each version stores:

- Version Number
- Original Filename
- MIME Type
- Extension
- File Size
- SHA256 Checksum
- Storage Provider
- Storage Key
- Uploaded By
- Uploaded At
- Change Note (optional)

---

## Restore Behaviour

Restoring Version 2 when Version 5 is current creates:

```
Version 6
```

Version 6 references the binary from Version 2.

The historical chain remains complete.

Nothing is overwritten.

---

# 12. Metadata

Workspace supports structured metadata.

Initial metadata:

- Name
- Description
- Tags (future)
- Favourite
- Created By
- Updated By
- Created At
- Updated At

Future metadata:

- Keywords
- AI Summary
- OCR Text
- Language
- Categories
- Retention Policy

Metadata updates do not create document versions.

---

# 13. Permission Architecture

Workspace uses layered permissions.

Layer 1

Application Permission

Examples:

```
workspace.view
workspace.upload
workspace.edit
workspace.manage
```

Layer 2

Workspace Access

Examples:

```
Viewer
Contributor
Editor
Manager
```

Layer 3

Inherited Folder Access

Permissions flow downward.

Layer 4

Explicit Document Access

May override inherited access.

---

# 14. Permission Inheritance

Inheritance follows:

```
Workspace

Administration
        |
        +---- Policies
                |
                +---- Handbook.pdf
```

If Administration grants:

```
Editor
```

then Policies and Handbook inherit Editor access unless explicitly overridden.

Inheritance is always calculated server-side.

---

# 15. Access Subjects

Permissions may be assigned to:

- Roles
- Users
- Organisation Units
- Teams

Future:

- Committees
- Working Groups

This allows:

```
Board

â†“

Board Members

â†“

Board Documents
```

without assigning permissions document-by-document.

---

# 16. Tenant Architecture

Every Workspace object belongs to one tenant.

This includes:

- Folder
- Document
- Version
- Permission
- Favourite
- Link

No exceptions.

Tenant ownership never changes.

Moving documents between tenants is prohibited.

---

## Tenant Resolution

The authenticated server session is the single source of truth.

Never accept:

- tenantId in request body
- tenantId in query string
- tenantId in route parameter

Every repository query must include tenant filtering.

---

# 17. Object Relationships

Workspace becomes the document hub of SportClubEvo.

A document may link to:

```
Meeting
Team
Initiative
Organisation Unit
Registration
Communication Template
Event
```

The relationship is many-to-many.

The document remains stored once.

It is merely referenced elsewhere.

This avoids duplication while creating a connected knowledge platform for the entire club.

---

# 18. Core Design Decisions

The following decisions are now locked:

- Folder hierarchy is the primary navigation model.
- Documents have immutable identities.
- Versions are append-only.
- Metadata is version-independent.
- Permissions are layered.
- Folder permissions inherit downward.
- Tenant isolation is mandatory.
- Documents may link to multiple SportClubEvo modules.
- Workspace becomes the central internal knowledge platform.

---

# 19. Storage Architecture

Workspace separates business data from binary storage.

The database stores metadata.

Object storage stores the actual files.

```
Workspace

Database
    Folder
    Document
    Version
    Permissions
    Links

â†“

Storage Provider

â†“

Binary Files
```

Workspace never stores binary files inside PostgreSQL.

---

## Storage Provider Abstraction

Workspace must never depend directly on a specific storage vendor.

Instead, every provider implements the same interface.

Initial providers:

- Vercel Blob
- Local Development Storage

Future providers:

- AWS S3
- Azure Blob Storage
- Google Cloud Storage
- MinIO
- Infomaniak Object Storage

Changing storage providers must never require changes to Workspace business logic.

---

## Storage Keys

Storage keys are generated by the server.

Example:

```
tenants/{tenantId}/workspace/{documentId}/versions/{versionId}/filename.pdf
```

Rules:

- tenant scoped
- immutable
- server generated
- sanitized filenames
- never exposed publicly

---

# 20. Upload Pipeline

Every upload follows exactly the same process.

```
Authenticate

â†“

Resolve Tenant

â†“

Permission Check

â†“

Resolve Folder

â†“

Validate Access

â†“

Read File

â†“

Validate

â†“

Generate IDs

â†“

Calculate SHA256

â†“

Upload Binary

â†“

Persist Metadata

â†“

Audit Log

â†“

Return Success
```

---

## File Validation

Every upload validates:

- File extension
- MIME type
- Maximum size
- Empty file
- Invalid filename
- Duplicate path
- Allowed file type

Future:

- Virus scan
- OCR
- AI classification

---

# 21. Download Pipeline

Downloads never expose storage directly.

```
Authenticate

â†“

Resolve Tenant

â†“

Permission Check

â†“

Resolve Document

â†“

Resolve Current Version

â†“

Generate Secure Download

â†“

Return File
```

Future implementations may use short-lived signed URLs.

Permanent public URLs are prohibited.

---

# 22. Search Architecture

Workspace initially searches metadata only.

Supported fields:

- Document Name
- Folder
- Description
- File Type
- Tags (future)

Future search:

- PDF text
- Word text
- OCR
- AI Semantic Search

Every search remains tenant scoped.

---

# 23. UI Architecture

Workspace follows the existing SportClubEvo admin design language.

Desktop Layout

```
---------------------------------------------------

Breadcrumb

Toolbar

---------------------------------------------------

Folders | Documents | Details

---------------------------------------------------
```

Mobile Layout

```
Header

â†“

Breadcrumb

â†“

Toolbar

â†“

Document List

â†“

Drawer
```

---

## Primary Components

Workspace consists of:

- WorkspacePage
- FolderTree
- Breadcrumb
- DocumentGrid
- DetailsPanel
- UploadDialog
- FolderDialog
- VersionHistory
- PermissionPanel
- SearchBar

Future:

- Recent Files
- Favorites
- Activity Feed

---

# 24. API Architecture

Private API only.

Examples:

```
GET /api/workspace

POST /api/workspace/folders

PATCH /api/workspace/folders/{id}

DELETE /api/workspace/folders/{id}

POST /api/workspace/documents

PATCH /api/workspace/documents/{id}

POST /api/workspace/documents/{id}/versions

GET /api/workspace/documents/{id}/download
```

There is no public Workspace API.

---

# 25. Database Overview

Workspace introduces the following domain models.

```
WorkspaceFolder

WorkspaceDocument

WorkspaceDocumentVersion

WorkspaceAccessGrant

WorkspaceFavourite

WorkspaceLink
```

Existing SportClubEvo models remain unchanged.

Workspace extends the platform rather than replacing existing functionality.

---

# 26. Security Principles

Mandatory:

- Authentication
- Tenant Isolation
- Role Authorization
- Folder Authorization
- Audit Logging
- Immutable Versions
- SHA256 Checksums
- Secure Downloads
- MIME Validation
- File Size Validation
- Filename Sanitization

Future:

- Virus Scanning
- Retention Policies
- Storage Quotas
- Legal Hold

---

# 27. Future Vision

Workspace is designed to become the knowledge platform of SportClubEvo.

Future capabilities include:

- AI Knowledge Assistant
- AI Document Search
- OCR
- Automatic Categorization
- Smart Tagging
- Meeting Intelligence
- Trainer Knowledge Base
- Club Wiki
- Document Templates
- Approval Workflows
- Digital Signatures
- Office Online Integration
- Mobile File Access

The current architecture intentionally supports these without requiring structural redesign.

---

# 28. Implementation Roadmap

## WS-2

Prisma Foundation

- Models
- Relations
- Enums
- Permissions

---

## WS-3

Permission Engine

- Access evaluation
- Folder inheritance
- Tenant validation

---

## WS-4

Folder Management

- CRUD
- Move
- Archive
- Restore

---

## WS-5

Workspace UI

- Navigation
- Folder Tree
- Document List

---

## WS-6

Upload Engine

- Storage abstraction
- Upload
- Download
- Validation

---

## WS-7

Version History

- Replace
- Restore
- History

---

## WS-8

Permission Management

- Roles
- Users
- Teams
- Organisation Units

---

## WS-9

Cross Module Integration

- Meetings
- Teams
- Events
- Initiatives
- Registrations

---

## WS-10

Production Hardening

- Search
- Performance
- Security
- Quotas
- Preview

---

# 29. Definition of Done

Workspace Architecture is complete when:

- Architecture is documented.
- Core decisions are locked.
- Multi-tenant rules are defined.
- Permission model is frozen.
- Storage strategy is frozen.
- Security principles are defined.
- Database model is agreed.
- Implementation roadmap is approved.

Only then may implementation begin.

---

# 30. Locked Decisions

The following architectural decisions are locked.

1. Workspace is an internal module of SportClubEvo.
2. Workspace is private by default.
3. Every record contains a tenantId.
4. Existing Media Library remains separate.
5. Workspace owns internal documents.
6. Documents are immutable.
7. Versions are append-only.
8. Folder permissions inherit.
9. Metadata is independent from versions.
10. Storage providers are abstracted.
11. Permanent public URLs are prohibited.
12. Every query is tenant scoped.
13. Every implementation slice includes tenant isolation testing.
14. No destructive Prisma migrations.
15. No implementation begins before this architecture is approved.

---

# 31. Workspace Container Architecture (Locked)

During the WS-1 architecture review an additional architectural layer was introduced.

Rather than exposing a single global folder hierarchy, SportClubEvo introduces **Workspace Containers**.

This becomes the highest business level inside the Workspace module.

The hierarchy therefore becomes:

```
Tenant
    â”‚
    â”œâ”€â”€ Workspace
    â”‚      â”‚
    â”‚      â”œâ”€â”€ Folder
    â”‚      â”‚      â”‚
    â”‚      â”‚      â”œâ”€â”€ Folder
    â”‚      â”‚      â””â”€â”€ Document
    â”‚      â”‚
    â”‚      â””â”€â”€ Document
    â”‚
    â””â”€â”€ Workspace
```

A Workspace is not merely a folder.

It represents an independent business area inside the club.

Examples include:

- Administration
- Board
- Teams
- Training
- Sponsors
- Events
- Volunteers
- Referees
- Medical
- Academy

Small clubs may operate with only one Workspace.

Large clubs may create many Workspaces.

The number of Workspaces is tenant configurable.

---

# 32. Workspace Model

The new top-level Workspace entity owns:

- Name
- Description
- Icon
- Accent Color
- Sort Order
- Visibility
- Default Permission Set
- Default Managers
- Created By
- Created At
- Updated At
- Archived At

Each Workspace belongs to exactly one tenant.

A Workspace contains:

- Folders
- Root Documents
- Workspace Permissions
- Workspace Activity
- Workspace Statistics

Folders can never exist outside a Workspace.

---

# 33. Permission Inheritance

Permissions are evaluated from top to bottom.

```
Workspace
        â†“

Folder
        â†“

Subfolder
        â†“

Document
```

This introduces four permission layers.

Layer 1

Application Permission

```
workspace.view
workspace.upload
workspace.edit
workspace.manage
```

â†“

Layer 2

Workspace Access

â†“

Layer 3

Folder Access

â†“

Layer 4

Document Access

Permission inheritance flows downward unless explicitly overridden.

---

# 34. Workspace Navigation

The Workspace landing page displays all Workspaces available to the current user.

Example:

```
Workspace

ðŸ“ Administration

ðŸ“ Board

ðŸ“ Teams

ðŸ“ Training

ðŸ“ Sponsors

ðŸ“ Events
```

Selecting a Workspace opens:

```
Administration

â”œâ”€â”€ Policies
â”œâ”€â”€ Finance
â”œâ”€â”€ Contracts
â””â”€â”€ Insurance
```

This keeps navigation manageable even for very large organizations.

---

# 35. Future Workspace Capabilities

Every Workspace can later receive dedicated capabilities.

Examples include:

- Dashboard
- Activity Feed
- Recent Documents
- Favorites
- Storage Quota
- Approval Workflows
- AI Assistant
- AI Knowledge Search
- Workspace Templates
- Workspace Settings
- Workspace Branding

This enables each business area of a club to evolve independently while remaining part of the same tenant.

---

# 36. Additional Locked Decisions

The following architectural decisions are now additionally locked.

16. Workspace Containers are introduced as the highest business level.
17. Every Folder belongs to exactly one Workspace.
18. Documents belong to one Workspace through their Folder (or directly as Workspace root documents).
19. Workspace permissions are inherited by folders.
20. Small clubs may use a single Workspace.
21. Large clubs may configure multiple Workspaces.
22. Workspace Containers are tenant-scoped.
23. Workspace Containers are extensible without schema redesign.
24. Future AI capabilities operate within individual Workspaces.
25. Workspace Containers become the primary navigation level of the Workspace module.


---

# 37. Tenant-Driven Workspace Design (Locked)

SportClubEvo intentionally does **not** prescribe how a club should organise its Workspace.

Workspace provides the framework.

The tenant defines the structure.

No assumptions are made regarding:

- departments
- committees
- teams
- age groups
- administration
- sponsors
- training
- governance

Every sports organisation is free to model its own information architecture.

---

# 38. Empty by Default

When a new tenant is created, Workspace starts empty.

SportClubEvo does **not** automatically create:

- Workspace Containers
- Folders
- Documents
- Templates

The tenant administrator creates the initial structure.

Future onboarding wizards may optionally offer templates, but these are always optional and never mandatory.

---

# 39. Workspace Creation

Workspace Containers are created manually by tenant administrators.

Examples:

```
Workspace

+ New Workspace
```

The administrator defines:

- Name
- Description
- Icon
- Colour
- Default Permissions

Nothing else is assumed.

---

# 40. Folder Creation

Folders are created entirely by the tenant.

Examples may include:

```
Policies
```

or

```
Training Material
```

or

```
Board Documents
```

or

```
Events 2027
```

or anything else.

The platform never reserves folder names.

The platform never generates folder hierarchies automatically.

---

# 41. Platform Philosophy

Workspace follows the same philosophy as the rest of SportClubEvo.

SportClubEvo provides configurable building blocks rather than predefined organisational models.

This principle applies consistently across the platform:

- Organisation Builder
- Registrations
- Weekplanner
- Meetings
- Initiatives
- Communication Platform
- Website
- Workspace

The software adapts to the club.

The club should never have to adapt to the software.

---

# 42. Additional Locked Decisions

26. Workspace ships without predefined Workspace Containers.
27. Workspace ships without predefined folders.
28. Workspace ships without predefined documents.
29. All organisational structures are tenant-defined.
30. Future templates are optional and never applied automatically.
31. The platform remains configuration-driven rather than opinionated.