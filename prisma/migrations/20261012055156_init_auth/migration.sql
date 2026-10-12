-- CreateTable
CREATE TABLE "Users" (
    "Id" UUID NOT NULL,
    "Username" TEXT NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "FullName" TEXT,
    "Email" TEXT,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "SessionVersion" INTEGER NOT NULL DEFAULT 0,
    "LastLogin" TIMESTAMPTZ(6),
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Roles" (
    "Id" UUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "IsSystem" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMPTZ(6) NOT NULL,
    "DeletedAt" TIMESTAMPTZ(6),
    "CreatedByUserId" UUID,
    "UpdatedByUserId" UUID,

    CONSTRAINT "Roles_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Permissions" (
    "Id" UUID NOT NULL,
    "Code" TEXT NOT NULL,
    "Description" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permissions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "RolePermissions" (
    "Id" UUID NOT NULL,
    "RoleId" UUID NOT NULL,
    "PermissionId" UUID NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "RolePermissions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserRoles" (
    "Id" UUID NOT NULL,
    "UserId" UUID NOT NULL,
    "RoleId" UUID NOT NULL,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedByUserId" UUID,

    CONSTRAINT "UserRoles_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Sessions" (
    "Id" UUID NOT NULL,
    "UserId" UUID NOT NULL,
    "RefreshTokenHash" TEXT NOT NULL,
    "UserAgent" TEXT,
    "Ip" TEXT,
    "ExpiresAt" TIMESTAMPTZ(6) NOT NULL,
    "RevokedAt" TIMESTAMPTZ(6),
    "LastUsedAt" TIMESTAMPTZ(6),
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessions_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AuditLogs" (
    "Id" UUID NOT NULL,
    "UserId" UUID,
    "Action" TEXT NOT NULL,
    "Entity" TEXT,
    "EntityId" UUID,
    "Before" JSONB,
    "After" JSONB,
    "Metadata" JSONB,
    "Ip" TEXT,
    "UserAgent" TEXT,
    "CreatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogs_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_Username_key" ON "Users"("Username");

-- CreateIndex
CREATE UNIQUE INDEX "Users_Email_key" ON "Users"("Email");

-- CreateIndex
CREATE INDEX "Users_IsActive_idx" ON "Users"("IsActive");

-- CreateIndex
CREATE INDEX "Users_DeletedAt_idx" ON "Users"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Roles_Name_key" ON "Roles"("Name");

-- CreateIndex
CREATE INDEX "Roles_DeletedAt_idx" ON "Roles"("DeletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Permissions_Code_key" ON "Permissions"("Code");

-- CreateIndex
CREATE INDEX "RolePermissions_RoleId_idx" ON "RolePermissions"("RoleId");

-- CreateIndex
CREATE INDEX "RolePermissions_PermissionId_idx" ON "RolePermissions"("PermissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermissions_RoleId_PermissionId_key" ON "RolePermissions"("RoleId", "PermissionId");

-- CreateIndex
CREATE INDEX "UserRoles_UserId_idx" ON "UserRoles"("UserId");

-- CreateIndex
CREATE INDEX "UserRoles_RoleId_idx" ON "UserRoles"("RoleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoles_UserId_RoleId_key" ON "UserRoles"("UserId", "RoleId");

-- CreateIndex
CREATE INDEX "Sessions_UserId_idx" ON "Sessions"("UserId");

-- CreateIndex
CREATE INDEX "Sessions_ExpiresAt_idx" ON "Sessions"("ExpiresAt");

-- CreateIndex
CREATE INDEX "Sessions_RevokedAt_idx" ON "Sessions"("RevokedAt");

-- CreateIndex
CREATE INDEX "AuditLogs_UserId_idx" ON "AuditLogs"("UserId");

-- CreateIndex
CREATE INDEX "AuditLogs_Action_idx" ON "AuditLogs"("Action");

-- CreateIndex
CREATE INDEX "AuditLogs_Entity_EntityId_idx" ON "AuditLogs"("Entity", "EntityId");

-- CreateIndex
CREATE INDEX "AuditLogs_CreatedAt_idx" ON "AuditLogs"("CreatedAt");

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "Roles"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissions" ADD CONSTRAINT "RolePermissions_PermissionId_fkey" FOREIGN KEY ("PermissionId") REFERENCES "Permissions"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoles" ADD CONSTRAINT "UserRoles_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoles" ADD CONSTRAINT "UserRoles_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "Roles"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessions" ADD CONSTRAINT "Sessions_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
