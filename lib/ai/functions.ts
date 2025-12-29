/**
 * AI Function Definitions and Execution
 * Read-only functions for AI Resource Manager
 */

import { prisma } from '@/lib/prisma';

// Function definitions for AI (Gemini format)
export const aiFunctionDeclarations = [
  {
    name: "get_resource_forecast",
    description: "Get resource allocation forecast for a date range. Returns employee allocations with shows, shots, and man-days.",
    parameters: {
      type: "object" as const,
      properties: {
        startDate: {
          type: "string" as const,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: "string" as const,
          description: "End date in YYYY-MM-DD format"
        },
        department: {
          type: "string" as const,
          description: "Filter by department (optional). e.g., 'Animation', 'Compositing'"
        },
        shift: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        date: {
          type: "string" as const,
          description: "Date to check availability in YYYY-MM-DD format"
        },
        department: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        startDate: {
          type: "string" as const,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        showName: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        employeeName: {
          type: "string" as const,
          description: "Employee name to get schedule for"
        },
        startDate: {
          type: "string" as const,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: "string" as const,
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: ["employeeName", "startDate", "endDate"]
    }
  },
  {
    name: "get_department_utilization",
    description: "Calculate utilization statistics for a department including total capacity, allocated hours, and availability.",
    parameters: {
      type: "object" as const,
      properties: {
        department: {
          type: "string" as const,
          description: "Department name"
        },
        startDate: {
          type: "string" as const,
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: "string" as const,
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
            gte: new Date(startDate),
            lte: new Date(endDate)
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
      allocations: m.allocations.map(a => ({
        date: a.allocationDate.toISOString().split('T')[0],
        show: a.showName,
        shot: a.shotName,
        manDays: a.manDays,
        isLeave: a.isLeave,
        isIdle: a.isIdle
      }))
    }))
  };
}

async function getAvailableResources(args: any, userId: string) {
  const { date, department } = args;
  const targetDate = new Date(date);
  
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
          allocationDate: targetDate
        }
      }
    }
  });
  
  const available = members.filter(member => {
    const totalMD = member.allocations.reduce((sum, a) => sum + a.manDays, 0);
    return totalMD < 1.0;
  }).map(m => ({
    name: m.empName,
    id: m.empId,
    department: m.department,
    designation: m.designation,
    currentAllocation: m.allocations.reduce((sum, a) => sum + a.manDays, 0),
    availableCapacity: 1.0 - m.allocations.reduce((sum, a) => sum + a.manDays, 0)
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
  const { employeeName, startDate, endDate } = args;
  
  const member = await prisma.resourceMember.findFirst({
    where: {
      empName: {
        contains: employeeName,
        mode: 'insensitive'
      }
    },
    include: {
      allocations: {
        where: {
          allocationDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
          }
        },
        orderBy: {
          allocationDate: 'asc'
        }
      }
    }
  });
  
  if (!member) {
    return { error: `Employee "${employeeName}" not found` };
  }
  
  return {
    employee: {
      name: member.empName,
      id: member.empId,
      department: member.department,
      designation: member.designation,
      shift: member.shift
    },
    dateRange: { startDate, endDate },
    totalAllocations: member.allocations.length,
    schedule: member.allocations.map(a => ({
      date: a.allocationDate.toISOString().split('T')[0],
      show: a.showName,
      shot: a.shotName,
      manDays: a.manDays,
      isLeave: a.isLeave,
      isIdle: a.isIdle,
      notes: a.notes
    }))
  };
}

async function getDepartmentUtilization(args: any, userId: string) {
  const { department, startDate, endDate } = args;
  
  const members = await prisma.resourceMember.findMany({
    where: {
      department,
      isActive: true
    },
    include: {
      allocations: {
        where: {
          allocationDate: {
            gte: new Date(startDate),
            lte: new Date(endDate)
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
  const totalAllocated = members.reduce((sum, m) => 
    sum + m.allocations.reduce((s, a) => s + a.manDays, 0), 0
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
