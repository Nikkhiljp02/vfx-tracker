import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    // Get logged-in user session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "User email not found in profile" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const sendDirectly = searchParams.get("sendDirectly") === "true";

    // Build date filter
    let dateFilter: any = {};
    if (date) {
      // Single date - deliveries for that specific date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = {
        OR: [
          {
            clientEta: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          {
            internalEta: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      };
    } else if (fromDate && toDate) {
      // Date range
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = {
        OR: [
          {
            clientEta: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            internalEta: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      };
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid date parameters" },
        { status: 400 }
      );
    }

    // Fetch delivery tasks with related data
    const tasks = await prisma.task.findMany({
      where: dateFilter,
      include: {
        shot: {
          include: {
            show: true,
          },
        },
      },
    });

    if (tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: "No deliveries found for the selected date(s)" },
        { status: 404 }
      );
    }

    // Sort tasks by earliest ETA (clientEta or internalEta)
    tasks.sort((a, b) => {
      const aEta = a.clientEta || a.internalEta || new Date('9999-12-31');
      const bEta = b.clientEta || b.internalEta || new Date('9999-12-31');
      const dateCompare = new Date(aEta).getTime() - new Date(bEta).getTime();
      if (dateCompare !== 0) return dateCompare;
      // If same date, sort by shot name
      const aShotName = a.shot?.shotName || '';
      const bShotName = b.shot?.shotName || '';
      return aShotName.localeCompare(bShotName);
    });

    // Helper function to format date as "11-Nov-25"
    const formatDate = (date: Date): string => {
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      return `${day}-${month}-${year}`;
    };

    // Prepare data for Excel and email
    const deliveryData = tasks.map((task) => ({
      show: task.shot?.show?.showName || "N/A",
      shot: task.shot?.shotName || "N/A",
      department: task.department,
      lead: task.leadName || "N/A",
      status: task.status,
      internalEta: task.internalEta ? formatDate(new Date(task.internalEta)) : "N/A",
      clientEta: task.clientEta ? formatDate(new Date(task.clientEta)) : "N/A",
    }));

    // Generate Excel file
    const excelPath = await generateExcelFile(deliveryData, date, fromDate, toDate);

    // Generate HTML table for email
    const htmlTable = generateHTMLTable(deliveryData);

    // Send email via SMTP
    await sendEmailViaSMTP(
      deliveryData,
      htmlTable,
      excelPath,
      date,
      fromDate,
      toDate,
      sendDirectly,
      userEmail // Pass logged-in user's email
    );

    // Clean up Excel file after sending
    setTimeout(async () => {
      try {
        const fs = await import('fs/promises');
        // Check if file exists before attempting to delete
        try {
          await fs.access(excelPath);
          await unlink(excelPath);
        } catch (accessErr) {
          // File doesn't exist or already deleted, ignore silently
        }
      } catch (err) {
        // Ignore cleanup errors silently
      }
    }, 10000); // Delete after 10 seconds

    // Return success response
    return NextResponse.json({
      success: true,
      deliveryCount: tasks.length,
      shotCount: tasks.length,
      message: "Email sent successfully!",
    });
  } catch (error) {
    console.error("Error generating delivery list:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Generate Excel file with professional formatting
async function generateExcelFile(
  data: any[],
  date?: string | null,
  fromDate?: string | null,
  toDate?: string | null
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Delivery List");

  // Define columns
  worksheet.columns = [
    { header: "SHOW", key: "show", width: 25 },
    { header: "SHOT", key: "shot", width: 15 },
    { header: "DEPARTMENT", key: "department", width: 15 },
    { header: "LEAD", key: "lead", width: 20 },
    { header: "STATUS", key: "status", width: 15 },
    { header: "INTERNAL ETA", key: "internalEta", width: 15 },
    { header: "CLIENT ETA", key: "clientEta", width: 15 },
  ];

  // Style header row - only the cells, not the entire row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 20;
  
  // Style each header cell individually
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF000000" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Add data rows
  data.forEach((item) => {
    const row = worksheet.addRow(item);

    // Add borders and center alignment to all cells
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.font = { size: 9 };
    });

    // Color code based on status
    const statusCell = row.getCell(5); // STATUS column
    const status = item.status.toUpperCase();

    if (status.includes("DELIVERED") || status.includes("C APP")) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4CAF50" }, // Green
      };
      statusCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    } else if (status.includes("READY") || status.includes("WIP") || status.includes("INT APP")) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC107" }, // Yellow
      };
    } else if (status.includes("DELAY") || status.includes("HOLD") || status.includes("C KB")) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF44336" }, // Red
      };
      statusCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    } else if (status.includes("YTS")) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF9E9E9E" }, // Gray
      };
    } else if (status.includes("AWF")) {
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF33B5E5" }, // Cyan
      };
      statusCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    }
  });

  // Freeze header row
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  // Save to temp file
  const fileName = `VFX_Delivery_List_${date || `${fromDate}_to_${toDate}`}.xlsx`;
  const filePath = join(tmpdir(), fileName);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

