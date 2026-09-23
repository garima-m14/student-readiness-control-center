-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EVALUATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "score" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "competencyId" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "evaluatorId" UUID NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "retries" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Student_tenantId_name_id_idx" ON "Student"("tenantId", "name", "id");

-- CreateIndex
CREATE INDEX "Student_tenantId_status_score_id_idx" ON "Student"("tenantId", "status", "score", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Student_tenantId_email_key" ON "Student"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_tenantId_id_key" ON "Student"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Attempt_tenantId_studentId_competencyId_attemptedAt_id_idx" ON "Attempt"("tenantId", "studentId", "competencyId", "attemptedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_key_key" ON "IdempotencyRecord"("tenantId", "key");

-- CreateIndex
CREATE INDEX "Outbox_deliveredAt_nextAttemptAt_idx" ON "Outbox"("deliveredAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Outbox_tenantId_studentId_idx" ON "Outbox"("tenantId", "studentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_tenantId_studentId_fkey" FOREIGN KEY ("tenantId", "studentId") REFERENCES "Student"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_tenantId_evaluatorId_fkey" FOREIGN KEY ("tenantId", "evaluatorId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce domain boundaries even for writes outside the API.
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_score_bounds" CHECK (score >= 0 AND score <= 100);
ALTER TABLE "Student" ADD CONSTRAINT "Student_version_positive" CHECK (version > 0);
ALTER TABLE "Student" ADD CONSTRAINT "Student_score_bounds" CHECK (score >= 0 AND score <= 100);
ALTER TABLE "Student" ADD CONSTRAINT "Student_status_valid" CHECK (status IN ('INCOMPLETE','READY','NEARLY_READY','DEVELOPING','NEEDS_PREPARATION'));
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_fixed_weights" CHECK ((id='frontend' AND weight=30) OR (id='backend' AND weight=30) OR (id='databases' AND weight=25) OR (id='problem_solving' AND weight=15));
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id);
ALTER TABLE "Outbox" ADD CONSTRAINT "Outbox_student_tenant_fkey" FOREIGN KEY ("tenantId","studentId") REFERENCES "Student"("tenantId",id);
