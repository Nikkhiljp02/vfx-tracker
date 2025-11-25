-- DropIndex
DROP INDEX "activity_logs_timestamp_idx";

-- DropIndex
DROP INDEX "feedbacks_feedbackDate_idx";

-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_actionType_idx" ON "activity_logs"("actionType");

-- CreateIndex
CREATE INDEX "activity_logs_isReversed_idx" ON "activity_logs"("isReversed");

-- CreateIndex
CREATE INDEX "feedbacks_feedbackDate_idx" ON "feedbacks"("feedbackDate" DESC);

-- CreateIndex
CREATE INDEX "feedbacks_taskId_idx" ON "feedbacks"("taskId");

-- CreateIndex
CREATE INDEX "feedbacks_showName_shotName_idx" ON "feedbacks"("showName", "shotName");

-- CreateIndex
CREATE INDEX "tasks_deliveredDate_idx" ON "tasks"("deliveredDate" DESC);

-- CreateIndex
CREATE INDEX "tasks_updatedDate_idx" ON "tasks"("updatedDate" DESC);
