-- AlterTable
ALTER TABLE "questions" ADD COLUMN "assignedTo" TEXT;

-- CreateIndex
CREATE INDEX "questions_assignedTo_idx" ON "questions"("assignedTo");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
