/*
  Warnings:

  - You are about to drop the `task_dependencies` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "task_dependencies";
PRAGMA foreign_keys=on;
