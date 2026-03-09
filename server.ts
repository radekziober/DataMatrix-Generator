import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import PDFDocument from "pdfkit";
import bwipjs from "bwip-js";
import { z } from "zod";

const db = new Database("print_jobs.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS print_jobs (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    settings TEXT
  );

  CREATE TABLE IF NOT EXISTS barcodes (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    text_value TEXT,
    FOREIGN KEY (job_id) REFERENCES print_jobs (id)
  );
`);

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = 3000;

const PrintJobSchema = z.object({
  codes: z.array(z.string().min(1)).min(1).max(500),
  settings: z.object({
    code_size: z.number().min(0.5).max(10),
    font_size: z.number().min(6).max(24),
    margin: z.number().min(0).max(5),
  }),
});

// API routes
app.post("/api/print-jobs", (req, res) => {
  try {
    const { codes, settings } = PrintJobSchema.parse(req.body);

    const jobId = uuidv4();
    
    const insertJob = db.prepare(
      "INSERT INTO print_jobs (id, settings) VALUES (?, ?)"
    );
    const insertBarcode = db.prepare(
      "INSERT INTO barcodes (id, job_id, text_value) VALUES (?, ?, ?)"
    );

    const transaction = db.transaction(() => {
      insertJob.run(jobId, JSON.stringify(settings));
      for (const code of codes) {
        insertBarcode.run(uuidv4(), jobId, code);
      }
    });

    transaction();

    res.status(201).json({ job_id: jobId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.issues });
    }
    console.error("Error creating print job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/print-jobs/:id/pdf", async (req, res) => {
  try {
    const jobId = req.params.id;

    const job = db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(jobId) as any;
    if (!job) {
      return res.status(404).json({ error: "Print job not found" });
    }

    const barcodes = db.prepare("SELECT text_value FROM barcodes WHERE job_id = ?").all(jobId) as any[];
    const settings = JSON.parse(job.settings);

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="print_job_${jobId}.pdf"`);

    doc.pipe(res);

    const cmToPt = 72 / 2.54;
    const codeSize = settings.code_size * cmToPt;
    const fontSize = settings.font_size;
    const margin = settings.margin * cmToPt;
    
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    
    const itemWidth = codeSize + margin * 2;
    const itemsPerRow = Math.max(1, Math.floor(pageWidth / itemWidth));

    let y = doc.page.margins.top;

    for (let i = 0; i < barcodes.length; i += itemsPerRow) {
      const rowItems = barcodes.slice(i, i + itemsPerRow);
      
      // Calculate max text height for this row
      let maxTextHeight = fontSize;
      const rowTexts = [];
      
      for (const item of rowItems) {
        const code = item.text_value;
        const charsPerLine = Math.max(1, Math.floor(codeSize / (fontSize * 0.6)));
        const words = code.split(' ');
        let wrappedText = '';
        for (const word of words) {
          if (word.length > charsPerLine) {
            const chunks = word.match(new RegExp(`.{1,${charsPerLine}}`, 'g')) || [word];
            wrappedText += chunks.join('\n') + '\n';
          } else {
            wrappedText += word + ' ';
          }
        }
        wrappedText = wrappedText.trim();
        rowTexts.push(wrappedText);
        
        const textHeight = doc.heightOfString(wrappedText, { width: codeSize, align: "center" });
        if (textHeight > maxTextHeight) {
          maxTextHeight = textHeight;
        }
      }
      
      const rowHeight = codeSize + maxTextHeight + margin * 2 + 5;

      // Check if we need a new page
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      let x = doc.page.margins.left;

      for (let j = 0; j < rowItems.length; j++) {
        const code = rowItems[j].text_value;
        const wrappedText = rowTexts[j];

        try {
          const png = await bwipjs.toBuffer({
            bcid: "datamatrix",
            text: code,
            scale: 3,
            includetext: false,
          });

          // Draw barcode
          doc.image(png, x + margin, y + margin, {
            width: codeSize,
            height: codeSize,
          });

          // Draw text
          doc.fontSize(fontSize).text(wrappedText, x + margin, y + margin + codeSize + 5, {
            width: codeSize,
            align: "center",
          });

          x += itemWidth;
        } catch (err) {
          console.error(`Error generating barcode for ${code}:`, err);
          doc.fontSize(fontSize).text(`Error: ${code}`, x + margin, y + margin, {
            width: codeSize,
            align: "center",
          });
          x += itemWidth;
        }
      }
      
      y += rowHeight;
    }

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
