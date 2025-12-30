/**
 * AI Function Definitions and Execution
 * Read-only functions for AI Resource Manager
 */

import { prisma } from '@/lib/prisma';
import { SchemaType } from '@google/generative-ai';
import type { FunctionDeclaration } from '@google/generative-ai';

const STUDIO_TIMEZONE = process.env.STUDIO_TIMEZONE || 'Asia/Kolkata';
const DAY_QUERY_PAD_MS = 14 * 60 * 60 * 1000; // +/- 14h to safely cover timezones

function utcMidnight(dateStr: string): Date {
  // dateStr is expected to be YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function formatDateKey(date: Date): string {
  // Returns YYYY-MM-DD in configured studio timezone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDIO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getPaddedUtcRangeForDateKeys(startDate: string, endDate: string): { gte: Date; lt: Date } {
  const startUtc = utcMidnight(startDate);
  const endUtcExclusive = new Date(utcMidnight(endDate).getTime() + 24 * 60 * 60 * 1000);
  return {
    gte: new Date(startUtc.getTime() - DAY_QUERY_PAD_MS),
    lt: new Date(endUtcExclusive.getTime() + DAY_QUERY_PAD_MS),
  };
}

function isDateKeyInRange(dateKey: string, startDate: string, endDate: string): boolean {
  // Works because YYYY-MM-DD is lexicographically sortable
  return dateKey >= startDate && dateKey <= endDate;
}

// Function definitions for AI (Gemini format)
export const aiFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "get_resource_forecast",
    description: "Get resource allocation forecast for a date range. Returns employee allocations with shows, shots, and man-days.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: {
          type: SchemaType.STRING,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: SchemaType.STRING,
          description: "End date in YYYY-MM-DD format"
        },
        department: {
          type: SchemaType.STRING,
          description: "Filter by department (optional). e.g., 'Animation', 'Compositing'"
        },
        shift: {
          type: SchemaType.STRING,
          description: "Filter by shift (optional). e.g., 'Day', 'Night'"
        }
      },
      required: ["startDate", "endDate"]
    }
  },
  {
    name: "get_available_resources",
    description: "Find employees who are available (not fully allocated) on a specific date or date range.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: {
          type: SchemaType.STRING,
          description: "Date to check availability in YYYY-MM-DD format"
        },
        department: {
          type: SchemaType.STRING,
          description: "Filter by department (optional)"
        }
      },
      required: ["date"]
    }
  },
  {
    name: "get_overallocated_resources",
    description: "Find employees who are overallocated (total man-days > 1.0) on any day in a date range.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        startDate: {
          type: SchemaType.STRING,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: SchemaType.STRING,
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: ["startDate", "endDate"]
    }
  },
  {
    name: "get_show_allocations",
    description: "Get all resource allocations for a specific show with timeline and employee details.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        showName: {
          type: SchemaType.STRING,
          description: "Name of the show"
        }
      },
      required: ["showName"]
    }
  },
  {
    name: "get_employee_schedule",
    description: "Get detailed schedule for a specific employee including all allocations, leaves, and availability.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        employeeId: {
          type: SchemaType.STRING,
          description: "Employee ID (preferred when available)"
        },
        employeeName: {
          type: SchemaType.STRING,
          description: "Employee name to get schedule for"
        },
        startDate: {
          type: SchemaType.STRING,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: SchemaType.STRING,
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: ["startDate", "endDate"]
    }
  },
  {
    name: "get_employee_allocations_for_date",
    description: "Get all allocations (show/shot/man-days) for a specific employee ID on a single date.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        employeeId: {
          type: SchemaType.STRING,
          description: "Employee ID (empId)"
        },
        date: {
          type: SchemaType.STRING,
          description: "Date in YYYY-MM-DD format"
        }
      },
      required: ["employeeId", "date"]
    }
  },
  {
    name: "get_department_utilization",
    description: "Calculate utilization statistics for a department including total capacity, allocated hours, and availability.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        department: {
          type: SchemaType.STRING,
          description: "Department name"
        },
        startDate: {
          type: SchemaType.STRING,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: SchemaType.STRING,
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: ["department", "startDate", "endDate"]
    }
  }
];