// Generate HTML table for email body (Outlook-compatible)
function generateHTMLTable(data: any[]): string {
  const rows = data
    .map((item) => {
      const status = item.status.toUpperCase();
      let statusBg = "#FFFFFF";
      let statusColor = "#000000";

      // Status colors - brighter and more vibrant for Outlook
      if (status.includes("DELIVERED") || status.includes("C APP")) {
        statusBg = "#00C851";  // Vivid green
        statusColor = "#FFFFFF";
      } else if (status.includes("READY") || status.includes("WIP") || status.includes("INT APP")) {
        statusBg = "#FFBB33";  // Vivid orange/amber
        statusColor = "#000000";
      } else if (status.includes("DELAY") || status.includes("HOLD") || status.includes("C KB")) {
        statusBg = "#FF4444";  // Vivid red
        statusColor = "#FFFFFF";
      } else if (status.includes("YTS")) {
        statusBg = "#FF4444";  // Vivid red (YTS is also critical)
        statusColor = "#FFFFFF";
      } else if (status.includes("AWF")) {
        statusBg = "#33B5E5";  // Vivid cyan
        statusColor = "#FFFFFF";
      }

      return `
        <tr>
          <td style="padding: 1px 12px; border: 1px solid #000000; background-color: #FFFFFF; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">${item.show}</td>
          <td style="padding: 1px 12px; border: 1px solid #000000; background-color: #FFFFFF; font-family: Arial, sans-serif; font-size: 9pt; font-weight: bold; white-space: nowrap;">${item.shot}</td>
          <td style="padding: 1px 12px; border: 1px solid #000000; background-color: #FFFFFF; text-align: center; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">${item.department}</td>
          <td style="padding: 1px 12px; border: 1px solid #000000; background-color: #FFFFFF; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">${item.lead}</td>
          <td style="padding: 1px 12px; border: 1px solid #000000; background-color: ${statusBg}; color: ${statusColor}; font-weight: bold; text-align: center; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">${item.status}</td>
          <td style="padding: 1px 12px; border: 1px solid #000000; background-color: #FFFFFF; text-align: center; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">${item.internalEta}</td>
          <td style="padding: 1px 12px; border: 1px solid #000000; background-color: #FFFFFF; text-align: center; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">${item.clientEta}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table cellpadding="0" cellspacing="0" border="1" style="border-collapse: collapse; border: 1px solid #000000; font-family: Arial, sans-serif; font-size: 9pt; margin-top: 10px; width: auto;">
      <thead>
        <tr>
          <th style="padding: 1px 12px; border: 1px solid #000000; background-color: #000000; color: #FFFFFF; text-align: center; font-weight: bold; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">SHOW</th>
          <th style="padding: 1px 12px; border: 1px solid #000000; background-color: #000000; color: #FFFFFF; text-align: center; font-weight: bold; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">SHOT</th>
          <th style="padding: 1px 12px; border: 1px solid #000000; background-color: #000000; color: #FFFFFF; text-align: center; font-weight: bold; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">DEPARTMENT</th>
          <th style="padding: 1px 12px; border: 1px solid #000000; background-color: #000000; color: #FFFFFF; text-align: center; font-weight: bold; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">LEAD</th>
          <th style="padding: 1px 12px; border: 1px solid #000000; background-color: #000000; color: #FFFFFF; text-align: center; font-weight: bold; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">STATUS</th>
          <th style="padding: 1px 12px; border: 1px solid #000000; background-color: #000000; color: #FFFFFF; text-align: center; font-weight: bold; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">INTERNAL ETA</th>
          <th style="padding: 1px 12px; border: 1px solid #000000; background-color: #000000; color: #FFFFFF; text-align: center; font-weight: bold; font-family: Arial, sans-serif; font-size: 9pt; white-space: nowrap;">CLIENT ETA</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// Send email via SMTP (nodemailer)
async function sendEmailViaSMTP(
  data: any[],
  htmlTable: string,
  excelPath: string,
  date?: string | null,
  fromDate?: string | null,
  toDate?: string | null,
  sendDirectly: boolean = true,
  userEmail?: string // Logged-in user's email
): Promise<void> {
  const fs = require("fs");

  // Determine subject line
  let subject = "VFX Delivery List";
  if (date) {
    subject += ` - ${new Date(date).toLocaleDateString()}`;
  } else if (fromDate && toDate) {
    subject += ` - ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`;
  }

  // Email body with properly formatted HTML table
  const emailBody = `
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 0;">
  <p style="font-size: 10pt; margin: 10px 0;">Hi Team,</p>
  
  <p style="font-size: 10pt; margin: 10px 0;">
    Please find the VFX delivery list for ${date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : `${new Date(fromDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(toDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`} below:
  </p>
  
  ${htmlTable}
  
  <p style="font-size: 10pt; margin: 20px 0 10px 0;">Best regards,<br/>VFX Tracker</p>
</body>
</html>
  `;

  // Configure SMTP transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Read Excel file as attachment
  const excelBuffer = fs.readFileSync(excelPath);
  const excelFileName = `VFX_Delivery_List_${date || `${fromDate}_to_${toDate}`}.xlsx`;

  // Send email
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: userEmail || 'nikhil.patil@digikore.com',
    subject: subject,
    html: emailBody,
    attachments: [
      {
        filename: excelFileName,
        content: excelBuffer,
      },
    ],
  });

  // Clean up the temporary Excel file
  try {
    await unlink(excelPath);
  } catch (error) {
    console.error('Failed to clean up Excel file:', error);
  }
}

