import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/activity-logs/[id]/undo - Undo a specific change
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: logId } = await params;

    // @ts-ignore - ActivityLog model will be available after prisma generate
    const log = await prisma.activityLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return NextResponse.json(
        { error: 'Activity log not found' },
        { status: 404 }
      );
    }

    if (log.isReversed) {
      return NextResponse.json(
        { error: 'This change has already been reversed' },
        { status: 400 }
      );
    }

    // Get the old value - it's stored as a plain string now
    const oldValue = log.oldValue;

    // Undo based on entity type and action
    // IMPORTANT: This bypasses all validation rules since it's an admin undo action
    if (log.actionType === 'UPDATE' && log.fieldName) {
      // Prepare the update data with proper type conversion
      const updateData: any = {};
      
      // Handle date fields - convert ISO string back to Date
      if (log.fieldName.includes('Eta') || log.fieldName.includes('Date')) {
        updateData[log.fieldName] = oldValue ? new Date(oldValue) : null;
      } 
      // Handle numeric fields
      else if (log.fieldName === 'bidMds') {
        updateData[log.fieldName] = oldValue ? parseFloat(oldValue) : null;
      }
      // Handle other fields (strings, etc.)
      else {
        updateData[log.fieldName] = oldValue;
      }
      
      // Restore the old value - bypassing all validation
      // Using Prisma's update which bypasses custom validation logic
      if (log.entityType === 'Shot') {
        await prisma.shot.update({
          where: { id: log.entityId },
          data: updateData,
        });
      } else if (log.entityType === 'Task') {
        // For tasks, we directly update without going through PUT endpoint validation
        await prisma.task.update({
          where: { id: log.entityId },
          data: updateData,
        });
      } else if (log.entityType === 'Show') {
        await prisma.show.update({
          where: { id: log.entityId },
          data: updateData,
        });
      }
    } else if (log.actionType === 'DELETE') {
      // Restore the deleted entity from fullEntityData
      if (!log.fullEntityData) {
        return NextResponse.json(
          { error: 'No backup data available for this deletion' },
          { status: 400 }
        );
      }

      try {
        const entityData = JSON.parse(log.fullEntityData);

        if (log.entityType === 'Task') {
          // Restore Task
          await prisma.task.create({
            data: {
              id: entityData.id,
              shotId: entityData.shotId,
              department: entityData.department,
              isInternal: entityData.isInternal || false,
              status: entityData.status,
              leadName: entityData.leadName,
              bidMds: entityData.bidMds,
              internalEta: entityData.internalEta ? new Date(entityData.internalEta) : null,
              clientEta: entityData.clientEta ? new Date(entityData.clientEta) : null,
              deliveredVersion: entityData.deliveredVersion,
              deliveredDate: entityData.deliveredDate ? new Date(entityData.deliveredDate) : null,
              createdDate: new Date(entityData.createdDate),
              updatedDate: new Date(entityData.updatedDate),
            },
          });
        } else if (log.entityType === 'Shot') {
          // Restore Shot (but not its tasks - they need to be restored separately)
          await prisma.shot.create({
            data: {
              id: entityData.id,
              showId: entityData.showId,
              shotName: entityData.shotName,
              episode: entityData.episode || null,
              sequence: entityData.sequence || null,
              turnover: entityData.turnover || null,
              shotTag: entityData.shotTag,
              parentShotId: entityData.parentShotId,
              scopeOfWork: entityData.scopeOfWork,
              createdDate: new Date(entityData.createdDate),
              updatedDate: new Date(entityData.updatedDate),
            },
          });

          // Restore all tasks that were part of this shot
          if (entityData.tasks && Array.isArray(entityData.tasks)) {
            for (const task of entityData.tasks) {
              try {
                await prisma.task.create({
                  data: {
                    id: task.id,
                    shotId: task.shotId,
                    department: task.department,
                    isInternal: task.isInternal || false,
                    status: task.status,
                    leadName: task.leadName,
                    bidMds: task.bidMds,
                    internalEta: task.internalEta ? new Date(task.internalEta) : null,
                    clientEta: task.clientEta ? new Date(task.clientEta) : null,
                    deliveredVersion: task.deliveredVersion,
                    deliveredDate: task.deliveredDate ? new Date(task.deliveredDate) : null,
                    createdDate: new Date(task.createdDate),
                    updatedDate: new Date(task.updatedDate),
                  },
                });
              } catch (taskError) {
                console.error(`Failed to restore task ${task.id}:`, taskError);
              }
            }
          }
        } else if (log.entityType === 'Show') {
          // Restore Show
          await prisma.show.create({
            data: {
              id: entityData.id,
              showName: entityData.showName,
              clientName: entityData.clientName,
              status: entityData.status,
              departments: entityData.departments,
              createdDate: new Date(entityData.createdDate),
              updatedDate: new Date(entityData.updatedDate),
              notes: entityData.notes,
            },
          });

          // Restore all shots and their tasks
          if (entityData.shots && Array.isArray(entityData.shots)) {
            for (const shot of entityData.shots) {
              try {
                await prisma.shot.create({
                  data: {
                    id: shot.id,
                    showId: shot.showId,
                    shotName: shot.shotName,
                    episode: shot.episode || null,
                    sequence: shot.sequence || null,
                    turnover: shot.turnover || null,
                    shotTag: shot.shotTag,
                    parentShotId: shot.parentShotId,
                    scopeOfWork: shot.scopeOfWork,
                    createdDate: new Date(shot.createdDate),
                    updatedDate: new Date(shot.updatedDate),
                  },
                });

                // Restore tasks for this shot
                if (shot.tasks && Array.isArray(shot.tasks)) {
                  for (const task of shot.tasks) {
                    try {
                      await prisma.task.create({
                        data: {
                          id: task.id,
                          shotId: task.shotId,
                          department: task.department,
                          isInternal: task.isInternal || false,
                          status: task.status,
                          leadName: task.leadName,
                          bidMds: task.bidMds,
                          internalEta: task.internalEta ? new Date(task.internalEta) : null,
                          clientEta: task.clientEta ? new Date(task.clientEta) : null,
                          deliveredVersion: task.deliveredVersion,
                          deliveredDate: task.deliveredDate ? new Date(task.deliveredDate) : null,
                          createdDate: new Date(task.createdDate),
                          updatedDate: new Date(task.updatedDate),
                        },
                      });
                    } catch (taskError) {
                      console.error(`Failed to restore task ${task.id}:`, taskError);
                    }
                  }
                }
              } catch (shotError) {
                console.error(`Failed to restore shot ${shot.id}:`, shotError);
              }
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing entity data:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse backup data' },
          { status: 500 }
        );
      }
    }

    // Mark the log as reversed
    // @ts-ignore - ActivityLog model will be available after prisma generate
    await prisma.activityLog.update({
      where: { id: logId },
      data: { isReversed: true },
    });

    // Create a new log entry for the undo action
    // @ts-ignore - ActivityLog model will be available after prisma generate
    await prisma.activityLog.create({
      data: {
        entityType: log.entityType,
        entityId: log.entityId,
        actionType: 'UPDATE',
        fieldName: log.fieldName,
        oldValue: log.newValue,
        newValue: log.oldValue,
        userName: 'System (Undo)',
      },
    });

    return NextResponse.json({ success: true, message: 'Change reversed successfully' });
  } catch (error) {
    console.error('Error undoing change:', error);
    return NextResponse.json(
      { error: 'Failed to undo change' },
      { status: 500 }
    );
  }
}