// Function execution
export async function executeAIFunction(functionName: string, args: any, userId: string) {
  try {
    switch (functionName) {
      case "get_resource_forecast":
        return await getResourceForecast(args, userId);
      
      case "get_available_resources":
        return await getAvailableResources(args, userId);
      
      case "get_overallocated_resources":
        return await getOverallocatedResources(args, userId);
      
      case "get_show_allocations":
        return await getShowAllocations(args, userId);
      
      case "get_employee_schedule":
        return await getEmployeeSchedule(args, userId);

      case "get_employee_allocations_for_date":
        return await getEmployeeAllocationsForDate(args, userId);
      
      case "get_department_utilization":
        return await getDepartmentUtilization(args, userId);
      
      default:
        return { error: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    console.error(`Error executing ${functionName}:`, error);
    return { error: `Failed to execute ${functionName}` };
  }
}

// Implementation functions
async function getResourceForecast(args: any, userId: string) {
  const { startDate, endDate, department, shift } = args;
  
  const where: any = {
    isActive: true
  };
  
  if (department && department !== 'all') {
    where.department = department;
  }
  
  if (shift && shift !== 'all') {
    where.shift = shift;
  }
  
  const members = await prisma.resourceMember.findMany({
    where,
    include: {
      allocations: {
        where: {
          allocationDate: {
            ...getPaddedUtcRangeForDateKeys(startDate, endDate)
          }
        },
        orderBy: {
          allocationDate: 'asc'
        }
      }
    }
  });
  
  return {
    dateRange: { startDate, endDate },
    totalMembers: members.length,
    members: members.map(m => ({
      name: m.empName,
      id: m.empId,
      department: m.department,
      designation: m.designation,
      shift: m.shift,
      allocations: m.allocations
        .map(a => {
          const dateKey = formatDateKey(a.allocationDate);
          return {
            dateKey,
            show: a.showName,
            shot: a.shotName,
            manDays: a.manDays,
            isLeave: a.isLeave,
            isIdle: a.isIdle,
          };
        })
        .filter(a => isDateKeyInRange(a.dateKey, startDate, endDate))
        .map(({ dateKey, ...rest }) => ({ date: dateKey, ...rest }))
    }))
  };
}

async function getAvailableResources(args: any, userId: string) {
  const { date, department } = args;
  const padded = getPaddedUtcRangeForDateKeys(date, date);
  
  const where: any = {
    isActive: true
  };
  
  if (department && department !== 'all') {
    where.department = department;
  }
  
  const members = await prisma.resourceMember.findMany({
    where,
    include: {
      allocations: {
        where: {
          allocationDate: padded
        }
      }
    }
  });
  
  const available = members.filter(member => {
    const totalMD = member.allocations
      .filter(a => formatDateKey(a.allocationDate) === date)
      .reduce((sum, a) => sum + a.manDays, 0);
    return totalMD < 1.0;
  }).map(m => ({
    name: m.empName,
    id: m.empId,
    department: m.department,
    designation: m.designation,
    currentAllocation: m.allocations
      .filter(a => formatDateKey(a.allocationDate) === date)
      .reduce((sum, a) => sum + a.manDays, 0),
    availableCapacity: 1.0 - m.allocations
      .filter(a => formatDateKey(a.allocationDate) === date)
      .reduce((sum, a) => sum + a.manDays, 0)
  }));
  
  return {
    date,
    totalAvailable: available.length,
    resources: available
  };
}

async function getOverallocatedResources(args: any, userId: string) {
  const { startDate, endDate } = args;
  
  const allocations = await prisma.resourceAllocation.findMany({
    where: {
      allocationDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    include: {
      resource: true
    }
  });
  
  // Group by resource and date
  const grouped = new Map<string, Map<string, number>>();
  
  allocations.forEach(alloc => {
    const key = alloc.resourceId;
    const dateKey = alloc.allocationDate.toISOString().split('T')[0];
    
    if (!grouped.has(key)) {
      grouped.set(key, new Map());
    }
    
    const dateMap = grouped.get(key)!;
    dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + alloc.manDays);
  });
  
  const overallocated: any[] = [];
  
  grouped.forEach((dateMap, resourceId) => {
    dateMap.forEach((totalMD, date) => {
      if (totalMD > 1.0) {
        const alloc = allocations.find(a => a.resourceId === resourceId);
        if (alloc) {
          overallocated.push({
            name: alloc.resource.empName,
            id: alloc.resource.empId,
            department: alloc.resource.department,
            date,
            totalManDays: totalMD,
            overBy: totalMD - 1.0
          });
        }
      }
    });
  });
  
  return {
    dateRange: { startDate, endDate },
    totalOverallocated: overallocated.length,
    resources: overallocated
  };
}

async function getShowAllocations(args: any, userId: string) {
  const { showName } = args;
  
  const allocations = await prisma.resourceAllocation.findMany({
    where: {
      showName
    },
    include: {
      resource: true
    },
    orderBy: {
      allocationDate: 'asc'
    }
  });
  
  const shots = [...new Set(allocations.map(a => a.shotName))];
  const employees = [...new Set(allocations.map(a => a.resource.empName))];
  
  return {
    showName,
    totalAllocations: allocations.length,
    totalShots: shots.length,
    totalEmployees: employees.length,
    shots,
    allocations: allocations.map(a => ({
      employee: a.resource.empName,
      department: a.resource.department,
      shot: a.shotName,
      date: a.allocationDate.toISOString().split('T')[0],
      manDays: a.manDays
    }))
  };
}

async function getEmployeeSchedule(args: any, userId: string) {
  const { employeeName, employeeId, startDate, endDate } = args;

  if (!employeeId && !employeeName) {
    return { error: 'employeeId or employeeName is required' };
  }

  const padded = getPaddedUtcRangeForDateKeys(startDate, endDate);
  
  const member = await prisma.resourceMember.findFirst({
    where: {
      ...(employeeId
        ? { empId: String(employeeId) }
        : {
            empName: {
              contains: String(employeeName),
              mode: 'insensitive'
            }
          })
    },
    include: {
      allocations: {
        where: {
          allocationDate: {
            ...padded
          }
        },
        orderBy: {
          allocationDate: 'asc'
        }
      }
    }
  });
  
  if (!member) {
    const key = employeeId ? `ID ${employeeId}` : `"${employeeName}"`;
    return { error: `Employee ${key} not found` };
  }
  
  const schedule = member.allocations
    .map(a => {
      const dateKey = formatDateKey(a.allocationDate);
      return {
        dateKey,
        show: a.showName,
        shot: a.shotName,
        manDays: a.manDays,
        isLeave: a.isLeave,
        isIdle: a.isIdle,
        notes: a.notes,
      };
    })
    .filter(a => isDateKeyInRange(a.dateKey, startDate, endDate))
    .map(({ dateKey, ...rest }) => ({ date: dateKey, ...rest }));

  return {
    employee: {
      name: member.empName,
      id: member.empId,
      department: member.department,
      designation: member.designation,
      shift: member.shift
    },
    dateRange: { startDate, endDate },
    timezone: STUDIO_TIMEZONE,
    totalAllocations: schedule.length,
    schedule,
  };
}

async function getEmployeeAllocationsForDate(args: any, userId: string) {
  const { employeeId, date } = args;
  const empId = String(employeeId);
  const padded = getPaddedUtcRangeForDateKeys(date, date);

  const member = await prisma.resourceMember.findFirst({
    where: { empId },
    include: {
      allocations: {
        where: {
          allocationDate: padded,
        },
        orderBy: { allocationDate: 'asc' },
      },
    },
  });

  if (!member) {
    return { error: `Employee ID ${empId} not found` };
  }

  const allocations = member.allocations
    .filter(a => formatDateKey(a.allocationDate) === date)
    .map(a => ({
      show: a.showName,
      shot: a.shotName,
      manDays: a.manDays,
      isLeave: a.isLeave,
      isIdle: a.isIdle,
      notes: a.notes,
    }));

  return {
    employee: {
      name: member.empName,
      id: member.empId,
      department: member.department,
      designation: member.designation,
      shift: member.shift,
    },
    date,
    timezone: STUDIO_TIMEZONE,
    totalAllocations: allocations.length,
    allocations,
  };
}

async function getDepartmentUtilization(args: any, userId: string) {
  const { department, startDate, endDate } = args;

  const padded = getPaddedUtcRangeForDateKeys(startDate, endDate);
  
  const members = await prisma.resourceMember.findMany({
    where: {
      department,
      isActive: true
    },
    include: {
      allocations: {
        where: {
          allocationDate: {
            ...padded
          }
        }
      }
    }
  });
  
  // Calculate working days in range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  const totalCapacity = members.length * days;
  const totalAllocated = members.reduce(
    (sum, m) =>
      sum +
      m.allocations
        .filter(a => isDateKeyInRange(formatDateKey(a.allocationDate), startDate, endDate))
        .reduce((s, a) => s + a.manDays, 0),
    0
  );
  const utilizationRate = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0;
  
  return {
    department,
    dateRange: { startDate, endDate },
    totalEmployees: members.length,
    workingDays: days,
    totalCapacity,
    totalAllocated,
    availableCapacity: totalCapacity - totalAllocated,
    utilizationRate: Math.round(utilizationRate * 100) / 100
  };
}
